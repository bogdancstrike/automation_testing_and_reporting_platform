"""Execution context handed to every test/adapter.

Resolves the app-under-test (target) URL, variables, and secrets, and collects
structured log lines. This is how a test addresses *any* app without hard-coding
a URL.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable

_TEMPLATE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


@dataclass
class ResolvedTarget:
    key: str
    base_url: str
    default_headers: dict[str, str] = field(default_factory=dict)


@dataclass
class TestContext:
    variables: dict[str, str] = field(default_factory=dict)
    secrets: dict[str, str] = field(default_factory=dict)
    targets: dict[str, ResolvedTarget] = field(default_factory=dict)
    correlation_id: str | None = None
    # Called by the runner; returns True when the run has been canceled.
    cancel_check: Callable[[], bool] | None = None
    _logs: list[dict[str, Any]] = field(default_factory=list)

    # ── Targets / variables ────────────────────────────────────────────────
    def target(self, key: str = "default") -> ResolvedTarget:
        if key in self.targets:
            return self.targets[key]
        if self.targets:
            return next(iter(self.targets.values()))
        return ResolvedTarget(key=key, base_url="")

    def render(self, text: str) -> str:
        """Substitute {{var}} / {{secret}} tokens in a string."""
        if not text:
            return text

        def _sub(m: re.Match) -> str:
            name = m.group(1)
            if name in self.variables:
                return str(self.variables[name])
            if name in self.secrets:
                return str(self.secrets[name])
            return m.group(0)

        return _TEMPLATE.sub(_sub, text)

    def secret_values(self) -> list[str]:
        """All secret values, for redaction before persisting logs/artifacts."""
        return [v for v in self.secrets.values() if v]

    # ── Logging ────────────────────────────────────────────────────────────
    def log(self, level: str, message: str, **ctx: Any) -> None:
        self._logs.append({"level": level, "message": self._redact(message), "context": ctx})

    def logs(self) -> list[dict[str, Any]]:
        return self._logs

    def should_cancel(self) -> bool:
        return bool(self.cancel_check and self.cancel_check())

    def _redact(self, text: str) -> str:
        for secret in self.secret_values():
            if secret and secret in text:
                text = text.replace(secret, "***")
        return text
