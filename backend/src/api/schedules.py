"""Schedule endpoints."""
from __future__ import annotations

from src.api._helpers import json_body, query_args
from src.core.db import session_scope
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_OPERATOR, ROLE_TEST_AUTHOR
from src.scheduling import service


@require_authenticated
def list_schedules(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.list_schedules(db, query_args(request)), 200


@require_role(ROLE_TEST_AUTHOR)
def create_schedule(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_schedule(db, json_body(request)), 201


@require_role(ROLE_TEST_AUTHOR)
def update_schedule(app, operation, request, schedule_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.update_schedule(db, schedule_id, json_body(request)), 200


@require_role(ROLE_OPERATOR)
def delete_schedule(app, operation, request, schedule_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.delete_schedule(db, schedule_id), 200
