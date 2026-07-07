"""QTP — scheduler entry point.

Polls due schedules, creates run intents, and advances next_run_at atomically.
Never executes tests itself — the worker owns execution.
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
    from src.workers.scheduler_worker import request_stop
    request_stop()


def main() -> None:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)
    log.info("starting qtp scheduler")
    from src.workers.scheduler_worker import run_scheduler
    run_scheduler()


if __name__ == "__main__":
    main()
