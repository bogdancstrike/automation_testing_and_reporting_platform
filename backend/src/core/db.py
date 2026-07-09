"""SQLAlchemy engine, session, and declarative Base.

PostgreSQL is the source of truth. A single engine/sessionmaker is shared
across the API, worker, and scheduler processes.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from src.config import Config

_engine = None
_SessionLocal: sessionmaker | None = None


class Base(DeclarativeBase):
    pass


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(
            Config.DATABASE_URL,
            pool_size=Config.DB_POOL_SIZE,
            max_overflow=Config.DB_MAX_OVERFLOW,
            pool_timeout=Config.DB_POOL_TIMEOUT,
            pool_pre_ping=True,
            future=True,
        )
    return _engine


def _sessionmaker() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), expire_on_commit=False, future=True)
    return _SessionLocal


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional session scope: commit on success, rollback on error.

    After a successful commit, any runs stashed on ``session.info["pending_runs"]``
    (by ``execution.service.enqueue_run``) are published to Kafka. This is a
    transactional-outbox boundary: the run row is durably committed *before* the
    worker can ever see the message, so a worker never races an uncommitted run.
    Publishing is best-effort and never rolls back the committed work.
    """
    session = _sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    else:
        _publish_pending_runs(session)
    finally:
        session.close()


def _publish_pending_runs(session: Session) -> None:
    pending = session.info.pop("pending_runs", None)
    if not pending:
        return
    # Imported here to avoid a core→kafka import at module load (keeps `core`
    # importable in tooling/tests that never touch Kafka).
    from src.core.kafka_bus import publish_run
    for item in pending:
        run_id, capability = item[0], item[1]
        scenario_key = item[2] if len(item) > 2 else None
        scenario_name = item[3] if len(item) > 3 else None
        publish_run(run_id, capability, scenario_key=scenario_key, scenario_name=scenario_name)


def new_session() -> Session:
    """A bare session the caller manages (used by long-lived worker loops)."""
    return _sessionmaker()()
