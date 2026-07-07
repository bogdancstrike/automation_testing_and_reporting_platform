"""Test catalog endpoints."""
from __future__ import annotations

from src.api._helpers import json_body, query_args
from src.catalog import service
from src.core.db import session_scope
from src.execution import service as execution
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_OPERATOR, ROLE_TEST_AUTHOR


@require_authenticated
def list_tests(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.list_tests(db, query_args(request)), 200


@require_authenticated
def get_test(app, operation, request, test_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.get_test_detail(db, test_id), 200


@require_role(ROLE_TEST_AUTHOR)
def discover_tests(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.discover_tests(db), 200


@require_role(ROLE_OPERATOR)
def run_test(app, operation, request, test_id=None, principal=None, **kwargs):
    body = json_body(request)
    with session_scope() as db:
        return execution.run_now(db, test_id, environment=body.get("environment", "default")), 202
