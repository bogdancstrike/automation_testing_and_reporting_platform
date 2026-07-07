"""Imperative scenario clients exposed on the context: ``ctx.http``, ``ctx.cli``,
``ctx.browser``. Each returns a fluent result whose ``.should`` records assertions
on the context and fails fast."""
from __future__ import annotations

import json as _json
import subprocess
import time
from typing import Any
from urllib.parse import urljoin

import requests

from src.config import Config
from src.testkit.fluent import Response


class HttpClient:
    """Target-bound HTTP client. All requests go through the SSRF guard."""

    def __init__(self, ctx, target_key: str = "default"):
        self._ctx = ctx
        self._target_key = target_key
        self._session = requests.Session()

    def _url(self, path: str) -> str:
        path = self._ctx.render(str(path))
        if path.startswith("http://") or path.startswith("https://"):
            return path
        base = self._ctx.target(self._target_key).base_url
        return urljoin(base.rstrip("/") + "/", path.lstrip("/")) if base else path

    def request(self, method: str, path: str, *, json: Any = None, data: Any = None,
                text: str | None = None, headers: dict[str, str] | None = None,
                params: dict[str, Any] | None = None, auth: dict[str, Any] | None = None,
                timeout_ms: int | None = None, follow_redirects: bool = True,
                tls_verify: bool = True) -> Response:
        from src.testkit.adapters.http import _apply_auth
        from src.testkit.http_exec import perform_request

        hdrs = dict(self._ctx.target(self._target_key).default_headers)
        for k, v in (headers or {}).items():
            hdrs[str(k)] = self._ctx.render(str(v))
        _apply_auth(hdrs, auth, self._ctx)

        body: Any = None
        if json is not None:
            body = _json.dumps(json).encode("utf-8")
            hdrs.setdefault("Content-Type", "application/json")
        elif text is not None:
            body = self._ctx.render(text).encode("utf-8")
            hdrs.setdefault("Content-Type", "text/plain")
        elif isinstance(data, dict):
            from urllib.parse import urlencode
            body = urlencode({k: self._ctx.render(str(v)) for k, v in data.items()}).encode("utf-8")
            hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
        elif data is not None:
            body = data

        param_pairs = [(str(k), self._ctx.render(str(v))) for k, v in (params or {}).items()]
        url = self._url(path)
        self._ctx.log("info", f"{method.upper()} {url}")
        raw = perform_request(
            method=method, url=url, headers=hdrs, params=param_pairs, body=body,
            timeout_ms=timeout_ms, follow_redirects=follow_redirects,
            tls_verify=tls_verify, session=self._session,
        )
        self._ctx._last_response = raw
        self._ctx.log("info", f"-> {raw.get('status_code')} in {raw.get('elapsed_ms')}ms")
        return Response(self._ctx, raw)

    def get(self, path: str, **kw) -> Response:
        return self.request("GET", path, **kw)

    def post(self, path: str, **kw) -> Response:
        return self.request("POST", path, **kw)

    def put(self, path: str, **kw) -> Response:
        return self.request("PUT", path, **kw)

    def patch(self, path: str, **kw) -> Response:
        return self.request("PATCH", path, **kw)

    def delete(self, path: str, **kw) -> Response:
        return self.request("DELETE", path, **kw)

    def head(self, path: str, **kw) -> Response:
        return self.request("HEAD", path, **kw)


class CliResult:
    """Result of a ``ctx.cli.run(...)`` with fluent assertions."""

    def __init__(self, ctx, command: str, exit_code: int, stdout: str, stderr: str, duration_ms: int):
        self._ctx = ctx
        self.command = command
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        self.duration_ms = duration_ms

    @property
    def should(self) -> "CliShould":
        return CliShould(self)


class CliShould:
    def __init__(self, result: CliResult):
        self._r = result

    def succeed(self) -> "CliShould":
        return self.have_exit_code(0)

    def fail(self) -> "CliShould":
        ok = self._r.exit_code != 0
        self._r._ctx.assert_that("cli_exit", "not_equals", 0, self._r.exit_code, ok,
                                 target="exit_code", message="" if ok else "expected non-zero exit")
        return self

    def have_exit_code(self, code: int) -> "CliShould":
        ok = self._r.exit_code == code
        self._r._ctx.assert_that("cli_exit", "equals", code, self._r.exit_code, ok,
                                 target="exit_code",
                                 message="" if ok else f"exit {self._r.exit_code} != {code}; stderr={self._r.stderr[:200]}")
        return self

    def output_contains(self, text: str) -> "CliShould":
        ok = text in self._r.stdout
        self._r._ctx.assert_that("cli_stdout", "contains", text, self._r.stdout, ok, target="stdout")
        return self

    def output_matches(self, pattern: str) -> "CliShould":
        import re
        ok = re.search(pattern, self._r.stdout) is not None
        self._r._ctx.assert_that("cli_stdout", "matches", pattern, self._r.stdout, ok, target="stdout")
        return self

    def stderr_contains(self, text: str) -> "CliShould":
        ok = text in self._r.stderr
        self._r._ctx.assert_that("cli_stderr", "contains", text, self._r.stderr, ok, target="stderr")
        return self

    def complete_within_ms(self, ms: int) -> "CliShould":
        ok = self._r.duration_ms <= ms
        self._r._ctx.assert_that("cli_time", "lte", ms, self._r.duration_ms, ok, target="duration_ms")
        return self


