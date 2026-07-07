"""Execution service: enqueue, list, detail, cancel, defect triage."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.catalog.models import Target, TestDefinition
from src.catalog.service import resolve_target
from src.core.correlation import get_correlation_id
from src.core.errors import NotFoundError, ValidationError
from src.execution import serializers
from src.execution.failure_classifier import apply_defect
from src.execution.models import RunQueue, TestRun
from src.testkit.base import (TYPE_CLI, TYPE_HTTP, TYPE_PLAYWRIGHT, TYPE_PYTHON,
                              TYPE_SELENIUM)

_CAPABILITY = {
    TYPE_HTTP: "http", TYPE_PYTHON: "python", TYPE_PLAYWRIGHT: "playwright",
    TYPE_SELENIUM: "selenium", TYPE_CLI: "cli",
}


def capability_for(test_type: str) -> str:
    return _CAPABILITY.get(test_type, "http")


def enqueue_run(db: Session, definition: TestDefinition, *, trigger: str = "manual",
                environment: str = "default", schedule_id: str | None = None) -> TestRun:
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
        correlation_id=get_correlation_id() if trigger in ("manual", "api") else None,
    )
    db.add(run)
    db.flush()
    db.add(RunQueue(test_run_id=run.id, capability=capability_for(definition.type)))
    db.flush()
    return run


def run_now(db: Session, test_id: str, *, environment: str = "default") -> dict:
    d = db.get(TestDefinition, test_id)
    if not d:
        raise NotFoundError("test not found")
    if d.status == "missing_from_source":
        raise ValidationError("cannot run a test missing from source")
    run = enqueue_run(db, d, trigger="manual", environment=environment)
    return serializers.run_summary(run, test_name=d.name, target_key=d.target_key)


def _names(db: Session, runs: list[TestRun]) -> tuple[dict, dict]:
    def_ids = {r.test_definition_id for r in runs}
    tgt_ids = {r.target_id for r in runs if r.target_id}
    defs = {d.id: d for d in db.scalars(select(TestDefinition).where(TestDefinition.id.in_(def_ids))).all()} if def_ids else {}
    tgts = {t.id: t for t in db.scalars(select(Target).where(Target.id.in_(tgt_ids))).all()} if tgt_ids else {}
    return defs, tgts


def list_runs(db: Session, filters: dict[str, Any]) -> list[dict]:
    stmt = select(TestRun)
    if filters.get("status"):
        stmt = stmt.where(TestRun.status == filters["status"])
    if filters.get("test_definition_id"):
        stmt = stmt.where(TestRun.test_definition_id == filters["test_definition_id"])
    if filters.get("trigger"):
        stmt = stmt.where(TestRun.trigger == filters["trigger"])
    limit = min(int(filters.get("limit", 100)), 500)
    stmt = stmt.order_by(TestRun.queued_at.desc()).limit(limit)
    runs = list(db.scalars(stmt).all())
    defs, tgts = _names(db, runs)
    return [
        serializers.run_summary(
            r,
            test_name=defs[r.test_definition_id].name if r.test_definition_id in defs else None,
            target_key=tgts[r.target_id].key if r.target_id in tgts else None,
        )
        for r in runs
    ]


def get_run_detail(db: Session, run_id: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r:
        raise NotFoundError("run not found")
    d = db.get(TestDefinition, r.test_definition_id)
    t = db.get(Target, r.target_id) if r.target_id else None
    return serializers.run_detail(r, test_name=d.name if d else None,
                                  target_key=t.key if t else None)


def cancel_run(db: Session, run_id: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r:
        raise NotFoundError("run not found")
    if r.status in ("queued",):
        r.status = "canceled"
        r.error_category = "canceled"
        # Remove it from the queue so no worker claims it.
        for q in db.scalars(select(RunQueue).where(RunQueue.test_run_id == r.id)).all():
            q.status = "done"
    elif r.status in ("claimed", "preparing", "running"):
        r.cancel_requested = True  # cooperative — the worker observes and stops
    else:
        raise ValidationError(f"run in status {r.status!r} cannot be canceled")
    return {"id": r.id, "status": r.status, "cancel_requested": r.cancel_requested}


def set_defect(db: Session, run_id: str, defect_type: str) -> dict:
    r = db.get(TestRun, run_id)
    if not r:
        raise NotFoundError("run not found")
    if r.status not in ("failed", "error", "timeout"):
        raise ValidationError("only failed/error/timeout runs can be triaged")
    apply_defect(db, r, defect_type)
    return {"id": r.id, "defect_type": r.defect_type}
