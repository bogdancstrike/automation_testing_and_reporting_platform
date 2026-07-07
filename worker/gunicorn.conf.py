"""Gunicorn config for the QTP worker (Kafka consumer + /health).

Each gunicorn gevent worker process boots one QF ETL consumer that joins the
shared ``WORKER_NAME`` group, so Kafka distributes the runs-topic partitions
across every worker process and every replica. Scale by raising
``GUNICORN_WORKERS`` and/or the compose ``replicas`` — the broker rebalances
partitions automatically.

Kept at 1 worker per container by default so each container maps to exactly one
row in the ``workers`` table (WORKER_INSTANCE_ID = container hostname); scale out
with replicas instead.
"""
import os

bind = f"0.0.0.0:{os.getenv('WORKER_HTTP_PORT', '5200')}"
worker_class = "gevent"
workers = int(os.getenv("GUNICORN_WORKERS", "1"))
worker_connections = int(os.getenv("GUNICORN_WORKER_CONNECTIONS", "1000"))
# Test execution can be long; give the ETL greenlet room and don't let gunicorn
# reap the worker for a slow run.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "600"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
preload_app = False
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info").lower()
