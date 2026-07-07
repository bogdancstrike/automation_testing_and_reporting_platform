"""Durable PostgreSQL run queue: capability-aware claim with SKIP LOCKED."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import Config
from src.core.clock import utcnow
from src.execution.models import RunQueue, TestRun, Worker


def register_worker(db: Session, name: str, capabilities: tuple[str, ...]) -> None:
    w = db.get(Worker, name)
    if w is None:
        db.add(Worker(name=name, capabilities=list(capabilities), status="idle",
                      last_heartbeat=utcnow()))
    else:
        w.capabilities = list(capabilities)
        w.status = "idle"
        w.last_heartbeat = utcnow()


def heartbeat(db: Session, name: str, *, status: str | None = None,
              current_run_id: str | None = ...) -> None:  # type: ignore[assignment]
    w = db.get(Worker, name)
    if w:
        w.last_heartbeat = utcnow()
        if status is not None:
            w.status = status
        if current_run_id is not ...:
            w.current_run_id = current_run_id


def heartbeat_upsert(db: Session, name: str, capabilities: tuple[str, ...]) -> None:
    """Touch a worker's heartbeat, re-creating its row if it was reaped.

    Used by the worker liveness loop. Re-creating on a missing row means a live
    worker that was briefly reaped (e.g. it stalled past the stale window) simply
    re-appears on its next heartbeat, while a genuinely dead worker stays gone.
    Only ``last_heartbeat`` is touched on an existing row, so the busy/idle status
    set by the run executor is preserved.
    """
    w = db.get(Worker, name)
    if w is None:
        db.add(Worker(name=name, capabilities=list(capabilities), status="idle",
                      last_heartbeat=utcnow()))
    else:
        w.last_heartbeat = utcnow()


def reap_dead_workers(db: Session) -> int:
    """Delete worker rows whose heartbeat went stale, so `/workers` reflects only
    the workers that are actually running (scale down → the row disappears)."""
    cutoff = utcnow() - timedelta(seconds=Config.WORKER_STALE_SECONDS)
    dead = db.scalars(select(Worker).where(Worker.last_heartbeat < cutoff)).all()
    for w in dead:
        db.delete(w)
    return len(dead)


def claim_next(db: Session, name: str, capabilities: tuple[str, ...]) -> TestRun | None:
    """Claim one queued item this worker is capable of running."""
    now = utcnow()
    stmt = (
        select(RunQueue)
        .where(
            RunQueue.status == "queued",
            RunQueue.available_at <= now,
            RunQueue.capability.in_(list(capabilities)),
        )
        .order_by(RunQueue.priority.desc(), RunQueue.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    item = db.scalars(stmt).first()
    if item is None:
        return None
    run = db.get(TestRun, item.test_run_id)
    if run is None or run.status != "queued":
        item.status = "done"
        return None
    item.status = "claimed"
    item.claimed_by = name
    item.claimed_at = now
    run.status = "claimed"
    run.worker_name = name
    return run


def complete(db: Session, run_id: str) -> None:
    for item in db.scalars(select(RunQueue).where(RunQueue.test_run_id == run_id)).all():
        item.status = "done"


def reap_stale(db: Session) -> int:
    """Mark runs whose worker died as error/worker_lost, and free the queue."""
    cutoff = utcnow() - timedelta(seconds=Config.WORKER_STALE_SECONDS)
    dead = {w.name for w in db.scalars(select(Worker).where(Worker.last_heartbeat < cutoff)).all()}
    if not dead:
        return 0
    n = 0
    stuck = db.scalars(select(TestRun).where(TestRun.stats_reset_at.is_(None), TestRun.status.in_(["claimed", "running"]))).all()
    for run in stuck:
        if run.worker_name in dead:
            run.status = "error"
            run.error_category = "worker_lost"
            run.error_message = "worker heartbeat timed out"
            run.finished_at = utcnow()
            complete(db, run.id)
            n += 1
    return n
