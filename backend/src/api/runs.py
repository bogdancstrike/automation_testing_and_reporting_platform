"""Run endpoints: list, detail, logs, cancel, defect triage."""
from __future__ import annotations

from sqlalchemy import select

from src.api._helpers import json_body, query_args
from src.core.db import session_scope
from src.core.errors import NotFoundError
from src.execution import service
from src.execution.models import RunLog, TestRun
from src.iam.decorators import require_authenticated, require_role
from src.iam.principal import ROLE_OPERATOR


@require_authenticated
def list_runs(app, operation, request, principal=None, **kwargs):
    with session_scope() as db:
        return {"items": service.list_runs(db, query_args(request))}, 200


@require_authenticated
def get_run(app, operation, request, run_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.get_run_detail(db, run_id), 200


@require_authenticated
def get_run_logs(app, operation, request, run_id=None, principal=None, **kwargs):
    args = query_args(request)
    after_id = int(args.get("after_id", 0))
    limit = min(int(args.get("limit", 500)), 1000)
    with session_scope() as db:
        if not db.get(TestRun, run_id):
            raise NotFoundError("run not found")
        rows = db.scalars(
            select(RunLog).where(RunLog.test_run_id == run_id, RunLog.id > after_id)
            .order_by(RunLog.id).limit(limit)
        ).all()
        items = [{"id": r.id, "level": r.level, "message": r.message,
                  "context": r.context or {},
                  "created_at": r.created_at.isoformat() if r.created_at else None}
                 for r in rows]
    return {"items": items, "next_after_id": items[-1]["id"] if items else after_id}, 200


@require_role(ROLE_OPERATOR)
def cancel_run(app, operation, request, run_id=None, principal=None, **kwargs):
    with session_scope() as db:
        return service.cancel_run(db, run_id), 200


@require_role(ROLE_OPERATOR)
def set_defect(app, operation, request, run_id=None, principal=None, **kwargs):
    defect = json_body(request).get("defect_type", "")
    with session_scope() as db:
        return service.set_defect(db, run_id, defect), 200
