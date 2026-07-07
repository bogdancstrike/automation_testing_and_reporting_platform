"""Targets (apps-under-test) endpoints."""
from __future__ import annotations

from sqlalchemy import select
from src.api._helpers import json_body, query_args
from src.catalog import service
from src.catalog.models import Target, TestDefinition
from src.core.db import session_scope
from src.execution import service as exec_service
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_PROJECT_ADMIN, ROLE_OPERATOR


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
    from src.core.errors import ValidationError
    args = query_args(request)
    try:
        hours = int(args.get("hours", 168))
    except ValueError:
        raise ValidationError("invalid hours format")
    with session_scope() as db:
        return service.target_stats(db, target_id, hours=hours), 200


@require_role(ROLE_PROJECT_ADMIN)
def create_target(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return service.create_target(db, json_body(request)), 201


@require_role(ROLE_PROJECT_ADMIN)
def update_target(app, operation, request, target_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.update_target(db, target_id, json_body(request)), 200


@require_role(ROLE_OPERATOR)
def run_all_target_tests(app, operation, request, target_id=None, principal=None, **kwargs):
    from src.api._helpers import query_args
    import time
    from src.execution.models import TestRun
    from src.execution import serializers

    sync_mode = query_args(request).get("sync", "").lower() == "true"

    with session_scope() as db:
        target = db.get(Target, target_id)
        if not target:
            return {"error": "target not found"}, 404
        tests = db.scalars(select(TestDefinition).where(TestDefinition.target_key == target.key)).all()
        queued = []
        test_map = {}
        for t in tests:
            test_map[t.id] = t
            queued.append(exec_service.run_now(db, t.id, environment="default"))
        
        if not sync_mode:
            return {"items": queued}, 202

    # Sync mode: Wait for completion
    run_ids = [r["id"] for r in queued]
    timeout = time.time() + 120  # 2 minutes max wait for API boundary
    
    while time.time() < timeout:
        with session_scope() as db:
            runs = db.scalars(select(TestRun).where(TestRun.id.in_(run_ids))).all()
            all_done = all(r.status not in ("queued", "running") for r in runs)
            if all_done:
                return {"items": [serializers.run_detail(r, test_name=test_map[r.test_definition_id].name, target_key=target.key, tags=test_map[r.test_definition_id].tags) for r in runs]}, 200
        time.sleep(1)

    # Timeout reached, return current statuses
    with session_scope() as db:
        runs = db.scalars(select(TestRun).where(TestRun.id.in_(run_ids))).all()
        return {"items": [serializers.run_detail(r, test_name=test_map[r.test_definition_id].name, target_key=target.key, tags=test_map[r.test_definition_id].tags) for r in runs]}, 207
