"""Dashboard endpoints."""
from __future__ import annotations

from src.api._helpers import query_args
from src.core.db import session_scope
from src.iam.decorators import require_authenticated
from src.reporting import service


@require_authenticated
def overview(app, operation, request, principal=None, **kwargs):
    hours = int(query_args(request).get("hours", 24))
    with session_scope() as db:
        return service.overview(db, hours=hours), 200


@require_authenticated
def failures(app, operation, request, principal=None, **kwargs):
    hours = int(query_args(request).get("hours", 168))
    with session_scope() as db:
        return service.failures(db, hours=hours), 200
