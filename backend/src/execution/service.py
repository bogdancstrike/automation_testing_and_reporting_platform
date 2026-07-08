"""Execution service: enqueue, list, detail, cancel, defect triage."""
from __future__ import annotations

from typing import Any

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from src.catalog.models import Target, Scenario
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


def enqueue_run(db: Session, definition: Scenario, *, trigger: str = "manual",
                environment: str = "default", schedule_id: str | None = None,
                triggered_by: str | None = None) -> TestRun:
    target = resolve_target(db, definition.project_id, definition.target_key)
    run = TestRun(
        project_id=definition.project_id,
        scenario_id=definition.id,
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
    d = db.get(Scenario, test_id)
    if not d:
        raise NotFoundError("test not found")
    if d.status == "missing_from_source":
        raise ValidationError("cannot run a test missing from source")
    run = enqueue_run(db, d, trigger="manual", environment=environment, triggered_by=triggered_by)
    return serializers.run_summary(run, test_name=d.name, target_key=d.target_key)


def requeue_run(db: Session, run_id: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r or r.stats_reset_at is not None:
        raise NotFoundError("run not found")
    if r.status != "queued":
        raise ValidationError("only queued runs can be re-queued")
    
    q = db.scalar(select(RunQueue).where(RunQueue.test_run_id == r.id))
    capability = q.capability if q else "http"
    db.info.setdefault("pending_runs", []).append((r.id, capability))
    return serializers.run_summary(r)


def requeue_all_queued(db: Session) -> dict:
    runs = db.scalars(select(TestRun).where(TestRun.status == "queued")).all()
    count = 0
    for r in runs:
        q = db.scalar(select(RunQueue).where(RunQueue.test_run_id == r.id))
        capability = q.capability if q else "http"
        db.info.setdefault("pending_runs", []).append((r.id, capability))
        count += 1
    return {"requeued_count": count}


def restart_run(db: Session, run_id: str) -> dict:
    from sqlalchemy import delete
    from src.execution.models import TestRunStep, TestRunAssertion, RunLog
    r = db.get(TestRun, run_id)
    if not r or r.stats_reset_at is not None:
        raise NotFoundError("run not found")
    if r.status in ("queued", "running"):
        raise ValidationError("run is already queued or running")
    
    r.status = "queued"
    r.worker_name = None
    r.cancel_requested = False
    r.error_category = None
    r.error_message = None
    r.defect_type = None
    r.failure_signature = None
    r.response = {}
    r.metrics = {}
    r.started_at = None
    r.finished_at = None
    r.duration_ms = None
    
    db.execute(delete(TestRunStep).where(TestRunStep.test_run_id == r.id))
    db.execute(delete(TestRunAssertion).where(TestRunAssertion.test_run_id == r.id))
    db.execute(delete(RunLog).where(RunLog.test_run_id == r.id))
    
    q = db.scalar(select(RunQueue).where(RunQueue.test_run_id == r.id))
    if q:
        q.status = "queued"
        q.claimed_by = None
        q.claimed_at = None
        capability = q.capability
    else:
        d = db.get(Scenario, r.scenario_id)
        capability = capability_for(d.type) if d else "http"
        db.add(RunQueue(test_run_id=r.id, capability=capability))
        
    db.flush()
    db.info.setdefault("pending_runs", []).append((r.id, capability))
    return serializers.run_summary(r)


def restart_all_failed(db: Session) -> dict:
    runs = db.scalars(select(TestRun).where(TestRun.status.in_(("error", "failed", "timeout")))).all()
    count = 0
    for r in runs:
        restart_run(db, r.id)
        count += 1
    return {"restarted_count": count}


def _names(db: Session, runs: list[TestRun]) -> tuple[dict, dict]:
    def_ids = {r.scenario_id for r in runs}
    tgt_ids = {r.target_id for r in runs if r.target_id}
    defs = {d.id: d for d in db.scalars(select(Scenario).where(Scenario.id.in_(def_ids))).all()} if def_ids else {}
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
    stmt = (
        select(TestRun)
        .outerjoin(Scenario, TestRun.scenario_id == Scenario.id)
        .outerjoin(Target, TestRun.target_id == Target.id)
        .where(TestRun.stats_reset_at.is_(None))
    )
    if filters.get("status"):
        stmt = stmt.where(TestRun.status == filters["status"])
    if filters.get("scenario_id"):
        stmt = stmt.where(TestRun.scenario_id == filters["scenario_id"])
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
        stmt = stmt.where(TestRun.error_category.ilike(f"%{filters['error_category']}%"))
    if filters.get("target"):
        stmt = stmt.where(Target.key == filters["target"])
    if filters.get("test"):
        like = f"%{filters['test']}%"
        stmt = stmt.where(or_(Scenario.name.ilike(like), Scenario.key.ilike(like)))
    if filters.get("worker_name"):
        stmt = stmt.where(TestRun.worker_name.ilike(f"%{filters['worker_name']}%"))
    if filters.get("duration_ms"):
        stmt = stmt.where(cast(TestRun.duration_ms, String).ilike(f"%{filters['duration_ms']}%"))
    if filters.get("cleanup_failed"):
        vals = {v.strip() for v in str(filters["cleanup_failed"]).split(",") if v.strip()}
        if "true" in vals:  # legacy param value meant "only cleanup failures"
            vals.add("failed")
        wants_failed = "failed" in vals
        wants_passed = "passed" in vals
        if wants_failed and not wants_passed:
            stmt = stmt.where(TestRun.cleanup_failed == True)
        elif wants_passed and not wants_failed:
            stmt = stmt.where(TestRun.cleanup_failed == False)
    if filters.get("queued_at"):
        stmt = stmt.where(cast(TestRun.queued_at, String).ilike(f"%{filters['queued_at']}%"))
    if filters.get("tags"):
        tags = [t.strip() for t in filters["tags"].split(",") if t.strip()]
        if tags:
            stmt = stmt.where(Scenario.tags.contains(tags))
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(or_(
            Scenario.name.ilike(like),
            Scenario.key.ilike(like),
            Target.name.ilike(like),
            Target.key.ilike(like),
            Target.base_url.ilike(like),
            TestRun.worker_name.ilike(like),
        ))

    stmt = apply_sort(stmt, params, {
        "queued_at": TestRun.queued_at, "started_at": TestRun.started_at,
        "finished_at": TestRun.finished_at, "duration_ms": TestRun.duration_ms,
        "status": TestRun.status, "trigger": TestRun.trigger,
        "worker_name": TestRun.worker_name, "defect_type": TestRun.defect_type,
        "error_category": TestRun.error_category, "test_name": Scenario.name,
        "target_key": Target.key, "tags": cast(Scenario.tags, String),
        "cleanup_failed": TestRun.cleanup_failed,
    })
    total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
    runs = list(db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all())
    defs, tgts = _names(db, runs)
    items = [
        serializers.run_summary(
            r,
            test_name=defs[r.scenario_id].name if r.scenario_id in defs else None,
            target_key=tgts[r.target_id].key if r.target_id in tgts else None,
            tags=defs[r.scenario_id].tags if r.scenario_id in defs else [],
        )
        for r in runs
    ]
    return envelope(items, total, params)


def get_run_detail(db: Session, run_id: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r or r.stats_reset_at is not None:
        raise NotFoundError("run not found")
    d = db.get(Scenario, r.scenario_id)
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


def delete_run(db: Session, run_id: str) -> dict:
    from sqlalchemy import delete
    from src.execution.models import RunLog
    r = db.get(TestRun, run_id)
    if not r:
        raise NotFoundError("run not found")
    
    db.execute(delete(RunQueue).where(RunQueue.test_run_id == run_id))
    db.execute(delete(RunLog).where(RunLog.test_run_id == run_id))
    db.delete(r)
    return {"deleted": True, "id": run_id}


def delete_all_runs(db: Session) -> dict:
    from sqlalchemy import delete
    from src.execution.models import RunLog, TestRunStep, TestRunAssertion
    db.execute(delete(RunQueue))
    db.execute(delete(RunLog))
    db.execute(delete(TestRunStep))
    db.execute(delete(TestRunAssertion))
    res = db.execute(delete(TestRun))
    
    # Also reset test definitions last run stats
    for test in db.scalars(select(Scenario)).all():
        test.last_run_status = None
        test.last_run_at = None
        
    return {"deleted": True, "count": res.rowcount}


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
        select(Scenario)
        .where(Scenario.project_id == target.project_id, Scenario.target_key == target.key)
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
