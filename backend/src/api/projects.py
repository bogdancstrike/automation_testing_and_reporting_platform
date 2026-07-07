"""Projects endpoint."""
from __future__ import annotations

from src.catalog import service
from src.core.db import session_scope
from src.iam.decorators import require_authenticated


@require_authenticated
def list_projects(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return {"items": service.list_projects(db)}, 200
