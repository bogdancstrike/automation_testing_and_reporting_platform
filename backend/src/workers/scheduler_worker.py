"""Scheduler loop — runs as a greenlet inside the backend.

The scheduler is merged into the backend process (no separate container, no OS
thread). Because the backend can run as many gunicorn workers/replicas, each
would otherwise poll independently; a Postgres advisory lock makes exactly one
of them the active scheduler at any moment, with automatic failover if that one
dies. ``process_due`` itself also uses FOR UPDATE SKIP LOCKED, so correctness
never depends on the advisory lock — it only keeps the scheduler acting as one.
"""
from __future__ import annotations

import time

from sqlalchemy import text

from src.config import Config
from src.core.db import session_scope
from src.execution.queue import reap_dead_workers, reap_stale
from src.scheduling.service import process_due
from framework.tracing import get_tracer
from framework.commons.logger import logger as log

tracer = get_tracer()

# Arbitrary constant key for pg_try_advisory_lock — identifies "the scheduler".
_SCHED_LOCK_KEY = 8123571

_stop = False


def request_stop() -> None:
    global _stop
    _stop = True


def run_scheduler() -> None:
    log.info("scheduler ready (greenlet, advisory-lock gated)")
    while not _stop:
        try:
            with tracer.start_as_current_span("scheduling.tick") as span:
                with session_scope() as db:
                    acquired = db.execute(
                        text("SELECT pg_try_advisory_lock(:k)"), {"k": _SCHED_LOCK_KEY}
                    ).scalar()
                    span.set_attribute("scheduler.lock_acquired", bool(acquired))
                    if acquired:
                        try:
                            enqueued = process_due(db)
                            reaped = reap_stale(db)
                            dropped = reap_dead_workers(db)
                            span.set_attribute("scheduler.enqueued", enqueued)
                            span.set_attribute("scheduler.reaped", reaped)
                            span.set_attribute("scheduler.workers_dropped", dropped)
                            if enqueued:
                                log.info(f"scheduler enqueued {enqueued} run(s)")
                            if reaped:
                                log.info(f"scheduler reaped {reaped} stale run(s)")
                            if dropped:
                                log.info(f"scheduler dropped {dropped} dead worker(s)")
                        except Exception:
                            # A statement error leaves PostgreSQL's transaction
                            # aborted. Roll it back before issuing the unlock so
                            # the original failure is preserved and the
                            # session-level advisory lock is always released.
                            db.rollback()
                            raise
                        finally:
                            db.execute(
                                text("SELECT pg_advisory_unlock(:k)"),
                                {"k": _SCHED_LOCK_KEY},
                            )
        except Exception as e:  # pragma: no cover
            log.warning(f"scheduler tick failed: {e}")
        time.sleep(Config.SCHEDULER_POLL_SECONDS)
    log.info("scheduler stopped")
