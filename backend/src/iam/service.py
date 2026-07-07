"""Build a Principal from verified Keycloak claims."""
from __future__ import annotations

from typing import Any

from src.iam.principal import Principal


def principal_from_claims(claims: dict[str, Any]) -> Principal:
    realm_roles = set((claims.get("realm_access") or {}).get("roles") or [])
    # Keep only QTP roles (Keycloak adds default roles like 'offline_access').
    roles = frozenset(r for r in realm_roles if r.startswith("qtp_"))
    return Principal(
        subject=claims.get("sub", ""),
        username=claims.get("preferred_username"),
        email=claims.get("email"),
        roles=roles,
    )


def synthetic_admin() -> Principal:
    """Used only when AUTH_DISABLED=true for local smoke tests."""
    from src.iam.principal import ROLE_ADMIN
    return Principal(subject="dev-admin", username="admin", email="admin@qtp.local",
                     roles=frozenset({ROLE_ADMIN}))
