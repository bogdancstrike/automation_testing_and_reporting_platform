"""Execution domain: queue, runs, attempts, steps, assertions, logs, workers."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (BigInteger, Boolean, DateTime, ForeignKey, Integer,
                        String, Text, func)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class TestRun(Base):
    __tablename__ = "test_runs"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    test_definition_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("test_definitions.id"), index=True)
    revision_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    target_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True, index=True)
    schedule_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True, index=True)

    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    trigger: Mapped[str] = mapped_column(String(20), default="manual")  # manual|schedule|api|discovery
    environment: Mapped[str] = mapped_column(String(64), default="default")
    worker_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    triggered_by: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)

    error_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    defect_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # product_bug|automation_bug|...
    failure_signature: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    response: Mapped[dict] = mapped_column(JSONB, default=dict)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stats_reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    stats_reset_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    stats_reset_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    steps: Mapped[list["TestRunStep"]] = relationship(
        cascade="all, delete-orphan", order_by="TestRunStep.ord")
    assertions: Mapped[list["TestRunAssertion"]] = relationship(
        cascade="all, delete-orphan", order_by="TestRunAssertion.ord")


class RunQueue(Base):
    __tablename__ = "run_queue"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    test_run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_runs.id"), index=True)
    capability: Mapped[str] = mapped_column(String(40), default="http", index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)  # queued|claimed|done
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    claimed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TestRunStep(Base):
    __tablename__ = "test_run_steps"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_runs.id"), index=True)
    ord: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20))
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class TestRunAssertion(Base):
    __tablename__ = "test_run_assertions"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_runs.id"), index=True)
    ord: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(40))
    operator: Mapped[str] = mapped_column(String(30))
    target: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected: Mapped[dict] = mapped_column(JSONB, nullable=True)
    actual: Mapped[dict] = mapped_column(JSONB, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)


class RunLog(Base):
    __tablename__ = "run_logs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_runs.id"), index=True)
    level: Mapped[str] = mapped_column(String(10), default="info")
    message: Mapped[str] = mapped_column(Text)
    context: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FailureSignature(Base):
    __tablename__ = "failure_signatures"
    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    signature_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(40))
    sample_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_defect_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    occurrences: Mapped[int] = mapped_column(Integer, default=0)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Worker(Base):
    __tablename__ = "workers"
    name: Mapped[str] = mapped_column(String(120), primary_key=True)
    capabilities: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), default="idle")  # idle|busy|offline
    current_run_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    runs_completed: Mapped[int] = mapped_column(Integer, default=0)
    last_heartbeat: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
