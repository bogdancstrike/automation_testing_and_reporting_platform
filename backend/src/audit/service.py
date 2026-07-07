from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session
from src.audit.models import AuditEvent
from framework.tracing import get_tracer

tracer = get_tracer()

def log_audit(db: Session, project_id: str, action: str, actor: str, 
              entity_type: str, entity_id: str, context: dict[str, Any] | None = None) -> AuditEvent:
    """Record a structured audit log entry."""
    with tracer.start_as_current_span("audit.log") as span:
        span.set_attribute("audit.action", action)
        span.set_attribute("audit.actor", actor)
        span.set_attribute("audit.entity_type", entity_type)
        span.set_attribute("audit.entity_id", entity_id)

        evt = AuditEvent(
            project_id=project_id,
            action=action,
            actor=actor or "unknown",
            entity_type=entity_type,
            entity_id=entity_id,
            context=context or {}
        )
        db.add(evt)
        db.flush()
        return evt
