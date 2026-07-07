"""Execution worker loop: claim → execute → persist, capability-aware."""
from __future__ import annotations

import time

from src.config import Config
from src.core.clock import utcnow
from src.core.db import session_scope
from src.execution import queue
from src.execution.models import TestRun, Worker
from src.execution.runner import execute_run
from framework.commons.logger import logger as log

_stop = False


def request_stop() -> None:
    global _stop
    _stop = True


def run_worker() -> None:
    name = Config.WORKER_NAME
    caps = Config.WORKER_CAPABILITIES
    with session_scope() as db:
        queue.register_worker(db, name, caps)
    log.info(f"worker {name} ready, capabilities={caps}")

    while not _stop:
        claimed_id = None
        try:
            with session_scope() as db:
                queue.reap_stale(db)
                run = queue.claim_next(db, name, caps)
                if run is not None:
                    claimed_id = run.id
                    queue.heartbeat(db, name, status="busy", current_run_id=run.id)
        except Exception as e:  # pragma: no cover
            log.warning(f"claim failed: {e}")
            time.sleep(Config.WORKER_POLL_SECONDS)
            continue

        if claimed_id is None:
            with session_scope() as db:
                queue.heartbeat(db, name, status="idle", current_run_id=None)
            time.sleep(Config.WORKER_POLL_SECONDS)
            continue

        try:
            with session_scope() as db:
                run = db.get(TestRun, claimed_id)
                execute_run(db, run, name)
                queue.complete(db, run.id)
                w = db.get(Worker, name)
                if w:
                    w.runs_completed += 1
                    w.status = "idle"
                    w.current_run_id = None
                    w.last_heartbeat = utcnow()
            log.info(f"run {claimed_id} finished")
        except Exception as e:  # pragma: no cover
            log.exception(f"run {claimed_id} crashed: {e}")
            with session_scope() as db:
                run = db.get(TestRun, claimed_id)
                if run and run.status in ("claimed", "running"):
                    run.status = "error"
                    run.error_category = "unknown_error"
                    run.error_message = str(e)
                    run.finished_at = utcnow()
                    queue.complete(db, run.id)

    log.info(f"worker {name} stopped")
