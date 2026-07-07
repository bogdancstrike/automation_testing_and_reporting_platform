"""Scheduler loop: enqueue due schedules. Never executes tests."""
from __future__ import annotations

import time

from src.config import Config
from src.core.db import session_scope
from src.scheduling.service import process_due
from framework.commons.logger import logger as log

_stop = False


def request_stop() -> None:
    global _stop
    _stop = True


def run_scheduler() -> None:
    log.info("scheduler ready")
    while not _stop:
        try:
            with session_scope() as db:
                n = process_due(db)
            if n:
                log.info(f"scheduler enqueued {n} run(s)")
        except Exception as e:  # pragma: no cover
            log.warning(f"scheduler tick failed: {e}")
        time.sleep(Config.SCHEDULER_POLL_SECONDS)
    log.info("scheduler stopped")
