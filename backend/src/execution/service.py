"""Execution service: enqueue, list, detail, cancel, defect triage."""
from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.catalog.models import Target, TestDefinition
from src.catalog.service import resolve_target
from src.core.correlation import get_correlation_id
from src.core.clock import utcnow
from src.core.errors import NotFoundError, ValidationError
from src.core.pagination import apply_sort, envelope, parse_page
from framework.tracing import get_tracer
from src.execution import serializers
from src.execution.failure_classifier import apply_defect
from src.execution.models import RunQueue, TestRun
from src.testkit.base import TYPE_CLI, TYPE_HTTP, TYPE_PLAYWRIGHT, TYPE_PYTHON, TYPE_SELENIUM

tracer = get_tracer()

_CAPABILITY = {
    TYPE_HTTP: "http", TYPE_PYTHON: "python", TYPE_PLAYWRIGHT: "playwright",
    TYPE_SELENIUM: "selenium", TYPE_CLI: "cli",
}


def capability_for(test_type: str) -> str:
    return _CAPABILITY.get(test_type, "http")


def enqueue_run(db: Session, definition: TestDefinition, *, trigger: str = "manual",
                environment: str = "default", schedule_id: str | None = None,
                triggered_by: str | None = None) -> TestRun:
    target = resolve_target(db, definition.project_id, definition.target_key)
    run = TestRun(
        project_id=definition.project_id,
        test_definition_id=definition.id,
        revision_id=definition.current_revision_id,
        target_id=target.id if target else None,
        schedule_id=schedule_id,
        status="queued",
        trigger=trigger,
        environment=environment,
        triggered_by=triggered_by,
        correlation_id=get_correlation_id() if trigger in ("manual", "api") else None,
    )
    db.add(run)
    db.flush()
    capability = capability_for(definition.type)
    db.add(RunQueue(test_run_id=run.id, capability=capability))
    db.flush()
    # Stash for the transactional-outbox publish in session_scope(): the run is
    # dispatched to a worker over Kafka only after this transaction commits.
    db.info.setdefault("pending_runs", []).append((run.id, capability))
    return run


def run_now(db: Session, test_id: str, *, environment: str = "default", triggered_by: str | None = None) -> dict:
    d = db.get(TestDefinition, test_id)
    if not d:
        raise NotFoundError("test not found")
    if d.status == "missing_from_source":
        raise ValidationError("cannot run a test missing from source")
    run = enqueue_run(db, d, trigger="manual", environment=environment, triggered_by=triggered_by)
    return serializers.run_summary(run, test_name=d.name, target_key=d.target_key)


def _names(db: Session, runs: list[TestRun]) -> tuple[dict, dict]:
    def_ids = {r.test_definition_id for r in runs}
    tgt_ids = {r.target_id for r in runs if r.target_id}
    defs = {d.id: d for d in db.scalars(select(TestDefinition).where(TestDefinition.id.in_(def_ids))).all()} if def_ids else {}
    tgts = {t.id: t for t in db.scalars(select(Target).where(Target.id.in_(tgt_ids))).all()} if tgt_ids else {}
    return defs, tgts


def list_runs(db: Session, filters: dict[str, Any]) -> dict:
    with tracer.start_as_current_span("execution.list_runs") as span:
        span.set_attribute("query.filters", str(filters))
        result = _list_runs(db, filters)
        span.set_attribute("page.total", result.get("total", 0))
        span.set_attribute("page.size", result.get("page_size", 0))
        return result


