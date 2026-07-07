"""Targets (apps-under-test) endpoints."""
from __future__ import annotations

from src.api._helpers import json_body
from src.catalog import service
from src.core.db import session_scope
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_PROJECT_ADMIN


@require_authenticated
def list_targets(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return {"items": service.list_targets(db)}, 200


@require_role(ROLE_PROJECT_ADMIN)
def create_target(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_target(db, json_body(request)), 201


@require_role(ROLE_PROJECT_ADMIN)
def update_target(app, operation, request, target_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.update_target(db, target_id, json_body(request)), 200
