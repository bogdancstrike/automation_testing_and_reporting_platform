"""Comment endpoints for tests and runs."""
from __future__ import annotations

from src.api._helpers import json_body
from src.comments import service
from src.core.db import session_scope
from src.iam.decorators import require_authenticated


def _author(principal) -> str:
    return getattr(principal, "username", None) or getattr(principal, "subject", None) or "unknown"


@require_authenticated
def list_test_comments(app, operation, request, scenario_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return {"items": service.list_comments(db, "test", scenario_id)}, 200


@require_authenticated
def create_test_comment(app, operation, request, scenario_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_comment(db, "test", scenario_id, json_body(request), author=_author(principal)), 201


@require_authenticated
def list_run_comments(app, operation, request, run_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return {"items": service.list_comments(db, "run", run_id)}, 200


@require_authenticated
def create_run_comment(app, operation, request, run_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_comment(db, "run", run_id, json_body(request), author=_author(principal)), 201
