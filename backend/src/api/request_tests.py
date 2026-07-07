"""Request builder endpoints: send unsaved, save, update."""
from __future__ import annotations

from src.api._helpers import json_body
from src.catalog import service
from src.catalog.service import default_project, resolve_target
from src.core.db import session_scope
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_OPERATOR, ROLE_TEST_AUTHOR
from src.testkit.adapters.http import execute_http
from src.testkit.context import ResolvedTarget, TestContext


def _adhoc_context(db, config: dict) -> TestContext:
    ctx = TestContext()
    target_key = config.get("target")
    if target_key:
        project = default_project(db)
        t = resolve_target(db, project.id, target_key)
        if t:
            ctx.targets[t.key] = ResolvedTarget(t.key, t.base_url, dict(t.default_headers or {}))
            ctx.variables["base_url"] = t.base_url
    # inline variables for quick testing
    for k, v in (config.get("variables") or {}).items():
        ctx.variables[str(k)] = str(v)
    return ctx


@require_role(ROLE_OPERATOR)
def send_request(app, operation, request, principal=None, **kwargs):
    config = json_body(request)
    with session_scope() as db:
        ctx = _adhoc_context(db, config)
    result = execute_http(config, ctx)
    return {
        "status": result.status,
        "response": result.response,
        "assertions": [a.to_dict() for a in result.assertions],
        "logs": ctx.logs(),
        "error_category": result.error_category,
        "error_message": result.error_message,
    }, 200


@require_role(ROLE_TEST_AUTHOR)
def create_request_test(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_request_test(db, json_body(request)), 201


@require_role(ROLE_TEST_AUTHOR)
def update_request_test(app, operation, request, test_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.update_request_test(db, test_id, json_body(request)), 200


@require_role(ROLE_TEST_AUTHOR)
def delete_request_test(app, operation, request, test_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.delete_request_test(db, test_id), 200
