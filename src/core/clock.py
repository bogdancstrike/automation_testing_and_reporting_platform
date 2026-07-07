"""Time helpers — a single UTC clock so tests can reason about it."""
from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
