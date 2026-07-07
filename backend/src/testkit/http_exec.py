"""Low-level HTTP request primitive shared by the declarative adapter and the
fluent ``ctx.http`` scenario client.

Performs one request with per-hop SSRF re-validation and returns a normalized
response dict (``status_code``, ``headers``, ``body_text``, ``elapsed_ms``,
``url``) — the same shape ``testkit.assertions`` evaluates against.
"""
from __future__ import annotations

import time
from typing import Any
from urllib.parse import urljoin

import requests

from src.config import Config
from src.core.net_guard import resolve_and_check


def perform_request(
    *,
    method: str,
    url: str,
    headers: dict[str, str],
    params: list[tuple[str, str]] | None = None,
    body: Any = None,
    timeout_ms: int | None = None,
    follow_redirects: bool = True,
    tls_verify: bool = True,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    """Execute one HTTP request through the SSRF guard and return a response dict.

    Redirects are followed manually so the resolved IP is re-validated on every
    hop (``followRedirects`` is user-controllable, so hostname checks alone are
    not enough). Raises ``requests``/``ValidationError`` exceptions on failure —
    callers translate those into run statuses.
    """
    started = time.monotonic()
    timeout_ms = min(int(timeout_ms or 30000), Config.REQUEST_MAX_TIMEOUT_MS)
    max_bytes = Config.REQUEST_MAX_BODY_BYTES
    owns_session = session is None
    session = session or requests.Session()
    hops = 0
    current_url, current_method, current_body = url, method.upper(), body
    try:
        while True:
            resolve_and_check(current_url)
            resp = session.request(
                current_method, current_url,
                params=params if hops == 0 else None,
                headers=headers, data=current_body,
                timeout=timeout_ms / 1000.0,
                allow_redirects=False, verify=tls_verify, stream=True,
            )
            if follow_redirects and resp.is_redirect and resp.next is not None:
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
        return {
            "status_code": resp.status_code,
            "headers": dict(resp.headers),
            "body_text": body_text,
            "elapsed_ms": elapsed_ms,
            "truncated": truncated,
            "url": resp.url,
        }
    finally:
        if owns_session:
            session.close()
