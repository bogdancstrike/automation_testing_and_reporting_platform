"""Dashboard endpoints."""
from __future__ import annotations

from src.api._helpers import query_args
from src.core.db import session_scope
from src.iam.decorators import require_authenticated
from src.reporting import service


from datetime import datetime

@require_authenticated
def overview(app, operation, request, principal=None, **kwargs):
    args = query_args(request)
    hours = int(args.get("hours", 24))
    start = datetime.fromisoformat(args["start_time"]) if args.get("start_time") else None
    end = datetime.fromisoformat(args["end_time"]) if args.get("end_time") else None
    with session_scope() as db:
        return service.overview(db, hours=hours, start=start, end=end), 200


@require_authenticated
def failures(app, operation, request, principal=None, **kwargs):
    args = query_args(request)
    hours = int(args.get("hours", 168))
    start = datetime.fromisoformat(args["start_time"]) if args.get("start_time") else None
    end = datetime.fromisoformat(args["end_time"]) if args.get("end_time") else None
    with session_scope() as db:
        return service.failures(db, hours=hours, start=start, end=end), 200
