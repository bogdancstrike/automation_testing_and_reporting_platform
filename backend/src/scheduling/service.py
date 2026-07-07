"""Scheduling service: CRUD + due-schedule processing."""
from __future__ import annotations

from typing import Any

from sqlalchemy import String, cast, delete as sa_delete, func, or_, select
from sqlalchemy.orm import Session

from src.catalog.models import TestDefinition
from src.catalog.service import default_project
from src.core.clock import utcnow
from src.core.errors import NotFoundError, ValidationError
from src.core.pagination import apply_sort, envelope, parse_page
from src.execution.service import enqueue_run
from src.scheduling import serializers
from src.scheduling.models import Schedule, ScheduleTest
from src.scheduling.recurrence import compute_next


def _scenario_summary(d: TestDefinition) -> dict[str, Any]:
    return {
        "id": d.id,
        "key": d.key,
        "name": d.name,
        "type": d.type,
        "target_key": d.target_key,
        "status": d.status,
    }


def _load_definitions(db: Session, test_ids: list[str]) -> list[TestDefinition]:
    if not test_ids:
        raise ValidationError("at least one scenario is required")
    defs = {d.id: d for d in db.scalars(select(TestDefinition).where(TestDefinition.id.in_(test_ids))).all()}
    missing = [test_id for test_id in test_ids if test_id not in defs]
    if missing:
        raise ValidationError(f"unknown scenario id(s): {', '.join(missing)}")
    return [defs[test_id] for test_id in test_ids]


