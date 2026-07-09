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

def generate_rca(run: TestRun, definition: Scenario, ctx: TestContext, result: TestResult, code_text: str) -> str | None:
    if not Config.LLM_FEATURES_ENABLED:
        return None

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

        data = json.dumps(body).encode("utf-8")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + Config.LLM_OPENAI_API_KEY,
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        }
        if hasattr(Config, "LLM_OPENAI_COOKIE") and Config.LLM_OPENAI_COOKIE:
            headers["Cookie"] = Config.LLM_OPENAI_COOKIE

        request = urllib.request.Request(
            Config.LLM_OPENAI_API,
            data=data,
            headers=headers,
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=60) as response:
            status = getattr(response, "status", response.getcode())
            if status >= 300:
                return None
            raw = response.read().decode("utf-8")
            
        payload = json.loads(raw)
        content = payload["choices"][0]["message"]["content"]
        return _clean_json_response(content)
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

        data = json.dumps(body).encode("utf-8")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + Config.LLM_OPENAI_API_KEY,
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        }
        if hasattr(Config, "LLM_OPENAI_COOKIE") and Config.LLM_OPENAI_COOKIE:
            headers["Cookie"] = Config.LLM_OPENAI_COOKIE

        request = urllib.request.Request(
            Config.LLM_OPENAI_API,
            data=data,
            headers=headers,
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=60) as response:
            status = getattr(response, "status", response.getcode())
            if status >= 300:
                return []
            raw = response.read().decode("utf-8")
        
        print(f"RAW API RESPONSE:\n{raw}")
            
        payload = json.loads(raw)
        content = payload["choices"][0]["message"]["content"]
        
        print(f"LLM MAGIC ASSERTIONS RAW CONTENT:\n{content}")
        
        cleaned = _clean_json_response(content)
        parsed = json.loads(cleaned)
        assertions = parsed.get("assertions", [])
        if isinstance(assertions, list):
            return assertions
        return []
    except Exception as e:
        print(f"Failed to generate magic assertions: {e}")
        return []
