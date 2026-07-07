"""JWT verification against Keycloak JWKS.

Split URLs matter in docker: we FETCH keys from the internal address
(``KEYCLOAK_JWKS_URL`` -> http://keycloak:8080) but VALIDATE the issuer against
the public address the browser used (``KEYCLOAK_ISSUER`` -> http://localhost:8080).
"""
from __future__ import annotations

import time
from typing import Any

import requests
from jose import jwt
from jose.exceptions import JWTError

from src.config import Config
from src.core.errors import AuthenticationError
from framework.commons.logger import logger as log


class _JwksCache:
    def __init__(self) -> None:
        self._keys: dict[str, dict] = {}
        self._fetched_at = 0.0

    def _stale(self) -> bool:
        return (time.time() - self._fetched_at) > Config.JWKS_CACHE_TTL

    def get(self, kid: str) -> dict | None:
        if kid in self._keys and not self._stale():
            return self._keys[kid]
        self._refresh()
        return self._keys.get(kid)

    def _refresh(self) -> None:
        try:
            r = requests.get(Config.KEYCLOAK_JWKS_URL, timeout=5)
            r.raise_for_status()
            self._keys = {k["kid"]: k for k in r.json().get("keys", [])}
            self._fetched_at = time.time()
        except Exception as e:
            log.warning(f"jwks fetch failed from {Config.KEYCLOAK_JWKS_URL}: {e}")


_jwks = _JwksCache()


def verify_token(token: str) -> dict[str, Any]:
    if not token:
        raise AuthenticationError("missing token")
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise AuthenticationError(f"malformed token: {e}")

    kid = header.get("kid")
    if not kid:
        raise AuthenticationError("token missing kid")
    key = _jwks.get(kid)
    if key is None:
        raise AuthenticationError("unknown signing key")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            audience=Config.KEYCLOAK_AUDIENCE,
            issuer=Config.KEYCLOAK_ISSUER,
            options={"verify_at_hash": False},
        )
    except JWTError as e:
        raise AuthenticationError(f"token verification failed: {e}")
