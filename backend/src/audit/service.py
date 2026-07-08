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


def list_(db: Session, actor: str, filters: dict[str, Any]) -> dict:
    from src.core.pagination import parse_page, envelope, apply_sort
    params = parse_page(filters, default_sort="created_at", default_order="desc", max_page_size=200)

    stmt = select(AuditEvent)
    
    action = filters.get("action")
    if action: stmt = stmt.where(AuditEvent.action == action)
    
    entity_type = filters.get("entity_type")
    if entity_type: stmt = stmt.where(AuditEvent.entity_type == entity_type)
    
    entity_id = filters.get("entity_id")
    if entity_id: stmt = stmt.where(AuditEvent.entity_id == entity_id)
    
    related_to = filters.get("related_to")
    if related_to:
        from sqlalchemy import or_, text
        stmt = stmt.where(
            or_(
                AuditEvent.entity_id == related_to,
                text("(new_value->>'scenario_id' = :related_to OR old_value->>'scenario_id' = :related_to)").bindparams(related_to=related_to)
            )
        )
        
    correlation_id = filters.get("correlation_id")
    if correlation_id: stmt = stmt.where(AuditEvent.correlation_id == correlation_id)
    
    # Search text
    if params.q:
        # Simplistic text search over some strings, e.g. actor or action
        stmt = stmt.where(AuditEvent.actor.ilike(f"%{params.q}%"))
        
    actor_filter = filters.get("actor")
    if actor_filter: stmt = stmt.where(AuditEvent.actor.ilike(f"%{actor_filter}%"))

    created_after = filters.get("created_after")
    if created_after: stmt = stmt.where(AuditEvent.created_at >= created_after)

    created_before = filters.get("created_before")
    if created_before: stmt = stmt.where(AuditEvent.created_at <= created_before)

    # Sort
    sort_fields = {
        "created_at": AuditEvent.created_at,
        "action": AuditEvent.action,
        "actor": AuditEvent.actor,
        "entity_type": AuditEvent.entity_type,
        "correlation_id": AuditEvent.correlation_id,
    }
    stmt = apply_sort(stmt, params, sort_fields)

    # Paginate
    from sqlalchemy import func
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.offset((params.page - 1) * params.page_size).limit(params.page_size)).all()
    
    from src.audit.serializers import serialize_audit_event
    return envelope([serialize_audit_event(r) for r in rows], total, params)



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
