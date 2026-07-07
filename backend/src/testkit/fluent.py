"""Fluent, readable assertions for imperative scenarios.

    response.should.have_status(200)
    response.should.respond_within_ms(3000)
    response.json.should.have_field("status").equal_to("ok")
    response.json.should.have_field("items").with_length_at_least(1)

Every assertion records an ``AssertionResult`` on the context (so it shows up in
run detail exactly like a declarative assertion) and, on failure, raises
``AssertionFailure`` to stop the scenario fail-fast. The check itself is delegated
to ``testkit.assertions.evaluate`` so the operator semantics are identical to the
declarative HTTP adapter and the UI request builder.
"""
from __future__ import annotations

import json
from typing import Any

from src.testkit.assertions import _MISSING, evaluate, json_path_get


class AssertionFailure(AssertionError):
    """Raised when a fluent assertion fails; caught by the scenario runner."""


def _norm_path(path: str) -> str:
    """Accept both ``status`` and ``$.status`` / ``$.items[0].id``."""
    if not path:
        return "$"
    if path.startswith("$"):
        return path
    if path.startswith("["):
        return "$" + path
    return "$." + path


def _describe(ar) -> str:
    tgt = f" {ar.target}" if ar.target else ""
    exp = "" if ar.expected is None and ar.operator in ("exists", "not_exists") else f" {ar.expected!r}"
    extra = f" ({ar.message})" if ar.message else ""
    return (f"expected {ar.source}{tgt} {ar.operator}{exp}, "
            f"got {ar.actual!r}{extra}")


class _Should:
    """Base for the fluent builders: evaluates a spec and records/raises."""

    def __init__(self, response: "Response"):
        self._response = response

    def _check(self, spec: dict[str, Any]) -> "_Should":
        ar = evaluate(spec, self._response._raw, self._response._parsed)
        self._response._ctx._record_assertion(ar)
        if not ar.passed:
            raise AssertionFailure(_describe(ar))
        return self


class ResponseShould(_Should):
    def have_status(self, code: int) -> "ResponseShould":
        return self._check({"source": "status_code", "operator": "equals", "expected": code})  # type: ignore[return-value]

    def have_status_in(self, codes: list[int]) -> "ResponseShould":
        return self._check({"source": "status_code", "operator": "in", "expected": list(codes)})  # type: ignore[return-value]

    def respond_within_ms(self, ms: int) -> "ResponseShould":
        return self._check({"source": "response_time_ms", "operator": "lte", "expected": ms})  # type: ignore[return-value]

    def contain_text(self, text: str) -> "ResponseShould":
        return self._check({"source": "body_text", "operator": "contains", "expected": text})  # type: ignore[return-value]

    def not_contain_text(self, text: str) -> "ResponseShould":
        return self._check({"source": "body_text", "operator": "not_contains", "expected": text})  # type: ignore[return-value]

    def match_regex(self, pattern: str) -> "ResponseShould":
        return self._check({"source": "body_text", "operator": "matches", "expected": pattern})  # type: ignore[return-value]

    def have_header(self, name: str) -> "HeaderShould":
        return HeaderShould(self._response, name)


class HeaderShould(_Should):
    def __init__(self, response: "Response", name: str):
        super().__init__(response)
        self._name = name

    def _spec(self, operator: str, expected: Any = None) -> dict[str, Any]:
        return {"source": "header", "target": self._name, "operator": operator, "expected": expected}

    def that_exists(self) -> "HeaderShould":
        return self._check(self._spec("exists"))  # type: ignore[return-value]

    def equal_to(self, value: str) -> "HeaderShould":
        return self._check(self._spec("equals", value))  # type: ignore[return-value]

    def containing(self, value: str) -> "HeaderShould":
        return self._check(self._spec("contains", value))  # type: ignore[return-value]

    def matching(self, pattern: str) -> "HeaderShould":
        return self._check(self._spec("matches", pattern))  # type: ignore[return-value]


