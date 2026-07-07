"""HTTP request adapter.

Executes legacy single-request configs and multi-step HTTP flows. Every outbound
request still goes through the SSRF guard. Multi-step captures live only in the
per-run TestContext while the worker executes one claimed run, then are persisted
in the combined run response for later inspection.
"""
from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import urljoin

import requests

from src.config import Config
from src.core.errors import ValidationError
from src.core.net_guard import resolve_and_check
from framework.tracing import get_tracer
from src.testkit import assertions as asserts
from src.testkit.context import TestContext
from src.testkit.result import ERROR, FAILED, PASSED, TIMEOUT, AssertionResult, StepResult, TestResult

tracer = get_tracer()


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


def normalize_steps(config: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(config.get("steps"), list) and config["steps"]:
        raw_steps = [dict(s) for s in config["steps"]]
    else:
        raw_steps = [{"id": "request", "name": "Request", **dict(config)}]
    seen: set[str] = set()
    steps: list[dict[str, Any]] = []
    for i, raw in enumerate(raw_steps):
        step = dict(raw)
        sid = str(step.get("id") or f"step-{i + 1}").strip() or f"step-{i + 1}"
        if sid in seen:
            raise ValidationError(f"duplicate step id {sid!r}")
        seen.add(sid)
        step["id"] = sid
        step["name"] = step.get("name") or f"Step {i + 1}"
        step["method"] = str(step.get("method", "GET")).upper()
        steps.append(step)
    return steps


def _execute_http_step(config: dict[str, Any], ctx: TestContext, *, session: requests.Session | None = None) -> TestResult:
    started = time.monotonic()
    method = str(config.get("method", "GET")).upper()
    timeout_ms = min(int(config.get("timeoutMs", 30000) or 30000), Config.REQUEST_MAX_TIMEOUT_MS)
    tls_verify = bool(config.get("tlsVerify", True))
    follow = bool(config.get("followRedirects", True))
    max_bytes = Config.REQUEST_MAX_BODY_BYTES
    step_id = config.get("id")
    step_name = config.get("name") or f"{method} request"

    url = _resolve_url(config, ctx)
    if not url:
        return TestResult(status=ERROR, error_category="script_error", error_message="request has no resolvable URL")

    headers = dict(ctx.target(config.get("target", "default")).default_headers)
    for name, value in _enabled_pairs(config.get("headers"), ctx):
        headers[name] = value
    _apply_auth(headers, config.get("auth"), ctx)

    body, default_ct = _build_body(config.get("body"), ctx)
    if body is not None and default_ct and not any(k.lower() == "content-type" for k in headers):
        headers["Content-Type"] = default_ct

    params = _enabled_pairs(config.get("query"), ctx)
    owns_session = session is None
    session = session or requests.Session()
    hops = 0
    try:
        ctx.log("info", f"{step_name}: {method} {url}")
        current_url = url
        current_method = method
        current_body: Any = body
        while True:
            resolve_and_check(current_url)
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
        ctx.log("info", f"{step_name}: -> {resp.status_code} in {elapsed_ms}ms ({len(results)} assertions, {sum(1 for a in results if a.passed)} passed)")
        return TestResult(
            status=status,
            steps=[StepResult(name=str(step_name), status=status, duration_ms=elapsed_ms, step_id=step_id)],
            assertions=results,
            error_category=error_category,
            error_message=None if all_pass else "one or more assertions failed",
            response=response,
            metrics={"elapsed_ms": elapsed_ms, "status_code": resp.status_code},
        )
    except ValidationError as e:
        ctx.log("error", f"{step_name}: blocked: {e.message}")
        return TestResult(status=ERROR, error_category="network_error", error_message=e.message,
                          steps=[StepResult(name=str(step_name), status=ERROR, step_id=step_id, error=e.message)])
    except requests.Timeout:
        return TestResult(status=TIMEOUT, error_category="timeout", error_message=f"request exceeded {timeout_ms}ms",
                          steps=[StepResult(name=str(step_name), status=TIMEOUT, step_id=step_id, error=f"request exceeded {timeout_ms}ms")])
    except requests.TooManyRedirects as e:
        return TestResult(status=ERROR, error_category="network_error", error_message=str(e),
                          steps=[StepResult(name=str(step_name), status=ERROR, step_id=step_id, error=str(e))])
    except requests.RequestException as e:
        return TestResult(status=ERROR, error_category="network_error", error_message=str(e),
                          steps=[StepResult(name=str(step_name), status=ERROR, step_id=step_id, error=str(e))])
    finally:
        if owns_session:
            session.close()


def _parsed_json(response: dict[str, Any]) -> Any:
    body = response.get("body_text") or ""
    try:
        return json.loads(body) if str(body).strip() else None
    except (TypeError, ValueError):
        return None


def _capture_value(capture: dict[str, Any], response: dict[str, Any]) -> Any:
    source = capture.get("source", "json_path")
    target = capture.get("path") or capture.get("target") or capture.get("name")
    if source == "json_path":
        value = asserts.json_path_get(_parsed_json(response), str(target))
        if value is asserts._MISSING:  # type: ignore[attr-defined]
            return None
        return value
    if source == "header":
        headers = {k.lower(): v for k, v in (response.get("headers") or {}).items()}
        return headers.get(str(target).lower())
    if source == "body_text":
        return response.get("body_text", "")
    return None


def _apply_captures(step: dict[str, Any], response: dict[str, Any], ctx: TestContext) -> tuple[bool, str | None, list[str]]:
    captured: list[str] = []
    for capture in step.get("captures") or []:
        name = str(capture.get("name", "")).strip()
        if not name:
            continue
        value = _capture_value(capture, response)
        if value is None and not capture.get("optional", False):
            return False, f"capture {name!r} did not find a value", captured
        if value is not None:
            ctx.set_var(name, value)
            captured.append(name)
    return True, None, captured


def execute_http(config: dict[str, Any], ctx: TestContext) -> TestResult:
    steps = normalize_steps(config)
    with tracer.start_as_current_span("flow_executor") as span:
        span.set_attribute("flow.steps", len(steps))
        span.set_attribute("flow.mode", "multi_step" if isinstance(config.get("steps"), list) else "single_request")

        if not isinstance(config.get("steps"), list):
            step = steps[0]
            with tracer.start_as_current_span("http.step") as step_span:
                step_span.set_attribute("step.id", step.get("id", "request"))
                step_span.set_attribute("step.name", step.get("name", "Request"))
                step_span.set_attribute("http.method", step.get("method", "GET"))
                result = _execute_http_step(config, ctx)
                step_span.set_attribute("step.status", result.status)
                if result.response.get("status_code") is not None:
                    step_span.set_attribute("http.status_code", result.response.get("status_code"))
                if result.error_message:
                    step_span.set_attribute("step.error", result.error_message)
            if result.status == PASSED and config.get("captures"):
                with tracer.start_as_current_span("http.captures") as cap_span:
                    ok, message, captured = _apply_captures({"captures": config.get("captures")}, result.response, ctx)
                    result.response["captures"] = captured
                    cap_span.set_attribute("captures.count", len(captured))
                    if not ok:
                        result.status = FAILED
                        result.error_category = "capture_failed"
                        result.error_message = message
                        cap_span.set_attribute("captures.error", message or "capture failed")
            span.set_attribute("flow.status", result.status)
            span.set_attribute("flow.elapsed_ms", result.metrics.get("elapsed_ms", 0))
            return result

        started = time.monotonic()
        all_steps: list[StepResult] = []
        all_assertions: list[AssertionResult] = []
        response_steps: list[dict[str, Any]] = []
        final_status = PASSED
        error_category = None
        error_message = None
        steps_passed = 0

        session = requests.Session()
        try:
            for step in steps:
                if ctx.should_cancel():
                    final_status = ERROR
                    error_category = "canceled"
                    error_message = "canceled during HTTP flow"
                    all_steps.append(StepResult(name=step["name"], status=ERROR, step_id=step["id"], error=error_message))
                    break
                with tracer.start_as_current_span("http.step") as step_span:
                    step_span.set_attribute("step.id", step["id"])
                    step_span.set_attribute("step.name", step["name"])
                    step_span.set_attribute("http.method", step.get("method", "GET"))
                    single = _execute_http_step(step, ctx, session=session)
                    step_span.set_attribute("step.status", single.status)
                    if single.response.get("status_code") is not None:
                        step_span.set_attribute("http.status_code", single.response.get("status_code"))
                    if single.metrics.get("elapsed_ms") is not None:
                        step_span.set_attribute("step.duration_ms", single.metrics.get("elapsed_ms"))
                    if single.error_message:
                        step_span.set_attribute("step.error", single.error_message)
                for s in single.steps:
                    s.step_id = s.step_id or step["id"]
                    s.name = step.get("name") or s.name
                    all_steps.append(s)
                for assertion in single.assertions:
                    assertion.message = f"{step['name']}: {assertion.message}" if assertion.message else step["name"]
                    if assertion.target:
                        assertion.target = f"{step['id']}:{assertion.target}"
                    all_assertions.append(assertion)

                captured: list[str] = []
                if single.status == PASSED:
                    with tracer.start_as_current_span("http.captures") as cap_span:
                        cap_span.set_attribute("step.id", step["id"])
                        ok, capture_error, captured = _apply_captures(step, single.response, ctx)
                        cap_span.set_attribute("captures.count", len(captured))
                        if not ok:
                            cap_span.set_attribute("captures.error", capture_error or "capture failed")
                            single.status = FAILED
                            single.error_category = "capture_failed"
                            single.error_message = capture_error
                            if all_steps:
                                all_steps[-1].status = FAILED
                                all_steps[-1].error = capture_error
                response_steps.append({
                    "id": step["id"], "name": step["name"], "method": step.get("method"),
                    "url": ctx.render(str(step.get("url", ""))), "status": single.status,
                    "captures": captured, "response": single.response,
                    "error_category": single.error_category, "error_message": single.error_message,
                })
                if single.status == PASSED:
                    steps_passed += 1
                    continue
                final_status = single.status
                error_category = single.error_category
                error_message = single.error_message
                break
        finally:
            session.close()

        elapsed_ms = int((time.monotonic() - started) * 1000)
        span.set_attribute("flow.status", final_status)
        span.set_attribute("flow.elapsed_ms", elapsed_ms)
        span.set_attribute("flow.steps_passed", steps_passed)
        if error_message:
            span.set_attribute("flow.error", error_message)
        return TestResult(
            status=final_status,
            steps=all_steps,
            assertions=all_assertions,
            error_category=error_category,
            error_message=error_message,
            response={"steps": response_steps, "last_response": response_steps[-1]["response"] if response_steps else {}},
            metrics={"elapsed_ms": elapsed_ms, "steps_total": len(steps), "steps_passed": steps_passed},
        )

def _classify_failure(results) -> str:
    for a in results:
        if a.source == "status_code" and not a.passed:
            return "http_status_mismatch"
    for a in results:
        if a.source in ("json_path", "json_schema") and not a.passed:
            return "json_assertion_failed"
    return "assertion_failed"
