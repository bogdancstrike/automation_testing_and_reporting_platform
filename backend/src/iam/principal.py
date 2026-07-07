"""The Principal — what every authorized handler receives."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

# QTP realm roles (see architecture section 20). The seeded deployment ships a
# single user holding qtp_admin, which implies all lower privileges.
ROLE_ADMIN         = "qtp_admin"
ROLE_PROJECT_ADMIN = "qtp_project_admin"
ROLE_TEST_AUTHOR   = "qtp_test_author"
ROLE_OPERATOR      = "qtp_operator"
ROLE_VIEWER        = "qtp_viewer"
ROLE_AUDITOR       = "qtp_auditor"

ALL_ROLES = frozenset({
    ROLE_ADMIN, ROLE_PROJECT_ADMIN, ROLE_TEST_AUTHOR,
    ROLE_OPERATOR, ROLE_VIEWER, ROLE_AUDITOR,
})


@dataclass(frozen=True)
class Principal:
    subject: str
    username: str | None = None
    email: str | None = None
    roles: frozenset[str] = field(default_factory=frozenset)

    @property
    def effective_roles(self) -> frozenset[str]:
        # Admin implies every capability.
        return ALL_ROLES if ROLE_ADMIN in self.roles else self.roles

    @property
    def is_admin(self) -> bool:
        return ROLE_ADMIN in self.roles

    def has_role(self, role: str) -> bool:
        return role in self.effective_roles

    def has_any(self, roles: Iterable[str]) -> bool:
        eff = self.effective_roles
        return any(r in eff for r in roles)