class FieldShould(_Should):
    def __init__(self, response: "Response", path: str):
        super().__init__(response)
        self._path = _norm_path(path)

    def _spec(self, operator: str, expected: Any = None) -> dict[str, Any]:
        return {"source": "json_path", "target": self._path, "operator": operator, "expected": expected}

    def exists(self) -> "FieldShould":
        return self._check(self._spec("exists"))  # type: ignore[return-value]

    def not_exist(self) -> "FieldShould":
        return self._check(self._spec("not_exists"))  # type: ignore[return-value]

    def equal_to(self, value: Any) -> "FieldShould":
        return self._check(self._spec("equals", value))  # type: ignore[return-value]

    def not_equal_to(self, value: Any) -> "FieldShould":
        return self._check(self._spec("not_equals", value))  # type: ignore[return-value]

    def containing(self, value: Any) -> "FieldShould":
        return self._check(self._spec("contains", value))  # type: ignore[return-value]

    def matching(self, pattern: str) -> "FieldShould":
        return self._check(self._spec("matches", pattern))  # type: ignore[return-value]

    def greater_than(self, n: float) -> "FieldShould":
        return self._check(self._spec("gt", n))  # type: ignore[return-value]

    def at_least(self, n: float) -> "FieldShould":
        return self._check(self._spec("gte", n))  # type: ignore[return-value]

    def less_than(self, n: float) -> "FieldShould":
        return self._check(self._spec("lt", n))  # type: ignore[return-value]

    def at_most(self, n: float) -> "FieldShould":
        return self._check(self._spec("lte", n))  # type: ignore[return-value]

    def with_length(self, n: int) -> "FieldShould":
        return self._check(self._spec("length_eq", n))  # type: ignore[return-value]

    def with_length_at_least(self, n: int) -> "FieldShould":
        return self._check(self._spec("length_gte", n))  # type: ignore[return-value]

    def with_length_at_most(self, n: int) -> "FieldShould":
        return self._check(self._spec("length_lte", n))  # type: ignore[return-value]

    def one_of(self, values: list[Any]) -> "FieldShould":
        return self._check(self._spec("in", list(values)))  # type: ignore[return-value]


class JsonShould(_Should):
    def have_field(self, path: str) -> FieldShould:
        return FieldShould(self._response, path)

    def be_an_array(self) -> "JsonShould":
        return self._check({"source": "json_schema", "operator": "equals", "expected": "list"})  # type: ignore[return-value]

    def be_an_object(self) -> "JsonShould":
        return self._check({"source": "json_schema", "operator": "equals", "expected": "dict"})  # type: ignore[return-value]


class JsonView:
    """Parsed-JSON view of a response with fluent assertions and value access."""

    def __init__(self, response: "Response"):
        self._response = response

    @property
    def should(self) -> JsonShould:
        return JsonShould(self._response)

    def get(self, path: str = "$", default: Any = None) -> Any:
        v = json_path_get(self._response._parsed, _norm_path(path))
        return default if v is _MISSING else v

    @property
    def value(self) -> Any:
        return None if self._response._parsed is _MISSING else self._response._parsed


class Response:
    """Fluent wrapper around a normalized response dict from ``perform_request``."""

    def __init__(self, ctx, raw: dict[str, Any]):
        self._ctx = ctx
        self._raw = raw
        body = raw.get("body_text") or ""
        try:
            self._parsed = json.loads(body) if str(body).strip() else _MISSING
        except (ValueError, TypeError):
            self._parsed = _MISSING

    @property
    def status_code(self) -> int:
        return int(self._raw.get("status_code") or 0)

    @property
    def elapsed_ms(self) -> int:
        return int(self._raw.get("elapsed_ms") or 0)

    @property
    def text(self) -> str:
        return self._raw.get("body_text", "") or ""

    @property
    def headers(self) -> dict[str, str]:
        return dict(self._raw.get("headers") or {})

    def header(self, name: str, default: str = "") -> str:
        low = {k.lower(): v for k, v in self.headers.items()}
        return low.get(name.lower(), default)

    @property
    def should(self) -> ResponseShould:
        return ResponseShould(self)

    @property
    def json(self) -> JsonView:
        return JsonView(self)
