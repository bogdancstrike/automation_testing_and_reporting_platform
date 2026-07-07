"""Shared helpers for QF handlers."""
from __future__ import annotations

from typing import Any


def json_body(request) -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def query_args(request) -> dict[str, Any]:
    return {k: v for k, v in request.args.items()}
