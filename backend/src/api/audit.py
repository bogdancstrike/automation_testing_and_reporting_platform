"""Audit explorer endpoints."""
from flask import request as flask_request

from src.api._helpers import query_args

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
        return audit_service.list_(db, actor=actor_username, filters=query_args(flask_request)), 200


@require_authenticated
def entity_audit(app, operation, request, entity_type=None, entity_id=None, principal=None, **kwargs):
    with session_scope() as db:
        events = audit_service.get_for_entity(db, entity_type, entity_id, limit=_limit())
        return ({"items": [serialize_audit_event(e) for e in events]}, 200)
