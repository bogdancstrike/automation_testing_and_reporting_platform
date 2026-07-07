"""HTTP request adapter.

Executes a request-test config against a target, enforcing SSRF egress checks on
the initial URL and every redirect hop, then evaluates assertions against the
response body/headers/timing. Used by both the request builder (unsaved send)
and the runner (saved request tests).
"""
from __future__ import annotations

import time
from typing import Any
from urllib.parse import urljoin, urlparse

import requests

from src.config import Config
from src.core.errors import ValidationError
from src.core.net_guard import resolve_and_check
from src.testkit import assertions as asserts
from src.testkit.context import TestContext
from src.testkit.result import ERROR, FAILED, PASSED, TIMEOUT, StepResult, TestResult


def _enabled_pairs(items: list[dict[str, Any]] | None, ctx: TestContext) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for it in items or []:
        if it.get("enabled", True) is False:
            continue
        name = ctx.render(str(it.get("name", "")))
        value = ctx.render(str(it.get("value", "")))
        if name:
            out.append((name, value))
    return out


def _build_body(body: dict[str, Any] | None, ctx: TestContext) -> tuple[Any, str | None]:
    if not body:
        return None, None
    mode = body.get("mode", "none")
    raw = ctx.render(body.get("raw", "") or "")
    if mode == "json":
        return raw.encode("utf-8"), "application/json"
    if mode in ("text", "graphql"):
        return raw.encode("utf-8"), "text/plain"
    if mode == "form":
        return raw.encode("utf-8"), "application/x-www-form-urlencoded"
    return None, None


def _apply_auth(headers: dict[str, str], auth: dict[str, Any] | None, ctx: TestContext) -> None:
    if not auth:
        return
    atype = auth.get("type", "none")
    if atype == "bearer":
        ref = auth.get("tokenSecretRef") or auth.get("token")
        token = ctx.secrets.get(ref, "") if ref in ctx.secrets else ctx.render(str(ref or ""))
        if token:
            headers["Authorization"] = f"Bearer {token}"
    elif atype == "apikey":
        headers[auth.get("headerName", "X-API-Key")] = ctx.render(str(auth.get("value", "")))
    elif atype == "basic":
        import base64
        user = ctx.render(str(auth.get("username", "")))
        pwd = ctx.render(str(auth.get("password", "")))
        token = base64.b64encode(f"{user}:{pwd}".encode()).decode()
        headers["Authorization"] = f"Basic {token}"


def _resolve_url(config: dict[str, Any], ctx: TestContext) -> str:
    url = ctx.render(str(config.get("url", "")))
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = ctx.target(config.get("target", "default")).base_url
    if not base:
        return url
    return urljoin(base.rstrip("/") + "/", url.lstrip("/"))


def execute_http(config: dict[str, Any], ctx: TestContext) -> TestResult:
    started = time.monotonic()
    method = str(config.get("method", "GET")).upper()
    timeout_ms = min(int(config.get("timeoutMs", 30000)), Config.REQUEST_MAX_TIMEOUT_MS)
    tls_verify = bool(config.get("tlsVerify", True))
    follow = bool(config.get("followRedirects", True))
    max_bytes = Config.REQUEST_MAX_BODY_BYTES

    url = _resolve_url(config, ctx)
    if not url:
        return TestResult(status=ERROR, error_category="script_error",
                          error_message="request has no resolvable URL")

    headers = dict(ctx.target(config.get("target", "default")).default_headers)
    for name, value in _enabled_pairs(config.get("headers"), ctx):
        headers[name] = value
    _apply_auth(headers, config.get("auth"), ctx)

    body, default_ct = _build_body(config.get("body"), ctx)
    if body is not None and default_ct and not any(k.lower() == "content-type" for k in headers):
        headers["Content-Type"] = default_ct

    params = _enabled_pairs(config.get("query"), ctx)

    ctx.log("info", f"{method} {url}")
    session = requests.Session()
    hops = 0
    try:
        current_url = url
        current_method = method
        current_body: Any = body
        while True:
            resolve_and_check(current_url)  # SSRF check on every hop
            resp = session.request(
                current_method,
                current_url,
                params=params if hops == 0 else None,
                headers=headers,
                data=current_body,
                timeout=timeout_ms / 1000.0,
                allow_redirects=False,
                verify=tls_verify,
                stream=True,
            )
            if follow and resp.is_redirect and resp.next is not None:
                hops += 1
                if hops > Config.REQUEST_MAX_REDIRECTS:
                    raise requests.TooManyRedirects("max redirects exceeded")
                current_url = urljoin(current_url, resp.headers.get("Location", ""))
                # Redirects downgrade to GET on 303 / for non-GET on 301/302.
                if resp.status_code in (301, 302, 303) and current_method != "HEAD":
                    current_method, current_body = "GET", None
                resp.close()
                continue
            break

        raw = resp.raw.read(max_bytes + 1, decode_content=True) or b""
        truncated = len(raw) > max_bytes
        raw = raw[:max_bytes]
        body_text = raw.decode(resp.encoding or "utf-8", errors="replace")
        elapsed_ms = int((time.monotonic() - started) * 1000)

        response = {
            "status_code": resp.status_code,
            "headers": dict(resp.headers),
            "body_text": body_text,
            "elapsed_ms": elapsed_ms,
            "truncated": truncated,
            "url": resp.url,
        }
        results = asserts.evaluate_all(config.get("assertions"), response)
        all_pass = all(a.passed for a in results)
        status = PASSED if all_pass else FAILED
        error_category = None if all_pass else _classify_failure(results)
        ctx.log("info", f"-> {resp.status_code} in {elapsed_ms}ms ({len(results)} assertions, "
                        f"{sum(1 for a in results if a.passed)} passed)")

        return TestResult(
            status=status,
            steps=[StepResult(name=f"{method} request", status=status, duration_ms=elapsed_ms)],
            assertions=results,
            error_category=error_category,
            error_message=None if all_pass else "one or more assertions failed",
            response=response,
            metrics={"elapsed_ms": elapsed_ms, "status_code": resp.status_code},
        )
    except ValidationError as e:
        # SSRF guard (or invalid URL) rejected the request — a clean error result,
        # not an exception that escapes to the handler.
        ctx.log("error", f"blocked: {e.message}")
        return TestResult(status=ERROR, error_category="network_error",
                          error_message=e.message)
    except requests.Timeout:
        return TestResult(status=TIMEOUT, error_category="timeout",
                          error_message=f"request exceeded {timeout_ms}ms")
    except requests.TooManyRedirects as e:
        return TestResult(status=ERROR, error_category="network_error", error_message=str(e))
    except requests.RequestException as e:
        return TestResult(status=ERROR, error_category="network_error", error_message=str(e))
    finally:
        session.close()


def _classify_failure(results) -> str:
    for a in results:
        if a.source == "status_code" and not a.passed:
            return "http_status_mismatch"
    for a in results:
        if a.source in ("json_path", "json_schema") and not a.passed:
            return "json_assertion_failed"
    return "assertion_failed"
