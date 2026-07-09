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
        """Group actions/assertions into a named step shown in run detail."""
        from src.testkit.fluent import AssertionFailure
        from src.testkit.result import ERROR, FAILED, PASSED, StepResult

        started = time.monotonic()
        step_id = f"step-{len(self._steps) + 1}"
        prev, self._current_step = self._current_step, name
        prev_id, getattr_current_step_id = getattr(self, '_current_step_id', None), step_id
        self._current_step_id = step_id
        
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
            start_ms = int((started - getattr(self, '_scenario_start_time', started)) * 1000)
            self._steps.append(StepResult(
                name=name, status=status, duration_ms=dur, error=error,
                step_id=step_id,
                timings={"start_ms": start_ms, "is_step_block": True, "step_id": step_id}
            ))
            self._current_step = prev
            self._current_step_id = prev_id

    def record_network_call(self, method: str, url: str, status_code: int, duration_ms: int, dns: int=0, ttfb: int=0, download: int=0, content_type: str="", content_length: int=0, payload: dict | None = None) -> None:
        import time
        from src.testkit.result import PASSED, FAILED, StepResult
        
        # N+1 / Duplicate Call Detection
        call_key = f"{method} {url}"
        now = time.monotonic()
        history = self._network_history.setdefault(call_key, [])
        
        # If the exact same request was made within the last 1.5 seconds, flag it
        # Exclude OPTIONS (preflights) which are naturally duplicated before varying methods
        if history and (now - history[-1]) < 1.5 and method != "OPTIONS":
            # Avoid flagging static assets typically requested by browsers
            if not any(url.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".gif", ".css", ".js", ".woff2", ".ico")):
                self.record_event(
                    name=f"N+1 Duplicate: {method}",
                    event_type="warning",
                    status="failed",
                    details={
                        "message": f"Identical request made within 1.5s of the previous call. Count: {len(history) + 1}",
                        "url": url
                    }
                )
        history.append(now)

        st = PASSED if 200 <= status_code < 400 else FAILED
        # Network calls usually report duration, so start time is roughly now - duration
        start_ms = int((time.monotonic() - getattr(self, '_scenario_start_time', time.monotonic())) * 1000) - duration_ms
        start_ms = max(0, start_ms)
        self._steps.append(StepResult(
            name=f"{method} {url}",
            status=st,
            duration_ms=duration_ms,
            step_id=f"net-{len(self._steps) + 1}",
            timings={
                "start_ms": start_ms,
                "dns": dns, "ttfb": ttfb, "download": download,
                "method": method, "url": url, "status_code": status_code,
                "content_type": content_type, "content_length": content_length,
                "is_network": True,
                "payload": payload or {},
                "step_id": f"net-{len(self._steps) + 1}",
                "parent_step_id": getattr(self, '_current_step_id', None)
            }
        ))

    def record_event(self, name: str, event_type: str, status: str = "passed", details: dict | None = None) -> None:
        import time
        from src.testkit.result import StepResult
        start_ms = int((time.monotonic() - getattr(self, '_scenario_start_time', time.monotonic())) * 1000)
        self._steps.append(StepResult(
            name=name,
            status=status,
            duration_ms=0,
            step_id=f"evt-{len(self._steps) + 1}",
            timings={
                "start_ms": start_ms,
                "is_event": True,
                "event_type": event_type,
                "details": details or {},
                "step_id": f"evt-{len(self._steps) + 1}",
                "parent_step_id": getattr(self, '_current_step_id', None)
            }
        ))

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
        
        # Also plot this assertion as an event in the timeline
        self.record_event(
            name=f"Assertion: {source} {operator}",
            event_type="assertion",
            status="passed" if passed else "failed",
            details={"expected": expected, "actual": actual, "message": message}
        )
        
        if not passed:
            raise AssertionFailure(message or f"expected {source} {operator} {expected!r}, got {actual!r}")

    def _begin_scenario(self) -> None:
        import time
        self._scenario_start_time = time.monotonic()
        self._steps = []
        self._assertions = []
        self._current_step: StepResult | None = None
        self._current_step_id: str | None = None
        self._last_response: Any = None
        self._network_history: dict[str, list[float]] = {}

    def _redact(self, text: str) -> str:
        for secret in self.secret_values():
            if secret and secret in text:
                text = text.replace(secret, "***")
        return text
