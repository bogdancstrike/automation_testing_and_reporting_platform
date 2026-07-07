"""Worker liveness loop.

Execution itself is driven by Kafka (see ``kafka_runner.py``); this loop only
keeps the worker's row in the ``workers`` table fresh so the Workers dashboard
and ``reap_stale`` can see the replica is alive. Each replica registers under its
own ``WORKER_INSTANCE_ID`` (hostname), distinct from the shared ``WORKER_NAME``
consumer group.
"""
from __future__ import annotations

import time

from src.config import Config
from src.core.db import session_scope
from src.execution import queue
from framework.commons.logger import logger as log

_stop = False


def request_stop() -> None:
    global _stop
    _stop = True


def run_liveness_loop() -> None:
    instance = Config.WORKER_INSTANCE_ID
    caps = Config.WORKER_CAPABILITIES
    with session_scope() as db:
        queue.register_worker(db, instance, caps)
    log.info(f"worker {instance} registered (group={Config.WORKER_NAME}) capabilities={caps}")

    while not _stop:
        try:
            with session_scope() as db:
                queue.heartbeat_upsert(db, instance, caps)
        except Exception as e:  # pragma: no cover
            log.warning(f"heartbeat failed: {e}")
        time.sleep(Config.WORKER_HEARTBEAT_SECONDS)

    # Mark ourselves offline on a clean shutdown so the dashboard reflects it.
    try:
        with session_scope() as db:
            queue.heartbeat(db, instance, status="offline", current_run_id=None)
    except Exception:  # pragma: no cover
        pass
    log.info(f"worker {instance} stopped")
