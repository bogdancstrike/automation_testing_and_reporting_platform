"""QTP — execution worker entry point.

Claims queued runs from PostgreSQL (FOR UPDATE SKIP LOCKED) and executes them
through the testkit adapters. One test per claim; capability-aware.
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
    from src.workers.execution_worker import request_stop
    request_stop()


def main() -> None:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)
    log.info(f"starting qtp execution worker name={Config.WORKER_NAME} caps={Config.WORKER_CAPABILITIES}")
    from src.workers.execution_worker import run_worker
    run_worker()


if __name__ == "__main__":
    main()
