import json
from sqlalchemy import event
from sqlalchemy.orm import Mapper
from sqlalchemy.engine import Connection

from src.core.db import Base
from src.audit.service import record
from src.audit.models import AuditEvent


def _to_dict(obj):
    d = {}
    for column in obj.__table__.columns:
        val = getattr(obj, column.name)
        # simplistic serialization
        d[column.name] = str(val) if val is not None else None
    return d


def _record_event(mapper: Mapper, connection: Connection, target, action: str):
    if isinstance(target, AuditEvent):
        return
    
    # Wait, getting the actor requires Flask request context.
    from flask import has_request_context, g
    actor = None
    if has_request_context():
        principal = getattr(g, "principal", None)
        actor = getattr(principal, "username", None) or getattr(principal, "subject", None) if principal else None

    entity_type = target.__tablename__
    entity_id = str(getattr(target, "id", None))

    old_value = None
    new_value = None

    if action == "CREATED":
        new_value = _to_dict(target)
    elif action == "UPDATED":
        # Get history
        old_value = {}
        new_value = {}
        from sqlalchemy.orm.attributes import get_history
        for prop in mapper.column_attrs:
            hist = get_history(target, prop.key)
            if hist.has_changes():
                old_value[prop.key] = str(hist.deleted[0]) if hist.deleted else None
                new_value[prop.key] = str(hist.added[0]) if hist.added else None
    elif action == "DELETED":
        old_value = _to_dict(target)

    from src.core.correlation import get_correlation_id
    from flask import request
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) if has_request_context() else None
    ua = request.headers.get("User-Agent") if has_request_context() else None

    from sqlalchemy import insert
    import uuid
    from datetime import datetime, timezone
    
    evt_values = dict(
        id=str(uuid.uuid4()),
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        request_ip=ip,
        user_agent=ua,
        correlation_id=get_correlation_id(),
        created_at=datetime.now(timezone.utc)
    )
    connection.execute(insert(AuditEvent).values(**evt_values))


@event.listens_for(Base, "after_insert", propagate=True)
def after_insert(mapper, connection, target):
    _record_event(mapper, connection, target, "CREATED")

@event.listens_for(Base, "after_update", propagate=True)
def after_update(mapper, connection, target):
    _record_event(mapper, connection, target, "UPDATED")

@event.listens_for(Base, "after_delete", propagate=True)
def after_delete(mapper, connection, target):
    _record_event(mapper, connection, target, "DELETED")
