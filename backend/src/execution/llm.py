import json
import urllib.request
import urllib.error
import socket
from src.config import Config
from src.catalog.models import Scenario
from src.execution.models import TestRun
from src.testkit.context import TestContext
from src.testkit.result import TestResult

SYSTEM_MESSAGE = (
    "You are an AI assistant for a testing platform. Analyze the provided test execution evidence "
    "(HTTP payloads, assertions, python stack trace, code, logs) and generate a plain-English "
    "explanation of the root cause of the failure. Be concise and direct, e.g., 'The API returned "
    "a 400 because the email field format was changed in the latest deployment.' Do not invent details. Limit to 3-5 sentences."
)

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
            "temperature": 0.2
        }

        data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            Config.LLM_OPENAI_API,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + Config.LLM_OPENAI_API_KEY,
            },
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=20) as response:
            status = getattr(response, "status", response.getcode())
            if status >= 300:
                return None
            raw = response.read().decode("utf-8")
            
        payload = json.loads(raw)
        content = payload["choices"][0]["message"]["content"]
        return content.strip()
    except Exception as e:
        return f"AI RCA failed to generate: {e}"
