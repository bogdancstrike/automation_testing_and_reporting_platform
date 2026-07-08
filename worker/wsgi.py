"""QTP worker WSGI entrypoint (gunicorn target: ``wsgi:app``).

The worker is a separate entrypoint of the same modulith (it imports the shared
``src`` package from ``backend/`` via ``PYTHONPATH=/app/backend``). It is a Kafka
*consumer*: every gunicorn gevent worker process joins the ``WORKER_NAME``
consumer group and the broker splits the runs-topic partitions across them, so
scaling gunicorn workers / replicas scales execution horizontally.

Run it with:

    PYTHONPATH=/app/backend gunicorn -c gunicorn.conf.py wsgi:app
"""
# 1) gevent first: turns the QF ETL's internal threads into greenlets and makes
#    all socket/DB/kafka I/O cooperative (no OS threads for scaling).
from gevent import monkey  # noqa: E402

monkey.patch_all()

try:
    import psycogreen.gevent

    psycogreen.gevent.patch_psycopg()
except Exception:  # pragma: no cover
    pass

# 2) kafka-python 2.3.x compatibility: the QF ETL commits offsets with
#    OffsetAndMetadata(offset, metadata); newer kafka-python added a required
#    leader_epoch field. Give it a default so manual commits work. This MUST run
#    before framework.etl (imported transitively by framework.app) is loaded.
from collections import namedtuple as _nt  # noqa: E402

import kafka.structs as _ks  # noqa: E402

_ks.OffsetAndMetadata = _nt(
    "OffsetAndMetadata", ["offset", "metadata", "leader_epoch"], defaults=[0]
)

import sys  # noqa: E402
from pathlib import Path  # noqa: E402

WORKER_DIR = Path(__file__).resolve().parent
BACKEND_DIR = WORKER_DIR.parent / "backend"
# Shared modulith code (src, config, maps) lives in backend/; worker-only modules
# (kafka_runner) live here. Both on the path.
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(WORKER_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.config import Config  # noqa: E402
from framework.app import FrameworkApp, FrameworkSettings  # noqa: E402
from framework.commons.logger import logger as log  # noqa: E402
import src.models_all  # noqa: E402, F401 - Register models and db_events


def _install_worker_routes(flask_app) -> None:
    @flask_app.route("/health")
    def _health():  # pragma: no cover - trivial
        return {
            "status": "ok",
            "role": "worker",
            "instance": Config.WORKER_INSTANCE_ID,
            "group": Config.WORKER_NAME,
        }, 200

    @flask_app.route("/liveness")
    def _liveness():  # pragma: no cover - trivial
        return {"status": "alive"}, 200


def _build_app():
    from framework.app import FrameworkApp, FrameworkSettings

    # Ensure the runs topic exists with the right partition count BEFORE the ETL
    # consumer subscribes, otherwise Kafka would auto-create it with 1 partition
    # and serialize all runs onto a single worker.
    try:
        from src.core.kafka_bus import ensure_runs_topic

        ensure_runs_topic()
    except Exception as e:  # pragma: no cover
        log.warning(f"could not ensure kafka runs topic before consume: {e}")

    settings = FrameworkSettings(
        enable_etl=True,                 # this process IS the Kafka consumer
        enable_api=True,                 # expose /health so gunicorn has a WSGI app
        enable_dynamic_endpoints=False,  # no domain API on the worker
        api_host="0.0.0.0",
        api_port=int(__import__("os").getenv("WORKER_HTTP_PORT", "5200")),
        api_title="QTP Worker",
        api_description="QTP execution worker (Kafka consumer)",
        # The @kafka_handler in worker/kafka_runner.py registers on import.
        worker_modules=["kafka_runner"],
        kafka_bootstrap_servers=Config.KAFKA_BOOTSTRAP_SERVERS,
        # consumer_name is the per-instance label passed to the handler; the
        # consumer *group* is Config.WORKER_NAME (used by the ETL as group_id).
        consumer_name=Config.WORKER_INSTANCE_ID,
        enable_tracing=Config.ENABLE_TRACING,
        otlp_endpoint=Config.OTLP_ENDPOINT,
        service_name=Config.SERVICE_NAME,
        init_app=_install_worker_routes,
    )

    fw = FrameworkApp(settings, app_root=BACKEND_DIR)
    handles = fw.run()  # starts the ETL consumer as a greenlet under gevent

    # Register this instance in the workers table and keep its heartbeat fresh so
    # the Workers dashboard and reap_stale see the replica (greenlet, no thread).
    import gevent

    from src.workers.execution_worker import run_liveness_loop

    gevent.spawn(run_liveness_loop)

    log.info(
        f"qtp worker ready (instance={Config.WORKER_INSTANCE_ID} "
        f"group={Config.WORKER_NAME} topic={Config.KAFKA_RUNS_TOPIC})"
    )
    return handles.app


app = _build_app()
