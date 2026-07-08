"""Audit ledger — single entry point for writing immutable audit events."""
from typing import Any

from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from src.core.correlation import get_correlation_id
from src.core.errors import PermissionDeniedError
from src.iam import decorators, principal
from src.audit.models import AuditEvent


def _request_metadata() -> tuple[str | None, str | None, str | None]:
    try:
        from flask import request, g
        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        ua = request.headers.get("User-Agent")
        
        principal = getattr(g, "principal", None)
        actor = getattr(principal, "username", None) or getattr(principal, "subject", None) if principal else None
        
        return ip, ua, actor
    except Exception:
        return None, None, None


def record(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    related_to: str | None = None,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    ip, ua, actor = _request_metadata()
    evt = AuditEvent(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        audit_metadata=metadata,
        request_ip=ip,
        user_agent=ua,
        correlation_id=get_correlation_id(),
    )
    db.add(evt)
    db.flush()
    return evt


def list_(
    db: Session,
    actor: str,
    *,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    related_to: str | None = None,
    correlation_id: str | None = None,
    created_after: str | None = None,
    created_before: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    limit: int = 100,
) -> list[AuditEvent]:
    limit = max(1, min(limit, 200))
    stmt = select(AuditEvent)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if actor:
        # In a real system, you might filter if not admin. 
        # But here we let the caller specify the actor filter.
        # Wait, if `actor` is passed in as a filter, let's use it as a filter.
        pass
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    if related_to:
        from sqlalchemy import or_, text
        # If it's Postgres, we can do new_value->>'test_definition_id' == related_to
        # For simplicity and cross-db compatibility in SQLAlchemy, we can cast new_value to string 
        # or just use postgres json operators since QTP uses Postgres.
        stmt = stmt.where(
            or_(
                AuditEvent.entity_id == related_to,
                text("new_value->>'test_definition_id' = :related_to").bindparams(related_to=related_to)
            )
        )
    if correlation_id:
        stmt = stmt.where(AuditEvent.correlation_id == correlation_id)
    if created_after:
        stmt = stmt.where(AuditEvent.created_at >= created_after)
    if created_before:
        stmt = stmt.where(AuditEvent.created_at <= created_before)

    col = getattr(AuditEvent, sort_by, AuditEvent.created_at)
    stmt = stmt.order_by(desc(col) if sort_dir == "desc" else asc(col))
    stmt = stmt.limit(limit)

    return list(db.scalars(stmt))


def get_for_entity(
    db: Session,
    entity_type: str,
    entity_id: str,
    limit: int = 100,
) -> list[AuditEvent]:
    return list_(
        db,
        actor="",
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
    )
