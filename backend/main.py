"""QTP — API entry point.

Boots the HTTP API via QF Framework's FrameworkApp, then serves the Flask app
QF built. ``FrameworkApp.run()`` only registers endpoints; it does NOT bind a
server, so we call ``app.run(...)`` ourselves.
"""
import signal
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from src.config import Config  # noqa: E402
from framework.commons.logger import logger as log  # noqa: E402


def _signal_handler(signum, _frame):
    log.info(f"shutdown signal received: {signal.Signals(signum).name}")
    sys.exit(0)


def main() -> None:
    log.info(f"starting qtp api role={Config.ROLE} port={Config.API_PORT}")
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    # Best-effort DB warm-up; migrations/seed run separately.
    try:
        from sqlalchemy import text
        from src.core.db import get_engine
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        log.info("postgres reachable")
    except Exception as e:  # pragma: no cover
        log.warning(f"postgres not reachable yet: {e}")

    from framework.app import FrameworkApp, FrameworkSettings

    settings = FrameworkSettings(
        enable_etl=False,               # CRITICAL: default True raises without Kafka
        enable_api=True,
        enable_dynamic_endpoints=True,
        api_host="0.0.0.0",
        api_port=Config.API_PORT,
        api_version="1.0",
        api_title="QSINT Testing Platform API",
        api_description="QTP — automation testing, request builder, scheduling, dashboards",
        endpoint_json_path="maps/endpoint.json",
        enable_tracing=Config.ENABLE_TRACING,
        otlp_endpoint=Config.OTLP_ENDPOINT,
        service_name=Config.SERVICE_NAME,
    )

    fw = FrameworkApp(settings, app_root=BASE_DIR)
    handles = fw.run()

    if handles.app:
        from src.core.correlation import install_flask_hooks
        from src.core.errors import install_flask_error_handlers

        install_flask_hooks(handles.app)
        install_flask_error_handlers(handles.app)

        log.info(f"api listening on 0.0.0.0:{Config.API_PORT}")
        handles.app.run(host="0.0.0.0", port=Config.API_PORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
