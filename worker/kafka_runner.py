"""Kafka run executor — the horizontally-scalable worker.

Registered with the QF ETL framework via ``@kafka_handler``. Every worker replica
runs this same handler and joins the ``WORKER_NAME`` consumer group, so Kafka
splits the runs-topic partitions across replicas: add a replica and partitions
rebalance onto it, giving horizontal scale-out with no coordination code here.

Because each run is produced keyed by its id, it lands on exactly one partition
and is therefore delivered to exactly one worker in the group — that delivery is
the "claim". We still guard on run status for idempotency in case Kafka
redelivers after a rebalance (at-least-once).
"""
from __future__ import annotations

from framework.decorators import kafka_handler
from framework.tracing import get_tracer

from src.config import Config
from src.core.clock import utcnow
from src.core.db import session_scope
from src.execution import queue
from src.execution.models import TestRun, Worker
from src.execution.runner import execute_run, mark_run_running
from src.testkit.result import TERMINAL_STATUSES
from framework.commons.logger import logger as log

tracer = get_tracer()


@kafka_handler(
    name="qtp_run_executor",
    topics_in=[Config.KAFKA_RUNS_TOPIC],
    # topics_out is required by the framework; we return None so nothing is
    # actually forwarded — the run's outcome is persisted to Postgres instead.
    topics_out=[Config.KAFKA_WORKER_EVENTS_TOPIC],
    max_workers=Config.WORKER_MAX_CONCURRENCY,
    metadatas={"worker": "qtp_run_executor"},
)
def execute_run_message(message: dict, consumer_name: str, metadatas: dict):
    """Consume one run message and execute it. Returns None (no output topic)."""
    run_id = message.get("run_id")
    instance = Config.WORKER_INSTANCE_ID
    if not run_id:
        log.warning("run message missing run_id; skipping")
        return None

    # The QF ETL runtime already extracts the W3C trace context from the Kafka
    # message headers and runs this handler inside a `kafka.consume` span, so this
    # span is automatically a child of the backend's enqueue trace — the whole run
    # (enqueue → consume → execute → HTTP calls) is one Jaeger trace.
    with tracer.start_as_current_span("worker.consume_run") as span:
        span.set_attribute("run.id", run_id)
        span.set_attribute("worker.instance", instance)
        span.set_attribute("worker.group", Config.WORKER_NAME)

        with session_scope() as db:
            run = db.get(TestRun, run_id)
            if run is None:
                span.set_attribute("run.skipped", "not_found")
                log.warning(f"run {run_id} not found; skipping")
                return None
            if run.stats_reset_at is not None:
                span.set_attribute("run.skipped", "stats_reset")
                queue.complete(db, run.id)
                log.info(f"run {run_id} was stats-reset; skipping")
                return None
            if run.status in TERMINAL_STATUSES:
                span.set_attribute("run.skipped", f"terminal:{run.status}")
                log.info(f"run {run_id} already {run.status}; skipping (redelivery)")
                return None
            if run.status == "running":
                span.set_attribute("run.skipped", "active:running")
                log.info(f"run {run_id} is already running; skipping (redelivery)")
                return None
            span.set_attribute("test.definition_id", run.scenario_id)
            mark_run_running(db, run, instance)
            queue.heartbeat(db, instance, status="busy", current_run_id=run.id)

        try:
            with session_scope() as db:
                run = db.get(TestRun, run_id)
                execute_run(db, run, instance)
                queue.complete(db, run.id)
                w = db.get(Worker, instance)
                if w:
                    w.runs_completed += 1
                    w.status = "idle"
                    w.current_run_id = None
                    w.last_heartbeat = utcnow()
            span.set_attribute("run.status", "completed")
            log.info(f"run {run_id} finished on {instance}")
        except Exception as e:
            span.record_exception(e)
            span.set_attribute("run.status", "error")
            log.exception(f"run {run_id} crashed on {instance}: {e}")
            # Best-effort: mark the run errored so it does not hang in `running`.
            # If even this fails (e.g. DB is down), reap_stale in the backend
            # marks it worker_lost once the heartbeat goes stale. We swallow so
            # the ETL commits the offset — no redelivery storm on a bad run.
            try:
                with session_scope() as db:
                    run = db.get(TestRun, run_id)
                    if run and run.status in ("claimed", "preparing", "running"):
                        run.status = "error"
                        run.error_category = "unknown_error"
                        run.error_message = str(e)
                        run.finished_at = utcnow()
                        queue.complete(db, run.id)
            except Exception as e2:  # pragma: no cover - defensive
                log.error(f"could not mark run {run_id} errored: {e2}")

    return None
