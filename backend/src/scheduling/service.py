"""Scheduling service: CRUD + due-schedule processing."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.catalog.models import TestDefinition
from src.catalog.service import default_project
from src.core.clock import utcnow
from src.core.errors import NotFoundError, ValidationError
from src.execution.service import enqueue_run
from src.scheduling import serializers
from src.scheduling.models import Schedule
from src.scheduling.recurrence import compute_next


def list_schedules(db: Session) -> list[dict]:
    schedules = list(db.scalars(select(Schedule).order_by(Schedule.created_at.desc())).all())
    def_ids = {s.test_definition_id for s in schedules}
    defs = {d.id: d.name for d in
            db.scalars(select(TestDefinition).where(TestDefinition.id.in_(def_ids))).all()} if def_ids else {}
    return [serializers.schedule(s, test_name=defs.get(s.test_definition_id)) for s in schedules]


def create_schedule(db: Session, payload: dict[str, Any]) -> dict:
    test_id = payload.get("test_definition_id")
    d = db.get(TestDefinition, test_id) if test_id else None
    if not d:
        raise ValidationError("valid test_definition_id is required")
    project = default_project(db)
    s = Schedule(
        project_id=project.id,
        test_definition_id=d.id,
        name=payload.get("name") or f"{d.name} schedule",
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
    return serializers.schedule(s, test_name=d.name)


def update_schedule(db: Session, schedule_id: str, payload: dict[str, Any]) -> dict:
    s = db.get(Schedule, schedule_id)
    if not s:
        raise NotFoundError("schedule not found")
    for f in ("name", "recurrence_type", "interval_seconds", "cron_expression",
              "timezone", "environment", "is_enabled"):
        if f in payload:
            setattr(s, f, payload[f])
    if s.is_enabled:
        s.next_run_at = compute_next(s)
    db.flush()
    return serializers.schedule(s)


def delete_schedule(db: Session, schedule_id: str) -> dict:
    s = db.get(Schedule, schedule_id)
    if not s:
        raise NotFoundError("schedule not found")
    db.delete(s)
    return {"deleted": schedule_id}


def process_due(db: Session) -> int:
    """Claim due schedules, enqueue a run each, advance next_run_at. One txn."""
    now = utcnow()
    stmt = (
        select(Schedule)
        .where(Schedule.is_enabled.is_(True), Schedule.next_run_at.isnot(None),
               Schedule.next_run_at <= now)
        .with_for_update(skip_locked=True)
    )
    enqueued = 0
    for s in db.scalars(stmt).all():
        if s.end_at and now > s.end_at:
            s.is_enabled = False
            continue
        d = db.get(TestDefinition, s.test_definition_id)
        if not d or d.status == "missing_from_source":
            s.is_enabled = False
            continue
        enqueue_run(db, d, trigger="schedule", environment=s.environment, schedule_id=s.id)
        s.last_enqueued_at = now
        s.next_run_at = compute_next(s, after=now)
        if s.recurrence_type == "once":
            s.is_enabled = False
        enqueued += 1
    return enqueued