def _list_runs(db: Session, filters: dict[str, Any]) -> dict:
    params = parse_page(filters, default_sort="queued_at", default_order="desc", max_page_size=100)
    stmt = select(TestRun).where(TestRun.stats_reset_at.is_(None))
    if filters.get("status"):
        stmt = stmt.where(TestRun.status == filters["status"])
    if filters.get("test_definition_id"):
        stmt = stmt.where(TestRun.test_definition_id == filters["test_definition_id"])
    if filters.get("target_id"):
        stmt = stmt.where(TestRun.target_id == filters["target_id"])
    if filters.get("schedule_id"):
        stmt = stmt.where(TestRun.schedule_id == filters["schedule_id"])
    if filters.get("trigger"):
        stmt = stmt.where(TestRun.trigger == filters["trigger"])
    if filters.get("triggered_by"):
        stmt = stmt.where(TestRun.triggered_by == filters["triggered_by"])
    if filters.get("defect_type"):
        stmt = stmt.where(TestRun.defect_type == filters["defect_type"])
    if filters.get("error_category"):
        stmt = stmt.where(TestRun.error_category == filters["error_category"])
    if filters.get("target"):
        target = db.scalars(select(Target).where(Target.key == filters["target"])).first()
        stmt = stmt.where(TestRun.target_id == (target.id if target else "00000000-0000-0000-0000-000000000000"))
    if filters.get("tags"):
        tags = [t.strip() for t in filters["tags"].split(",") if t.strip()]
        if tags:
            stmt = stmt.where(TestRun.test_definition_id.in_(
                select(TestDefinition.id).where(TestDefinition.tags.contains(tags))
            ))
    if params.q:
        like = f"%{params.q}%"
        matching_defs = select(TestDefinition.id).where(or_(TestDefinition.name.ilike(like), TestDefinition.key.ilike(like)))
        matching_targets = select(Target.id).where(or_(Target.name.ilike(like), Target.key.ilike(like), Target.base_url.ilike(like)))
        stmt = stmt.where(or_(TestRun.test_definition_id.in_(matching_defs), TestRun.target_id.in_(matching_targets), TestRun.worker_name.ilike(like)))

    stmt = apply_sort(stmt, params, {
        "queued_at": TestRun.queued_at, "started_at": TestRun.started_at,
        "finished_at": TestRun.finished_at, "duration_ms": TestRun.duration_ms,
        "status": TestRun.status, "trigger": TestRun.trigger,
        "worker_name": TestRun.worker_name, "defect_type": TestRun.defect_type,
        "error_category": TestRun.error_category,
    })
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    runs = list(db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all())
    defs, tgts = _names(db, runs)
    items = [
        serializers.run_summary(
            r,
            test_name=defs[r.test_definition_id].name if r.test_definition_id in defs else None,
            target_key=tgts[r.target_id].key if r.target_id in tgts else None,
            tags=defs[r.test_definition_id].tags if r.test_definition_id in defs else [],
        )
        for r in runs
    ]
    return envelope(items, total, params)


def get_run_detail(db: Session, run_id: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r or r.stats_reset_at is not None:
        raise NotFoundError("run not found")
    d = db.get(TestDefinition, r.test_definition_id)
    t = db.get(Target, r.target_id) if r.target_id else None
    return serializers.run_detail(r, test_name=d.name if d else None, target_key=t.key if t else None, tags=d.tags if d else [])


def cancel_run(db: Session, run_id: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r or r.stats_reset_at is not None:
        raise NotFoundError("run not found")
    if r.status in ("queued",):
        r.status = "canceled"
        r.error_category = "canceled"
        for q in db.scalars(select(RunQueue).where(RunQueue.test_run_id == r.id)).all():
            q.status = "done"
    elif r.status in ("claimed", "preparing", "running"):
        r.cancel_requested = True
    else:
        raise ValidationError(f"run in status {r.status!r} cannot be canceled")
    return {"id": r.id, "status": r.status, "cancel_requested": r.cancel_requested}


def set_defect(db: Session, run_id: str, defect_type: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r or r.stats_reset_at is not None:
        raise NotFoundError("run not found")
    if r.status not in ("failed", "error", "timeout"):
        raise ValidationError("only failed/error/timeout runs can be triaged")
    apply_defect(db, r, defect_type)
    return {"id": r.id, "defect_type": r.defect_type}


def reset_target_stats(db: Session, target_id: str, *, actor: str, reason: str = "target stats reset") -> dict:
    """Soft-reset all execution data for a target without deleting rows."""
    target = db.get(Target, target_id)
    if not target:
        raise NotFoundError("target not found")

    reset_at = utcnow()
    runs = db.scalars(
        select(TestRun)
        .where(TestRun.target_id == target.id, TestRun.stats_reset_at.is_(None))
        .order_by(TestRun.queued_at)
    ).all()
    run_ids = [r.id for r in runs]

    for run in runs:
        run.stats_reset_at = reset_at
        run.stats_reset_by = actor or "unknown"
        run.stats_reset_reason = reason
        if run.status in ("queued", "claimed", "preparing", "running"):
            run.cancel_requested = True

    if run_ids:
        queue_items = db.scalars(
            select(RunQueue).where(RunQueue.test_run_id.in_(run_ids), RunQueue.status != "done")
        ).all()
        for item in queue_items:
            item.status = "done"

    tests = db.scalars(
        select(TestDefinition)
        .where(TestDefinition.project_id == target.project_id, TestDefinition.target_key == target.key)
    ).all()
    for definition in tests:
        definition.last_run_status = None
        definition.last_run_at = None

    db.flush()
    return {
        "target_id": target.id,
        "target_key": target.key,
        "reset_runs": len(runs),
        "reset_tests": len(tests),
        "reset_at": reset_at.isoformat(),
        "reset_by": actor or "unknown",
    }
