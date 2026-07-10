import io
import urllib.error
from email.message import Message
from types import SimpleNamespace

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

    def raise_redirect(*_args, **_kwargs):
        raise redirect

    monkeypatch.setattr(llm._NO_REDIRECT_OPENER, "open", raise_redirect)

    with pytest.raises(llm.LLMEndpointError, match="redirected to login"):
        llm._request_chat_completion({"messages": []})


def test_chat_completion_rejects_html_login_page(monkeypatch):
    response = _Response(
        b"<!DOCTYPE html><title>Sign in</title>",
        "text/html; charset=utf-8",
    )
    monkeypatch.setattr(
        llm._NO_REDIRECT_OPENER,
        "open",
        lambda *_args, **_kwargs: response,
    )

    with pytest.raises(
        llm.LLMEndpointError,
        match="expected application/json, received text/html",
    ):
        llm._request_chat_completion({"messages": []})


def test_chat_completion_returns_json_payload(monkeypatch):
    response = _Response(b'{"choices": []}', "application/json; charset=utf-8")
    monkeypatch.setattr(
        llm._NO_REDIRECT_OPENER,
        "open",
        lambda *_args, **_kwargs: response,
    )

    assert llm._request_chat_completion({"messages": []}) == {"choices": []}


def test_rca_reports_endpoint_auth_failure(monkeypatch):
    def raise_endpoint_error(_body):
        raise llm.LLMEndpointError("LLM endpoint redirected to login.")

    monkeypatch.setattr(llm, "_request_chat_completion", raise_endpoint_error)
    result = SimpleNamespace(error_message="failure", assertions=[], response=None)
    ctx = SimpleNamespace(logs=lambda: [])

    generated = llm._generate_rca(None, None, ctx, result, "")

    assert generated == "AI RCA unavailable: LLM endpoint redirected to login."


def test_magic_assertions_log_endpoint_auth_failure(monkeypatch, capsys):
    monkeypatch.setattr(llm.Config, "LLM_FEATURES_ENABLED", True)

    def raise_endpoint_error(_body):
        raise llm.LLMEndpointError("LLM endpoint redirected to login.")

    monkeypatch.setattr(llm, "_request_chat_completion", raise_endpoint_error)

    assert llm.generate_magic_assertions({"status_code": 200}) == []
    assert (
        "Magic assertions unavailable: LLM endpoint redirected to login."
        in capsys.readouterr().out
    )
