"""QTP backend — local dev runner.

Production serves the app with gunicorn + gevent workers:

    gunicorn -c gunicorn.conf.py wsgi:app

This module is a convenience for running the backend without gunicorn (e.g.
``python main.py`` during local development). It reuses the exact same app —
including the scheduler greenlet and Kafka producer wiring — built in wsgi.py,
which monkey-patches gevent at import time before anything else loads.
"""
import signal
import sys

from wsgi import Config, app
from framework.commons.logger import logger as log


def _signal_handler(signum, _frame):
    log.info(f"shutdown signal received: {signal.Signals(signum).name}")
    sys.exit(0)


def main() -> None:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)
    log.info(f"serving qtp backend (dev) on 0.0.0.0:{Config.API_PORT}")
    app.run(host="0.0.0.0", port=Config.API_PORT, debug=False)


if __name__ == "__main__":
    main()
