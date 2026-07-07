"""Per-request correlation id, propagated to logs and run records."""
from __future__ import annotations

import uuid
from contextvars import ContextVar

from flask import g, request

_correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> str:
    cid = _correlation_id.get()
    if cid is None:
        cid = str(uuid.uuid4())
        _correlation_id.set(cid)
    return cid


def set_correlation_id(cid: str) -> None:
    _correlation_id.set(cid)


def install_flask_hooks(app) -> None:
    @app.before_request
    def _assign_correlation():
        cid = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
        set_correlation_id(cid)
        g.correlation_id = cid
        # Short-circuit CORS preflight so the SPA never hits a 405.
        if request.method == "OPTIONS":
            from flask import make_response
            return make_response("", 204)

    @app.after_request
    def _echo_correlation(response):
        cid = getattr(g, "correlation_id", None)
        if cid:
            response.headers["X-Correlation-Id"] = cid
        # CORS for the SPA (dev): the framework doesn't add these.
        from src.config import Config
        origin = request.headers.get("Origin")
        if origin and origin in Config.ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Correlation-Id"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
        return response
