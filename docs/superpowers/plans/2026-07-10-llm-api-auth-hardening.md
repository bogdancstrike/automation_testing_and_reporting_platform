# LLM API Authentication Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the backend call FreeLLMAPI with its native bearer key without a browser cookie, and turn auth redirects or HTML responses into explicit LLM availability errors.

**Architecture:** A dedicated Kubernetes Ingress owns only the public `/v1` prefix and omits the oauth2-proxy external-auth annotations; FreeLLMAPI continues to validate its native `freellmapi-*` bearer key, while the dashboard and all other paths retain Keycloak SSO. The Python client uses one no-redirect transport helper for RCA and magic assertions, validates status and content type before parsing JSON, and reports authentication failures without exposing response bodies.

**Tech Stack:** Python 3, `urllib.request`, pytest, Kubernetes Ingress, Helm 3, ingress-nginx

---

### Task 1: Cover the LLM transport failure modes

**Files:**
- Create: `backend/tests/unit/test_llm.py`
- Test: `backend/tests/unit/test_llm.py`

- [ ] **Step 1: Write tests for an authentication redirect and an HTML login response**

```python
import io
import urllib.error
from email.message import Message

import pytest

from src.execution import llm


class _Response:
    def __init__(self, body: bytes, content_type: str, status: int = 200):
        self.status = status
        self.headers = Message()
        self.headers["Content-Type"] = content_type
        self._body = io.BytesIO(body)

    def read(self):
        return self._body.read()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def test_chat_completion_rejects_auth_redirect(monkeypatch):
    redirect = urllib.error.HTTPError(
        llm.Config.LLM_OPENAI_API,
        302,
        "Found",
        {"Location": "https://auth.doncik.ro/oauth2/start"},
        None,
    )
    monkeypatch.setattr(llm._NO_REDIRECT_OPENER, "open", lambda *_args, **_kwargs: (_ for _ in ()).throw(redirect))

    with pytest.raises(llm.LLMEndpointError, match="redirected to login"):
        llm._request_chat_completion({"messages": []})


def test_chat_completion_rejects_html_login_page(monkeypatch):
    response = _Response(b"<!DOCTYPE html><title>Sign in</title>", "text/html; charset=utf-8")
    monkeypatch.setattr(llm._NO_REDIRECT_OPENER, "open", lambda *_args, **_kwargs: response)

    with pytest.raises(llm.LLMEndpointError, match="expected application/json, received text/html"):
        llm._request_chat_completion({"messages": []})
```

- [ ] **Step 2: Run the focused tests and verify they fail before implementation**

Run: `cd backend && .venv/bin/pytest tests/unit/test_llm.py -q`

Expected: FAIL during import because `LLMEndpointError`, `_NO_REDIRECT_OPENER`, and `_request_chat_completion` do not exist.

- [ ] **Step 3: Add a successful JSON response test**

```python
def test_chat_completion_returns_json_payload(monkeypatch):
    response = _Response(b'{"choices": []}', "application/json; charset=utf-8")
    monkeypatch.setattr(llm._NO_REDIRECT_OPENER, "open", lambda *_args, **_kwargs: response)

    assert llm._request_chat_completion({"messages": []}) == {"choices": []}
```

### Task 2: Centralize and harden the LLM HTTP transport

**Files:**
- Modify: `backend/src/execution/llm.py`
- Test: `backend/tests/unit/test_llm.py`

- [ ] **Step 1: Add a no-redirect opener and explicit endpoint error**

```python
class LLMEndpointError(RuntimeError):
    """The configured LLM endpoint did not return an OpenAI-compatible response."""


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_NO_REDIRECT_OPENER = urllib.request.build_opener(_NoRedirectHandler())
```

- [ ] **Step 2: Add the shared request helper**

```python
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
            status = getattr(response, "status", response.getcode())
            if 300 <= status < 400:
                raise LLMEndpointError(
                    "LLM endpoint redirected to login (authentication required). "
                    "Verify native API-key access or refresh LLM_OPENAI_COOKIE."
                )
            if status >= 300:
                raise LLMEndpointError(f"LLM endpoint returned HTTP {status}.")
            content_type = response.headers.get("Content-Type", "").partition(";")[0].strip().lower()
            if content_type != "application/json" and not content_type.endswith("+json"):
                raise LLMEndpointError(
                    f"LLM endpoint expected application/json, received {content_type or 'no content type'}."
                )
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if 300 <= error.code < 400:
            raise LLMEndpointError(
                "LLM endpoint redirected to login (authentication required). "
                "Verify native API-key access or refresh LLM_OPENAI_COOKIE."
            ) from error
        raise LLMEndpointError(f"LLM endpoint returned HTTP {error.code}.") from error

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise LLMEndpointError("LLM endpoint returned invalid JSON.") from error
```

- [ ] **Step 3: Make both LLM features use the helper**

Replace their duplicate header/request/`urlopen` blocks with:

```python
payload = _request_chat_completion(body)
```

Catch `LLMEndpointError` separately in RCA so the returned UI text starts with `AI RCA unavailable:`, and catch it in magic assertions so the server log explains why the result is empty.

- [ ] **Step 4: Run focused and complete backend tests**

Run: `cd backend && .venv/bin/pytest tests/unit/test_llm.py -q`

Expected: all LLM tests PASS.

Run: `cd backend && .venv/bin/pytest tests/unit -q`

Expected: all unit tests PASS.

### Task 3: Route the native-key API around browser SSO

**Files:**
- Modify: `/home/bogdan/workspace/infrastructure/deployment-configs-homelab/app-charts/freellmapi/templates/freellmapi.yaml`
- Modify: `/home/bogdan/workspace/infrastructure/deployment-configs-homelab/app-charts/freellmapi/values.yaml`

- [ ] **Step 1: Add an explicit public API setting**

```yaml
publicApi:
  enabled: true
  path: /v1
```

- [ ] **Step 2: Add a dedicated public API Ingress**

Add `freellmapi-public-api` for the same public hostname, TLS secret, and service. Its only path is `.Values.publicApi.path` with `Prefix` matching, and it intentionally has no `auth-url` or `auth-signin` annotation. Include a template comment that FreeLLMAPI validates the native `Authorization: Bearer freellmapi-*` key and that all non-`/v1` paths stay on `freellmapi-public` behind SSO.

- [ ] **Step 3: Render and inspect the chart**

Run: `helm template x /home/bogdan/workspace/infrastructure/deployment-configs-homelab/app-charts/freellmapi`

Expected: `freellmapi-public-api` renders `/v1` with no external-auth annotations; `freellmapi-public` still renders `/` with oauth2-proxy annotations.

### Task 4: Document and verify the security boundary

**Files:**
- Modify: `/home/bogdan/workspace/infrastructure/deployment-configs-homelab/README.md`

- [ ] **Step 1: Document split authentication**

Update the public-route tables and API-client section to state that the dashboard/non-API routes use Keycloak SSO, `/v1/*` bypasses oauth2-proxy, and FreeLLMAPI rejects missing or invalid native bearer keys.

- [ ] **Step 2: Add post-deployment checks without embedding a secret**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://freellmapi.doncik.ro/
# 302 without an SSO cookie

curl -s -o /dev/null -w '%{http_code}\n' https://freellmapi.doncik.ro/v1/models
# 401 with no native API key

curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $LLM_OPENAI_API_KEY" \
  https://freellmapi.doncik.ro/v1/models
# 200 with the configured native API key
```

- [ ] **Step 3: Review diffs and worktree state**

Run: `git diff --check && git status --short` in each repository.

Expected: no whitespace errors; only the planned backend, test, chart, values, and documentation files are changed.
