"""Reusable tag endpoints."""
from __future__ import annotations

from src.api._helpers import json_body, query_args
from src.comments import service
from src.core.db import session_scope
from src.iam.decorators import require_authenticated


@require_authenticated
def list_tags(app, operation, request, principal=None, **kwargs):
    q = query_args(request).get("q", "")
    with session_scope() as db:
        return {"items": service.list_tags(db, q)}, 200


@require_authenticated
def update_test_tags(app, operation, request, test_id=None, principal=None, **kwargs):
    body = json_body(request)
    with session_scope() as db:
        return service.update_test_tags(db, test_id, body.get("tags") or []), 200