def _payload_test_ids(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("test_definition_ids")
    if raw is None:
        raw = payload.get("test_definition_id")
    if raw is None:
        raise ValidationError("at least one scenario is required")
    values = raw if isinstance(raw, list) else [raw]
    out: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in out:
            out.append(text)
    if not out:
        raise ValidationError("at least one scenario is required")
    return out


def _sync_schedule_tests(db: Session, schedule: Schedule, defs: list[TestDefinition]) -> None:
    schedule.test_definition_id = defs[0].id
    db.execute(sa_delete(ScheduleTest).where(ScheduleTest.schedule_id == schedule.id))
    for definition in defs:
        db.add(ScheduleTest(schedule_id=schedule.id, test_definition_id=definition.id))


def _tests_by_schedule(db: Session, schedules: list[Schedule]) -> dict[str, list[dict[str, Any]]]:
    schedule_ids = [s.id for s in schedules]
    out: dict[str, list[dict[str, Any]]] = {s.id: [] for s in schedules}
    if schedule_ids:
        rows = db.execute(
            select(ScheduleTest.schedule_id, TestDefinition)
            .join(TestDefinition, ScheduleTest.test_definition_id == TestDefinition.id)
            .where(ScheduleTest.schedule_id.in_(schedule_ids))
            .order_by(ScheduleTest.created_at, TestDefinition.name)
        ).all()
        for schedule_id, definition in rows:
            out.setdefault(schedule_id, []).append(_scenario_summary(definition))

    # Legacy fallback for databases that have not backfilled schedule_tests yet.
    missing = [s for s in schedules if not out.get(s.id) and s.test_definition_id]
    if missing:
        defs = {d.id: d for d in db.scalars(
            select(TestDefinition).where(TestDefinition.id.in_([s.test_definition_id for s in missing]))
        ).all()}
        for schedule in missing:
            definition = defs.get(schedule.test_definition_id)
            if definition:
                out[schedule.id] = [_scenario_summary(definition)]
    return out


def list_schedules(db: Session, filters: dict[str, Any] | None = None) -> dict:
    filters = filters or {}
    params = parse_page(filters, default_sort="created_at", default_order="desc")
    count_subq = (
        select(ScheduleTest.schedule_id.label("schedule_id"), func.count().label("scenario_count"))
        .group_by(ScheduleTest.schedule_id)
        .subquery()
    )
    stmt = select(Schedule).outerjoin(count_subq, Schedule.id == count_subq.c.schedule_id)
    if filters.get("recurrence_type"):
        stmt = stmt.where(Schedule.recurrence_type == filters["recurrence_type"])
    if filters.get("is_enabled") in ("true", "false"):
        stmt = stmt.where(Schedule.is_enabled.is_(filters["is_enabled"] == "true"))
    if filters.get("name"):
        stmt = stmt.where(Schedule.name.ilike(f"%{filters['name']}%"))
    if filters.get("scenario"):
        like = f"%{filters['scenario']}%"
        stmt = stmt.where(Schedule.id.in_(
            select(ScheduleTest.schedule_id)
            .join(TestDefinition, ScheduleTest.test_definition_id == TestDefinition.id)
            .where(or_(TestDefinition.name.ilike(like), TestDefinition.key.ilike(like)))
        ))
    if filters.get("target"):
        stmt = stmt.where(Schedule.id.in_(
            select(ScheduleTest.schedule_id)
            .join(TestDefinition, ScheduleTest.test_definition_id == TestDefinition.id)
            .where(TestDefinition.target_key == filters["target"])
        ))
    if filters.get("next_run_at"):
        stmt = stmt.where(cast(Schedule.next_run_at, String).ilike(f"%{filters['next_run_at']}%"))
    if params.q:
        like = f"%{params.q}%"
        matching_schedules = (
            select(ScheduleTest.schedule_id)
            .join(TestDefinition, ScheduleTest.test_definition_id == TestDefinition.id)
            .where(or_(TestDefinition.name.ilike(like), TestDefinition.key.ilike(like), TestDefinition.target_key.ilike(like)))
        )
        stmt = stmt.where(or_(Schedule.name.ilike(like), Schedule.id.in_(matching_schedules)))
    stmt = apply_sort(stmt, params, {
        "name": Schedule.name, "recurrence_type": Schedule.recurrence_type,
        "next_run_at": Schedule.next_run_at, "created_at": Schedule.created_at,
        "is_enabled": Schedule.is_enabled,
        "scenario_count": func.coalesce(count_subq.c.scenario_count, 0),
    })
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    schedules = list(db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all())
    
    tests_by_schedule = _tests_by_schedule(db, schedules)
    
    sched_ids = {s.id for s in schedules}
    from src.execution.models import TestRun
    counts = {}
    if sched_ids:
        run_counts = db.execute(
            select(TestRun.schedule_id, func.count())
            .where(TestRun.schedule_id.in_(sched_ids), TestRun.stats_reset_at.is_(None))
            .group_by(TestRun.schedule_id)
        ).all()
        counts = {sid: c for sid, c in run_counts}

    out = []
    for s in schedules:
        tests = tests_by_schedule.get(s.id, [])
        first = tests[0] if tests else None
        item = serializers.schedule(s, test_name=first["name"] if first else None, tests=tests)
        item["target_key"] = first["target_key"] if first else None
        item["target_keys"] = sorted({t["target_key"] for t in tests if t.get("target_key")})
        item["total_runs"] = counts.get(s.id, 0)
        out.append(item)
        
    return envelope(out, total, params)

def get_schedule_detail(db: Session, schedule_id: str) -> dict:
    s = db.get(Schedule, schedule_id)
    if not s:
        raise NotFoundError("schedule not found")
    tests = _tests_by_schedule(db, [s]).get(s.id, [])
    first = tests[0] if tests else None

    from src.execution.models import TestRun
    stats = db.execute(
        select(TestRun.status, func.count())
        .where(TestRun.schedule_id == s.id, TestRun.stats_reset_at.is_(None))
        .group_by(TestRun.status)
    ).all()
    
    last_run = db.scalars(
        select(TestRun).where(TestRun.schedule_id == s.id, TestRun.stats_reset_at.is_(None)).order_by(TestRun.queued_at.desc()).limit(1)
    ).first()

    out = serializers.schedule(s, test_name=first["name"] if first else None, tests=tests)
    out["target_key"] = first["target_key"] if first else None
    out["target_keys"] = sorted({t["target_key"] for t in tests if t.get("target_key")})
    out["total_runs"] = sum(c for _, c in stats)
    out["status_counts"] = {st: c for st, c in stats}
    out["last_run_status"] = last_run.status if last_run else None
    out["last_run_id"] = last_run.id if last_run else None
    return out


def create_schedule(db: Session, payload: dict[str, Any]) -> dict:
    defs = _load_definitions(db, _payload_test_ids(payload))
    project = default_project(db)
    s = Schedule(
        project_id=project.id,
        test_definition_id=defs[0].id,
        name=payload.get("name") or (f"{defs[0].name} schedule" if len(defs) == 1 else f"{len(defs)} scenario schedule"),
        recurrence_type=payload.get("recurrence_type", "interval"),
        interval_seconds=payload.get("interval_seconds"),
        cron_expression=payload.get("cron_expression"),
        timezone=payload.get("timezone", "UTC"),
        environment=payload.get("environment", "default"),
        is_enabled=payload.get("is_enabled", True),
    )
    s.next_run_at = compute_next(s)
    db.add(s)
    db.flush()
    _sync_schedule_tests(db, s, defs)
    tests = [_scenario_summary(d) for d in defs]
    item = serializers.schedule(s, test_name=defs[0].name, tests=tests)
    item["target_key"] = defs[0].target_key
    item["target_keys"] = sorted({d.target_key for d in defs})
    return item


def update_schedule(db: Session, schedule_id: str, payload: dict[str, Any]) -> dict:
    s = db.get(Schedule, schedule_id)
    if not s:
        raise NotFoundError("schedule not found")
    defs: list[TestDefinition] | None = None
    if "test_definition_ids" in payload or "test_definition_id" in payload:
        defs = _load_definitions(db, _payload_test_ids(payload))
    for f in ("name", "recurrence_type", "interval_seconds", "cron_expression", "timezone", "environment", "is_enabled"):
        if f in payload:
            setattr(s, f, payload[f])
    if defs is not None:
        _sync_schedule_tests(db, s, defs)
    if s.is_enabled:
        s.next_run_at = compute_next(s)
    db.flush()
    tests = _tests_by_schedule(db, [s]).get(s.id, [])
    first = tests[0] if tests else None
    item = serializers.schedule(s, test_name=first["name"] if first else None, tests=tests)
    item["target_key"] = first["target_key"] if first else None
    item["target_keys"] = sorted({t["target_key"] for t in tests if t.get("target_key")})
    return item


def delete_schedule(db: Session, schedule_id: str) -> dict:
    s = db.get(Schedule, schedule_id)
    if not s:
        raise NotFoundError("schedule not found")
    db.delete(s)
    return {"deleted": schedule_id}


def process_due(db: Session) -> int:
    now = utcnow()
    stmt = (
        select(Schedule)
        .where(Schedule.is_enabled.is_(True), Schedule.next_run_at.isnot(None), Schedule.next_run_at <= now)
        .with_for_update(skip_locked=True)
    )
    enqueued = 0
    for s in db.scalars(stmt).all():
        if s.end_at and now > s.end_at:
            s.is_enabled = False
            continue
        tests = _tests_by_schedule(db, [s]).get(s.id, [])
        defs = _load_definitions(db, [t["id"] for t in tests]) if tests else []
        runnable = [d for d in defs if d.status != "missing_from_source"]
        if not runnable:
            s.is_enabled = False
            continue
        for definition in runnable:
            enqueue_run(db, definition, trigger="schedule", environment=s.environment, schedule_id=s.id)
        s.last_enqueued_at = now
        s.next_run_at = compute_next(s, after=now)
        if s.recurrence_type == "once":
            s.is_enabled = False
        enqueued += len(runnable)
    return enqueued