class CliClient:
    """Run a command (or a container CLI such as newman/k6) and capture output."""

    def __init__(self, ctx):
        self._ctx = ctx

    def run(self, command, *, cwd: str | None = None, env: dict[str, str] | None = None,
            input_text: str | None = None, timeout_s: float | None = None) -> CliResult:
        shell = isinstance(command, str)
        rendered = self._ctx.render(command) if shell else [self._ctx.render(str(c)) for c in command]
        timeout = timeout_s or (Config.REQUEST_MAX_TIMEOUT_MS / 1000.0)
        self._ctx.log("info", f"cli: {rendered if shell else ' '.join(rendered)}")
        started = time.monotonic()
        try:
            proc = subprocess.run(
                rendered, shell=shell, cwd=cwd, env=env, input=input_text,
                capture_output=True, text=True, timeout=timeout,
            )
            code, out, err = proc.returncode, proc.stdout, proc.stderr
        except subprocess.TimeoutExpired as e:
            code, out, err = 124, (e.stdout or "") if isinstance(e.stdout, str) else "", f"timeout after {timeout}s"
        dur = int((time.monotonic() - started) * 1000)
        return CliResult(self._ctx, rendered if shell else " ".join(rendered), code, out or "", err or "", dur)


class BrowserClient:
    """Playwright-backed browser session. Requires the ``playwright`` package and
    installed browsers (use a Playwright-enabled worker image). Raises a clear
    error otherwise so the run is reported as an infra error, not a silent pass."""

    def __init__(self, ctx):
        self._ctx = ctx
        self._pw = None
        self._browser = None

    def _ensure(self):
        if self._browser is not None:
            return
        try:
            from playwright.sync_api import sync_playwright
        except Exception as e:  # pragma: no cover - depends on image
            raise RuntimeError(
                "playwright is not installed in this worker image; use a "
                "Playwright-enabled image to run browser scenarios"
            ) from e
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)

    def visit(self, path: str = "/") -> "PageResult":
        self._ensure()
        url = path
        if not (path.startswith("http://") or path.startswith("https://")):
            base = self._ctx.target().base_url
            url = urljoin(base.rstrip("/") + "/", self._ctx.render(path).lstrip("/"))
        self._ctx.log("info", f"browser visit {url}")
        page = self._browser.new_page()
        started = time.monotonic()
        resp = page.goto(url, wait_until="load")
        dur = int((time.monotonic() - started) * 1000)
        return PageResult(self._ctx, page, resp.status if resp else 0, dur)

    def close(self) -> None:
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception:  # pragma: no cover
            pass
        self._browser = self._pw = None


class PageResult:
    def __init__(self, ctx, page, status: int, duration_ms: int):
        self._ctx = ctx
        self.page = page
        self.status = status
        self.duration_ms = duration_ms

    @property
    def should(self) -> "PageShould":
        return PageShould(self)


class PageShould:
    def __init__(self, result: PageResult):
        self._r = result

    def have_status(self, code: int) -> "PageShould":
        ok = self._r.status == code
        self._r._ctx.assert_that("page_status", "equals", code, self._r.status, ok, target="status")
        return self

    def have_title_containing(self, text: str) -> "PageShould":
        title = self._r.page.title()
        ok = text in title
        self._r._ctx.assert_that("page_title", "contains", text, title, ok, target="title")
        return self

    def show_text(self, text: str) -> "PageShould":
        content = self._r.page.content()
        ok = text in content
        self._r._ctx.assert_that("page_text", "contains", text, None, ok, target="body",
                                 message="" if ok else f"text {text!r} not found on page")
        return self

    def have_visible(self, selector: str) -> "PageShould":
        ok = bool(self._r.page.is_visible(selector))
        self._r._ctx.assert_that("page_selector", "exists", selector, None, ok, target=selector)
        return self
