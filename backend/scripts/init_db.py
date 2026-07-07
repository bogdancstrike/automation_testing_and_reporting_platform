#!/usr/bin/env python3
"""Create tables and seed the demo data.

Idempotent: safe to re-run. Seeds one project, the demo httpbin target, discovers
code-based tests, creates a sample UI request test, a schedule, and enqueues one
immediate run so the dashboard has data on first load.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from sqlalchemy import select, text  # noqa: E402

from src.config import Config  # noqa: E402
from src.core.db import Base, get_engine, session_scope  # noqa: E402
import src.models_all  # noqa: E402,F401  (populates Base.metadata)
from src.catalog.models import Project, Target, TestDefinition  # noqa: E402
from src.catalog import service as catalog  # noqa: E402
from src.execution.service import enqueue_run  # noqa: E402
from src.scheduling.models import Schedule  # noqa: E402
from src.scheduling.service import create_schedule  # noqa: E402
from framework.commons.logger import logger as log  # noqa: E402

DEMO_TARGET_URL = os.getenv("DEMO_TARGET_URL", "http://httpbin:8080")


def wait_for_db(timeout: int = 60) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as e:
            log.info(f"waiting for postgres: {e}")
            time.sleep(2)
    raise RuntimeError("postgres not reachable")


def main() -> int:
    wait_for_db()
    log.info("creating tables (create_all)")
    Base.metadata.create_all(get_engine())

    # Create the Kafka runs topic up front with the configured partition count
    # (10), so run dispatch spreads across the worker group instead of Kafka
    # auto-creating it with a single partition.
    try:
        from src.core.kafka_bus import ensure_runs_topic
        ensure_runs_topic()
    except Exception as e:
        log.warning(f"could not ensure kafka runs topic at init: {e}")

    with session_scope() as db:
        project = db.scalars(select(Project).where(Project.key == "default")).first()
        if not project:
            project = Project(key="default", name="Default Project")
            db.add(project)
            db.flush()
            log.info("seeded project 'default'")

        target = db.scalars(select(Target).where(Target.key == "demo")).first()
        if not target:
            catalog.create_target(db, {
                "key": "demo", "name": "Demo (httpbin)", "base_url": DEMO_TARGET_URL,
                "health_url": f"{DEMO_TARGET_URL}/status/200", "tags": ["demo"],
            })
            log.info(f"seeded target 'demo' -> {DEMO_TARGET_URL}")

        if not db.scalars(select(Target).where(Target.key == "qtp_self")).first():
            catalog.create_target(db, {
                "key": "qtp_self", "name": "QTP itself (self-tests)",
                "base_url": Config.SELF_TARGET_URL,
                "health_url": f"{Config.SELF_TARGET_URL}/health", "tags": ["self"],
            })
            log.info(f"seeded target 'qtp_self' -> {Config.SELF_TARGET_URL}")

    # Discover code-based tests (the healthcheck example).
    with session_scope() as db:
        result = catalog.discover_tests(db)
        log.info(f"discovery: {result}")

    # Sample UI request test (asserts on the response BODY, not just status).
    with session_scope() as db:
        if not db.scalars(select(TestDefinition).where(TestDefinition.key == "ui.httpbin_get")).first():
            catalog.create_request_test(db, {
                "key": "ui.httpbin_get",
                "name": "httpbin GET (body check)",
                "config": {
                    "target": "demo",
                    "method": "GET",
                    "url": "{{base_url}}/get?team=qtp",
                    "assertions": [
                        {"type": "status_code", "operator": "equals", "expected": 200},
                        {"type": "json_path", "path": "$.args.team", "operator": "contains", "expected": "qtp"},
                        {"type": "response_time_ms", "operator": "lte", "expected": 5000},
                    ],
                },
            })
            log.info("seeded UI request test 'ui.httpbin_get'")

    # A schedule + one immediate run so there is data on first load.
    with session_scope() as db:
        hc = db.scalars(select(TestDefinition).where(TestDefinition.key == "api.target_healthcheck")).first()
        if hc:
            if not db.scalars(select(Schedule).where(Schedule.test_definition_id == hc.id)).first():
                create_schedule(db, {
                    "test_definition_id": hc.id, "name": "Healthcheck every 3 min",
                    "recurrence_type": "interval", "interval_seconds": 180, "is_enabled": True,
                })
                log.info("seeded schedule for healthcheck")
            enqueue_run(db, hc, trigger="manual")
            log.info("enqueued one immediate healthcheck run")

    log.info("init complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
