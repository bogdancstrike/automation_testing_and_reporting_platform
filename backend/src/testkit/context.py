"""Execution context handed to every test/adapter.

Resolves the app-under-test (target) URL, variables, and secrets, and collects
structured log lines. This is how a test addresses *any* app without hard-coding
a URL.
"""
from __future__ import annotations

import contextlib
import re
import time
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

    # ── Imperative scenario state (filled while a Scenario.test() runs) ─────
    _steps: list[Any] = field(default_factory=list)
    _assertions: list[Any] = field(default_factory=list)
    _current_step: str | None = None
    _last_response: dict[str, Any] | None = None
    _http: Any = None
    _cli: Any = None
    _browser: Any = None

    # ── Targets / variables ────────────────────────────────────────────────
    def target(self, key: str = "default") -> ResolvedTarget:
        if key in self.targets:
            return self.targets[key]
        if self.targets:
            return next(iter(self.targets.values()))
        return ResolvedTarget(key=key, base_url="")

    def set_var(self, name: str, value: Any) -> None:
        self.variables[str(name)] = "" if value is None else str(value)

    def get_var(self, name: str, default: str = "") -> str:
        return self.variables.get(name, default)

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

    # ── Imperative scenario API ────────────────────────────────────────────
    @property
    def http(self) -> Any:
        """Fluent HTTP client bound to the resolved target (SSRF-guarded)."""
        if self._http is None:
            from src.testkit.clients import HttpClient
            self._http = HttpClient(self)
        return self._http

    @property
    def cli(self) -> Any:
        """Run local commands / container CLIs and assert on exit code + output."""
        if self._cli is None:
            from src.testkit.clients import CliClient
            self._cli = CliClient(self)
        return self._cli

    @property
    def browser(self) -> Any:
        """Playwright browser session bound to the resolved target base URL."""
        if self._browser is None:
            from src.testkit.clients import BrowserClient
            self._browser = BrowserClient(self)
        return self._browser

    @contextlib.contextmanager
    def step(self, name: str):
        """Group actions/assertions into a named step shown in run detail.

            with ctx.step("Check Health"):
                ctx.http.get("/health").should.have_status(200)
        """
        from src.testkit.fluent import AssertionFailure
        from src.testkit.result import ERROR, FAILED, PASSED, StepResult

        started = time.monotonic()
        prev, self._current_step = self._current_step, name
        status, error = PASSED, None
        self.log("info", f"step: {name}")
        try:
            yield
        except AssertionFailure as e:
            status, error = FAILED, str(e)
            raise
        except Exception as e:  # noqa: BLE001
            status, error = ERROR, str(e)
            raise
        finally:
            dur = int((time.monotonic() - started) * 1000)
            self._steps.append(StepResult(
                name=name, status=status, duration_ms=dur, error=error,
                step_id=f"step-{len(self._steps) + 1}"))
            self._current_step = prev

    def _record_assertion(self, assertion: Any) -> None:
        self._assertions.append(assertion)

    def assert_that(self, source: str, operator: str, expected: Any, actual: Any,
                    passed: bool, *, target: str | None = None, message: str = "") -> None:
        """Record a custom AssertionResult (used by non-HTTP clients); fail-fast."""
        from src.testkit.fluent import AssertionFailure
        from src.testkit.result import AssertionResult

        ar = AssertionResult(source=source, operator=operator, expected=expected,
                             actual=actual, passed=passed, target=target, message=message)
        self._assertions.append(ar)
        if not passed:
            raise AssertionFailure(message or f"expected {source} {operator} {expected!r}, got {actual!r}")

    def _begin_scenario(self) -> None:
        self._steps = []
        self._assertions = []
        self._current_step = None
        self._last_response = None

    def _redact(self, text: str) -> str:
        for secret in self.secret_values():
            if secret and secret in text:
                text = text.replace(secret, "***")
        return text
