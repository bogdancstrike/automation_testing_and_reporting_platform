"""Top-level config shim.

The QF framework hard-codes ``app.config.from_object('config.Config')`` in
``framework.api.server.create_app`` AND ``framework.etl.framework_etl`` imports
``from config import Config`` at module load time. Both require a *top-level*
importable ``config`` module — ``src/config.py`` alone is not found. This shim
re-exports the real settings so QF is satisfied regardless of how the process
is launched.
"""
from src.config import Config  # noqa: F401
