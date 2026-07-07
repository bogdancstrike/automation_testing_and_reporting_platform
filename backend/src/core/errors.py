"""Domain error hierarchy + Flask error handlers.

Handlers return ``(body, status)`` tuples; flask-restx serializes the body.
"""
from __future__ import annotations

from typing import Any


class QtpError(Exception):
    code = "error"
    status_code = 500

    def __init__(self, message: str = "", *, details: dict[str, Any] | None = None):
        super().__init__(message or self.code)
        self.message = message or self.code
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {"error": self.code, "message": self.message}
        if self.details:
            body["details"] = self.details
        return body


class ValidationError(QtpError):
    code = "validation_error"
    status_code = 400


class AuthenticationError(QtpError):
    code = "authentication_error"
    status_code = 401


class PermissionDeniedError(QtpError):
    code = "permission_denied"
    status_code = 403


class NotFoundError(QtpError):
    code = "not_found"
    status_code = 404


class ConflictError(QtpError):
    code = "conflict"
    status_code = 409


def install_flask_error_handlers(app) -> None:
    """Catch uncaught exceptions so the API never leaks a stack trace."""
    from framework.commons.logger import logger as log

    @app.errorhandler(QtpError)
    def _handle_domain(err: QtpError):
        return err.to_dict(), err.status_code

    @app.errorhandler(Exception)
    def _handle_unexpected(err: Exception):  # pragma: no cover
        from werkzeug.exceptions import HTTPException
        if isinstance(err, HTTPException):
            return {"error": err.name, "message": err.description}, err.code
        log.exception(f"unhandled error: {err}")
        return {"error": "internal_error", "message": "internal server error"}, 500
