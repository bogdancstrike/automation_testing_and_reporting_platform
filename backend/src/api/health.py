"""Health endpoints (no auth)."""
from __future__ import annotations

from sqlalchemy import text

from src.core.db import get_engine


def health_check(app, operation, request, **kwargs):
    return {"status": "ok", "service": "qtp"}, 200


def liveness(app, operation, request, **kwargs):
    return {"status": "alive"}, 200


def readiness(app, operation, request, **kwargs):
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready"}, 200
    except Exception as e:
        return {"status": "not_ready", "error": str(e)}, 503
