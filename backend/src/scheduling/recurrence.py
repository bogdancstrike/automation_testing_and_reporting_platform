"""Next-run computation for once / interval / cron schedules."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from croniter import croniter

from src.core.errors import ValidationError


def compute_next(schedule, *, after: datetime | None = None) -> datetime | None:
    """Return the next due UTC time strictly after *after* (or now)."""
    now = after or datetime.now(timezone.utc)
    rtype = schedule.recurrence_type

    if rtype == "once":
        # Fire once at start_at; no next run after it has fired.
        if schedule.last_enqueued_at:
            return None
        return schedule.start_at or now

    if rtype == "interval":
        if not schedule.interval_seconds or schedule.interval_seconds <= 0:
            raise ValidationError("interval_seconds must be positive")
        base = schedule.last_enqueued_at or schedule.start_at or now
        nxt = base + timedelta(seconds=schedule.interval_seconds)
        while nxt <= now:
            nxt += timedelta(seconds=schedule.interval_seconds)
        return nxt

    if rtype == "cron":
        if not schedule.cron_expression:
            raise ValidationError("cron_expression is required")
        try:
            itr = croniter(schedule.cron_expression, now)
        except (ValueError, KeyError) as e:
            raise ValidationError(f"invalid cron expression: {e}")
        return itr.get_next(datetime).replace(tzinfo=timezone.utc)

    raise ValidationError(f"unknown recurrence_type {rtype!r}")
