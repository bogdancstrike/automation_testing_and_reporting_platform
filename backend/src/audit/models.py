"""Audit ORM — `audit_events` is the immutable ledger."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("idx_audit_events_actor",         "actor", "created_at"),
        Index("idx_audit_events_action",        "action", "created_at"),
        Index("idx_audit_events_entity",        "entity_type", "entity_id", "created_at"),
        Index("idx_audit_events_created_at",    "created_at"),
        Index("idx_audit_events_correlation",   "correlation_id"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    actor: Mapped[str | None] = mapped_column(String(120))

    action:      Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id:   Mapped[str | None] = mapped_column(UUID(as_uuid=False))

    old_value: Mapped[dict | None] = mapped_column(JSONB)
    new_value: Mapped[dict | None] = mapped_column(JSONB)
    # `metadata` is a SQLAlchemy reserved attribute on Base; keep the column
    # name in DB but expose a different attribute name on the model.
    audit_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)

    request_ip:     Mapped[str | None] = mapped_column(INET)
    user_agent:     Mapped[str | None] = mapped_column(Text)
    correlation_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
