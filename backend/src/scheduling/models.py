"""Scheduling domain: recurrence policies that create runs at due times."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Schedule(Base):
    __tablename__ = "schedules"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    scenario_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("scenarios.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    target_tags: Mapped[list] = mapped_column(JSONB, server_default='[]', default=list)

    recurrence_type: Mapped[str] = mapped_column(String(20), default="interval")  # once|interval|cron
    interval_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cron_expression: Mapped[str | None] = mapped_column(String(120), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")

    environment: Mapped[str] = mapped_column(String(64), default="default")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_enqueued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScheduleTest(Base):
    __tablename__ = "schedule_tests"
    __table_args__ = (UniqueConstraint("schedule_id", "scenario_id", name="uq_schedule_tests_schedule_test"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    schedule_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("schedules.id", ondelete="CASCADE"), index=True)
    scenario_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("scenarios.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
