"""Assertion evaluation — the heart of "check the output, not just the status".

Supports the operator taxonomy from architecture section 10 against a normalized
response object.
"""
from __future__ import annotations

import json
import re
from typing import Any

from src.testkit.result import AssertionResult

_MISSING = object()

_SIMPLE_PATH = re.compile(r"\.([a-zA-Z_][a-zA-Z0-9_]*)|\[(\d+)\]|\['([^']*)'\]")


def json_path_get(data: Any, path: str) -> Any:
    """Minimal JSONPath: supports $.a.b, $.a[0], $['x']. Returns _MISSING if absent."""
    if path in ("$", "", None):
        return data
    if path.startswith("$"):
        path = path[1:]
    cur = data
    for m in _SIMPLE_PATH.finditer(path):
        key = m.group(1) or m.group(3)
        idx = m.group(2)
        try:
            if idx is not None:
                cur = cur[int(idx)]
            else:
                cur = cur[key]
        except (KeyError, IndexError, TypeError):
            return _MISSING
    return cur


def _coerce_number(v: Any) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _length(v: Any) -> int | None:
    try:
        return len(v)
    except TypeError:
        return None


def _apply(operator: str, actual: Any, expected: Any) -> tuple[bool, str]:
    op = operator
    exists = actual is not _MISSING

    if op == "exists":
        return exists, ""
    if op == "not_exists":
        return not exists, ""

    if not exists:
        return False, "value not present"

    if op == "equals":
        return str(actual) == str(expected) or actual == expected, ""
    if op == "not_equals":
        return not (str(actual) == str(expected) or actual == expected), ""
    if op == "contains":
        return str(expected) in str(actual), ""
    if op == "not_contains":
        return str(expected) not in str(actual), ""
    if op == "matches":
        return re.search(str(expected), str(actual)) is not None, ""
    if op == "not_matches":
        return re.search(str(expected), str(actual)) is None, ""
    if op in ("gt", "gte", "lt", "lte"):
        a, e = _coerce_number(actual), _coerce_number(expected)
        if a is None or e is None:
            return False, "non-numeric comparison"
        return {"gt": a > e, "gte": a >= e, "lt": a < e, "lte": a <= e}[op], ""
    if op in ("length_eq", "length_gte", "length_lte"):
        n = _length(actual)
        e = _coerce_number(expected)
        if n is None or e is None:
            return False, "length not applicable"
        return {"length_eq": n == e, "length_gte": n >= e, "length_lte": n <= e}[op], ""
    if op == "in":
        seq = expected if isinstance(expected, (list, tuple)) else [expected]
        return actual in seq or str(actual) in [str(x) for x in seq], ""
    if op == "not_in":
        seq = expected if isinstance(expected, (list, tuple)) else [expected]
        return actual not in seq and str(actual) not in [str(x) for x in seq], ""
    return False, f"unknown operator {op!r}"


def evaluate(spec: dict[str, Any], response: dict[str, Any], parsed_json: Any) -> AssertionResult:
    source = spec.get("source") or spec.get("type") or "status_code"
    operator = spec.get("operator", "equals")
    expected = spec.get("expected")
    target = spec.get("path") or spec.get("target") or spec.get("name")

    if source == "status_code":
        actual = response.get("status_code")
    elif source == "response_time_ms":
        actual = response.get("elapsed_ms")
    elif source == "header":
        headers = {k.lower(): v for k, v in (response.get("headers") or {}).items()}
        actual = headers.get(str(target).lower(), _MISSING)
    elif source == "body_text":
        actual = response.get("body_text", "")
    elif source == "json_path":
        actual = json_path_get(parsed_json, str(target)) if parsed_json is not _MISSING else _MISSING
    elif source == "json_schema":
        actual = parsed_json
        # Lightweight: only checks the body parsed as JSON of the expected top type.
        ok = parsed_json is not _MISSING and (
            not expected or type(parsed_json).__name__ == expected
        )
        return AssertionResult(source, operator, expected, type(parsed_json).__name__,
                               ok, target, "" if ok else "body not valid/expected JSON")
    else:
        actual = _MISSING

    passed, message = _apply(operator, actual, expected)
    display_actual = None if actual is _MISSING else actual
    return AssertionResult(source, operator, expected, display_actual, passed, target, message)


def evaluate_all(specs: list[dict[str, Any]], response: dict[str, Any]) -> list[AssertionResult]:
    body_text = response.get("body_text", "") or ""
    try:
        parsed = json.loads(body_text) if body_text.strip() else _MISSING
    except (ValueError, TypeError):
        parsed = _MISSING
    return [evaluate(s, response, parsed) for s in (specs or [])]
