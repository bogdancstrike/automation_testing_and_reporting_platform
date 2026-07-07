"""Current-user endpoint."""
from __future__ import annotations

from src.iam.decorators import require_authenticated


@require_authenticated
def me(app, operation, request, principal=None, **kwargs):
    return {
        "subject": principal.subject,
        "username": principal.username,
        "email": principal.email,
        "roles": sorted(principal.effective_roles),
        "is_admin": principal.is_admin,
    }, 200
