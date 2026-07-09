"""Kafka work-distribution bus.

The backend (producer) publishes one message per enqueued run onto the runs
topic; the worker consumer group (see ``src/workers/kafka_runner.py``) splits the
topic's partitions across replicas and executes them. Keying each message by run
id pins a run to a single partition, so exactly one worker in the group handles
it — that is the "claim" for the Kafka-based design.

This module wraps the QF framework's ``KafkaClient`` (a thread-safe singleton
producer/admin) so the rest of the app never touches kafka-python directly.
"""
from __future__ import annotations

import json

from src.config import Config
from framework.commons.logger import logger as log
from framework.streams.kafka_client import KafkaClient
from framework.tracing import get_tracer

tracer = get_tracer()

_client: KafkaClient | None = None
_topic_ready = False


def get_client() -> KafkaClient:
    """Return the shared KafkaClient singleton (connects on first use)."""
    global _client
    if _client is None:
        _client = KafkaClient(
            bootstrap_servers=Config.KAFKA_BOOTSTRAP_SERVERS,
            security_protocol=None,
        )
    return _client


def ensure_runs_topic() -> None:
    """Create the runs topic with the configured partition count (idempotent).

    Kafka auto-creation would give the topic a single partition, which would
    serialize all runs onto one worker. We create it explicitly with
    ``KAFKA_RUNS_PARTITIONS`` so load actually spreads across the group.
    """
    global _topic_ready
    if _topic_ready:
        return
    try:
        get_client().create_topic(
            Config.KAFKA_RUNS_TOPIC,
            num_partitions=Config.KAFKA_RUNS_PARTITIONS,
            replication_factor=1,
            retention_time="604800000",  # 7 days
        )
        _topic_ready = True
        log.info(
            f"kafka runs topic ready: {Config.KAFKA_RUNS_TOPIC} "
            f"partitions={Config.KAFKA_RUNS_PARTITIONS}"
        )
    except Exception as e:  # pragma: no cover - best effort at startup
        log.warning(f"could not ensure kafka runs topic (will retry on publish): {e}")


def publish_run(run_id: str, capability: str = "http") -> None:
    """Publish a run onto the runs topic, keyed by run id.

    Best-effort: a publish failure is logged but never raised, because the DB
    transaction that created the run has already committed by the time this is
    called (see ``session_scope``). The run row remains queued and is picked up
    by ``reap``/backfill tooling if the message is lost.
    """
    with tracer.start_as_current_span("execution.publish_run") as span:
        span.set_attribute("run.id", run_id)
        span.set_attribute("run.capability", capability)
        span.set_attribute("kafka.topic", Config.KAFKA_RUNS_TOPIC)
        # The QF KafkaClient injects the current W3C trace context onto the Kafka
        # message headers (see framework.tracing.inject_trace_headers), so the
        # worker continues this SAME distributed trace when it consumes the run —
        # the trace spans backend enqueue → worker consume → execute → every HTTP call.
        try:
            ensure_runs_topic()
            get_client().put_message(
                Config.KAFKA_RUNS_TOPIC,
                json.dumps({"run_id": run_id, "capability": capability}),
                key=run_id,
            )
            log.debug(f"published run {run_id} to {Config.KAFKA_RUNS_TOPIC}")
        except Exception as e:
            span.set_attribute("kafka.publish_error", str(e))
            log.error(f"failed to publish run {run_id} to kafka: {e}")
