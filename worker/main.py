"""QTP worker — local dev runner.

Production serves the worker with gunicorn + gevent workers:

    PYTHONPATH=../backend gunicorn -c gunicorn.conf.py wsgi:app

This is a convenience for running one worker without gunicorn. The Kafka ETL
consumer greenlet is already started by importing wsgi; here we just keep the
process alive (and optionally serve /health via the Flask dev server).
"""
import signal
import sys

from wsgi import Config, app
from framework.commons.logger import logger as log


def _signal_handler(signum, _frame):
    log.info(f"shutdown signal received: {signal.Signals(signum).name}")
    from src.workers.execution_worker import request_stop

    request_stop()
    sys.exit(0)


def main() -> None:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)
    port = int(__import__("os").getenv("WORKER_HTTP_PORT", "5200"))
    log.info(f"serving qtp worker (dev) health on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    main()
