import json
import urllib.request
import urllib.error
import socket
import re
from src.config import Config
from src.catalog.models import Scenario
from src.execution.models import TestRun
from src.testkit.context import TestContext
from src.testkit.result import TestResult
from framework.tracing import get_tracer

tracer = get_tracer()


class LLMEndpointError(RuntimeError):
    """The LLM endpoint did not return an OpenAI-compatible response."""


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_NO_REDIRECT_OPENER = urllib.request.build_opener(_NoRedirectHandler())

SYSTEM_MESSAGE = (
    "You are an AI assistant for a testing platform. Analyze the provided test execution evidence "
    "(HTTP payloads, assertions, python stack trace, code, logs) and identify the root cause of the failure. "
    "Return the result STRICTLY as a JSON object with exactly these keys:\n"
    "- \"summary\": A 1-sentence plain-English summary of the root cause.\n"
    "- \"technical_details\": 2-3 sentences explaining the discrepancy, payloads, or stack trace.\n"
    "- \"suggested_fix\": A short actionable suggestion to fix the test or the product.\n"
    "Ensure you output valid JSON."
)

def _clean_json_response(content: str) -> str:
    content = content.strip()
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return content


def _endpoint_status_error(status: int) -> LLMEndpointError:
    if 300 <= status < 400:
        return LLMEndpointError(
            "LLM endpoint redirected to login (authentication required). "
            "Verify native API-key access or refresh LLM_OPENAI_COOKIE."
        )
    if status in (401, 403):
        return LLMEndpointError(
            f"LLM endpoint returned HTTP {status} (authentication failed). "
            "Verify LLM_OPENAI_API_KEY."
        )
    return LLMEndpointError(f"LLM endpoint returned HTTP {status}.")


def _request_chat_completion(body: dict) -> dict:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer " + Config.LLM_OPENAI_API_KEY,
        "User-Agent": "QTP/1.0",
    }
    if Config.LLM_OPENAI_COOKIE:
        headers["Cookie"] = Config.LLM_OPENAI_COOKIE

    request = urllib.request.Request(
        Config.LLM_OPENAI_API,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with _NO_REDIRECT_OPENER.open(request, timeout=60) as response:
            status = getattr(response, "status", None)
            if status is None:
                status = response.getcode()
            if status >= 300:
                raise _endpoint_status_error(status)

            content_type = (
                response.headers.get("Content-Type", "")
                .partition(";")[0]
                .strip()
                .lower()
            )
            if content_type != "application/json" and not content_type.endswith("+json"):
                raise LLMEndpointError(
                    "LLM endpoint expected application/json, received "
                    f"{content_type or 'no content type'}."
                )
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        raise _endpoint_status_error(error.code) from error

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise LLMEndpointError("LLM endpoint returned invalid JSON.") from error

def generate_rca(run: TestRun, definition: Scenario, ctx: TestContext, result: TestResult, code_text: str) -> str | None:
    if not Config.LLM_FEATURES_ENABLED:
        return None

    with tracer.start_as_current_span("execution.ai_rca") as span:
        span.set_attribute("run.id", run.id)
        span.set_attribute("llm.model", Config.LLM_MODEL)
        rca = _generate_rca(run, definition, ctx, result, code_text)
        span.set_attribute("rca.generated", bool(rca))
        return rca


def _generate_rca(run: TestRun, definition: Scenario, ctx: TestContext, result: TestResult, code_text: str) -> str | None:
    try:
        # Build context
        context_parts = []
        if definition:
            context_parts.append(f"Scenario Name: {definition.name}")
            context_parts.append(f"Scenario Type: {definition.type}")
        
        if code_text:
            context_parts.append(f"Scenario Code:\n{code_text}")
        
        if result.error_message:
            context_parts.append(f"Error Message/Stack Trace:\n{result.error_message}")
            
        assertions = "\n".join(
            f"- {a.source} {a.operator} {a.target}: expected {a.expected}, actual {a.actual}, passed: {a.passed}, message: {a.message}"
            for a in result.assertions if not a.passed
        )
        if assertions:
            context_parts.append(f"Failed Assertions:\n{assertions}")
            
        logs = "\n".join(f"[{entry['level']}] {entry['message']} {entry.get('context', {})}" for entry in ctx.logs())
        if logs:
            context_parts.append(f"Logs:\n{logs}")
            
        if result.response:
            # Truncate response if too large
            resp_str = json.dumps(result.response)
            if len(resp_str) > 2000:
                resp_str = resp_str[:2000] + "... (truncated)"
            context_parts.append(f"HTTP Response Data:\n{resp_str}")

        prompt = "\n\n".join(context_parts)
        
        body = {
            "model": Config.LLM_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_MESSAGE},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "response_format": { "type": "json_object" }
        }

        payload = _request_chat_completion(body)
        content = payload["choices"][0]["message"]["content"]
        return _clean_json_response(content)
    except LLMEndpointError as e:
        print(f"AI RCA unavailable: {e}")
        return f"AI RCA unavailable: {e}"
    except Exception as e:
        print(f"AI RCA failed to generate: {e}")
        return f"AI RCA failed to generate: {e}"

def generate_magic_assertions(response_data: dict) -> list[dict]:
    if not Config.LLM_FEATURES_ENABLED:
        return []

    try:
        resp_str = json.dumps(response_data)
        if len(resp_str) > 3000:
            resp_str = resp_str[:3000] + "... (truncated)"
            
        system_msg = (
            "You are an AI for a testing platform. A user just executed an HTTP request. "
            "Inspect the provided JSON response payload (including status_code, body_text) and generate a comprehensive suite of assertions. "
            "Return STRICTLY a JSON object with a single key 'assertions' containing an array of assertion objects. "
            "Each assertion object must have exactly:\n"
            "- 'source' (string): one of 'status_code', 'json_path', 'header', 'body_text', 'response_time_ms'\n"
            "- 'path' (string, optional): the JSON path (e.g. '$.data.id') if source is json_path, or header name if header\n"
            "- 'operator' (string): one of 'equals', 'not_equals', 'contains', 'exists', 'not_exists', 'gt', 'lt', 'length_gte'\n"
            "- 'expected' (any, optional): the expected value (must be string, number, or boolean)\n"
            "Ensure you output valid JSON."
        )
        
        body = {
            "model": Config.LLM_MODEL,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": resp_str}
            ],
            "temperature": 0.2,
            "response_format": { "type": "json_object" }
        }

        payload = _request_chat_completion(body)
        content = payload["choices"][0]["message"]["content"]
        
        print(f"LLM MAGIC ASSERTIONS RAW CONTENT:\n{content}")
        
        cleaned = _clean_json_response(content)
        parsed = json.loads(cleaned)
        assertions = parsed.get("assertions", [])
        if isinstance(assertions, list):
            return assertions
        return []
    except LLMEndpointError as e:
        print(f"Magic assertions unavailable: {e}")
        return []
    except Exception as e:
        print(f"Failed to generate magic assertions: {e}")
        return []
