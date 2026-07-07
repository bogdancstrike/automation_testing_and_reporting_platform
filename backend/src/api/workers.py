"""Workers endpoint."""
from __future__ import annotations

from src.core.db import session_scope
from src.iam.decorators import require_authenticated
from src.reporting import service


@require_authenticated
def list_workers(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return {"items": service.workers(db)}, 200
