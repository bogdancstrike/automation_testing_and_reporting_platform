"""Audit module — immutable ledger for actor / action / entity records.

Exposes:
  * `service.record(...)` — single entry point for writing audit rows.
  * `service.list_` — list audit events.
"""

from src.audit import service  # noqa: F401
