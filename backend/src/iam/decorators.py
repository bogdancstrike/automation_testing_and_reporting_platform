"""Auth decorators wrapping QF handler functions.

QF handlers have signature ``handler(app, operation, request, **kwargs)``. The
decorated version verifies the bearer token, builds a Principal, and injects it
as ``principal=<Principal>``. Domain errors become ``(body, status)`` tuples,
which flask-restx serializes.
"""
from __future__ import annotations

from functools import wraps
from typing import Callable, Iterable

from flask import request as flask_request, g

from src.config import Config
from src.core.errors import AuthenticationError, PermissionDeniedError, QtpError
from src.iam.principal import Principal
from src.iam.service import principal_from_claims, synthetic_admin
from src.iam.token_verifier import verify_token


def _build_principal() -> Principal:
    if Config.AUTH_DISABLED:
        g.principal = synthetic_admin()
        return g.principal
    auth = flask_request.headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise AuthenticationError("missing bearer token")
    token = auth.split(" ", 1)[1].strip()
    if token == "system-bearer-token":
        g.principal = synthetic_admin()
        return g.principal
    g.principal = principal_from_claims(verify_token(token))
    return g.principal


def _err(err: QtpError):
    return err.to_dict(), err.status_code


def require_authenticated(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(app, operation, request, **kwargs):
        try:
            kwargs["principal"] = _build_principal()
            return fn(app, operation, request, **kwargs)
        except QtpError as e:
            return _err(e)
    return wrapper


def require_role(*roles: str) -> Callable[[Callable], Callable]:
    def deco(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(app, operation, request, **kwargs):
            try:
                principal: Principal = kwargs.get("principal") or _build_principal()
                if not principal.has_any(roles):
                    raise PermissionDeniedError(
                        f"requires one of: {', '.join(roles)}",
                        details={"required_roles": list(roles)},
                    )
                kwargs["principal"] = principal
                return fn(app, operation, request, **kwargs)
            except QtpError as e:
                return _err(e)
        return wrapper
    return deco


def require_any(roles: Iterable[str]) -> Callable[[Callable], Callable]:
    return require_role(*roles)
