"""Gunicorn config for the QTP backend (API + scheduler).

Gevent workers give async I/O and process-based horizontal scaling: raise
``GUNICORN_WORKERS`` (or add replicas) to scale the API. The scheduler greenlet
spawned in wsgi.py runs inside every worker but self-limits to one active
scheduler via a Postgres advisory lock, so scaling workers is safe.
"""
import os

bind = f"0.0.0.0:{os.getenv('API_PORT', '5100')}"
worker_class = "gevent"
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
worker_connections = int(os.getenv("GUNICORN_WORKER_CONNECTIONS", "1000"))
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = 5
# Do NOT preload: each worker must import the app after gevent has patched, and
# each needs its own scheduler greenlet / DB engine.
preload_app = False
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info").lower()
