"""Audit explorer endpoints."""
from flask import request as flask_request

from src.core.db import session_scope
from src.iam.decorators import require_authenticated
from src.audit.serializers import serialize_audit_event
from src.audit import service as audit_service


def _limit() -> int:
    try:
        return int(flask_request.args.get("limit") or 100)
    except ValueError:
        return 100


@require_authenticated
def list_audit(app, operation, request, principal=None, **kwargs):
    actor_username = getattr(principal, "username", None) or getattr(principal, "subject", None)
    with session_scope() as db:
        events = audit_service.list_(
            db,
            actor=actor_username,
            action=flask_request.args.get("action"),
            entity_type=flask_request.args.get("entity_type"),
            entity_id=flask_request.args.get("entity_id"),
            correlation_id=flask_request.args.get("correlation_id"),
            created_after=flask_request.args.get("created_after"),
            created_before=flask_request.args.get("created_before"),
            sort_by=flask_request.args.get("sort_by", "created_at"),
            sort_dir=flask_request.args.get("sort_dir", "desc"),
            limit=_limit(),
        )
        return ({"items": [serialize_audit_event(e) for e in events]}, 200)


@require_authenticated
def entity_audit(app, operation, request, entity_type=None, entity_id=None, principal=None, **kwargs):
    with session_scope() as db:
        events = audit_service.get_for_entity(db, entity_type, entity_id, limit=_limit())
        return ({"items": [serialize_audit_event(e) for e in events]}, 200)
