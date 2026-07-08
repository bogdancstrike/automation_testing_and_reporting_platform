"""QTP backend WSGI entrypoint (gunicorn target: ``wsgi:app``).

The backend is the modulith's API + scheduler deployable. It is served by
gunicorn with gevent workers (``gunicorn -c gunicorn.conf.py wsgi:app``); each
gunicorn gevent worker imports this module, which:

  1. monkey-patches gevent FIRST so all I/O (sockets, psycopg2, kafka) is async;
  2. builds the Flask API via QF FrameworkApp (enable_etl=False — the backend is
     a Kafka *producer*, not a consumer);
  3. ensures the runs topic exists with the configured partition count;
  4. spawns the scheduler as a greenlet (no OS thread), gated by a Postgres
     advisory lock so exactly one scheduler is active across every gunicorn
     worker and replica — "merged with the backend, acts as one".
"""
# gevent monkey-patching MUST run before anything imports ssl/socket/threading.
from gevent import monkey  # noqa: E402

monkey.patch_all()

try:  # make psycopg2 yield to the gevent hub instead of blocking it
    import psycogreen.gevent

    psycogreen.gevent.patch_psycopg()
except Exception:  # pragma: no cover
    pass

import sys  # noqa: E402
from pathlib import Path  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.config import Config  # noqa: E402
from framework.app import FrameworkApp, FrameworkSettings  # noqa: E402
from framework.commons.logger import logger as log  # noqa: E402
import src.models_all  # noqa: E402, F401 - Register models and db_events


def _build_app():
    settings = FrameworkSettings(
        enable_etl=False,            # backend produces to Kafka; workers consume
        enable_api=True,
        enable_dynamic_endpoints=True,
        api_host="0.0.0.0",
        api_port=Config.API_PORT,
        api_version="1.0",
        api_title="Quality Testing Platform API",
        api_description="QTP — automation testing, request builder, scheduling, dashboards",
        endpoint_json_path="maps/endpoint.json",
        enable_tracing=Config.ENABLE_TRACING,
        otlp_endpoint=Config.OTLP_ENDPOINT,
        service_name=Config.SERVICE_NAME,
    )
    fw = FrameworkApp(settings, app_root=BASE_DIR)
    handles = fw.run()
    flask_app = handles.app

    from src.core.correlation import install_flask_hooks
    from src.core.errors import install_flask_error_handlers

    install_flask_hooks(flask_app)
    install_flask_error_handlers(flask_app)

    # Producer side: create the runs topic with KAFKA_RUNS_PARTITIONS partitions
    # so run dispatch actually spreads across the worker group.
    try:
        from src.core.kafka_bus import ensure_runs_topic

        ensure_runs_topic()
    except Exception as e:  # pragma: no cover
        log.warning(f"could not ensure kafka runs topic at startup: {e}")

    # Scheduler merged into the backend: a greenlet, not a thread or a separate
    # container. The advisory lock inside run_scheduler keeps it single-active.
    if Config.SCHEDULER_ENABLED:
        import gevent

        from src.workers.scheduler_worker import run_scheduler

        gevent.spawn(run_scheduler)
        log.info("scheduler greenlet spawned inside backend")

    log.info(f"qtp backend ready (service={Config.SERVICE_NAME} port={Config.API_PORT})")
    return flask_app


app = _build_app()
