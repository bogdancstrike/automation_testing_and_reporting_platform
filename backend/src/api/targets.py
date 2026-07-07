"""Targets (apps-under-test) endpoints."""
from __future__ import annotations

from src.api._helpers import json_body, query_args
from src.catalog import service
from src.core.db import session_scope
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_PROJECT_ADMIN


@require_authenticated
def list_targets(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.list_targets_page(db, query_args(request)), 200


@require_authenticated
def get_target(app, operation, request, target_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.get_target_detail(db, target_id), 200


@require_authenticated
def target_tests(app, operation, request, target_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.target_tests(db, target_id, query_args(request)), 200


@require_authenticated
def target_runs(app, operation, request, target_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.target_runs(db, target_id, query_args(request)), 200


@require_authenticated
def target_stats(app, operation, request, target_id=None, principal=None, **kwargs):
    args = query_args(request)
    with session_scope() as db:
        return service.target_stats(db, target_id, hours=int(args.get("hours", 168))), 200


@require_role(ROLE_PROJECT_ADMIN)
def create_target(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_target(db, json_body(request)), 201


@require_role(ROLE_PROJECT_ADMIN)
def update_target(app, operation, request, target_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.update_target(db, target_id, json_body(request)), 200
