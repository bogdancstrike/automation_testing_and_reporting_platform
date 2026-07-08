"""Reporting service: dashboard aggregates over runs and failures."""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import Float, String, cast, func, or_, select
from sqlalchemy.orm import Session

from src.catalog.models import Target, Scenario
from src.config import Config
from src.core.clock import utcnow
from src.execution.models import FailureSignature, TestRun, Worker

_TERMINAL = ["passed", "failed", "error", "timeout", "canceled", "skipped"]


def _iso(dt):
    return dt.isoformat() if dt else None


def overview(db: Session, *, hours: int = 24, start: datetime | None = None,
             end: datetime | None = None, filters: dict | None = None) -> dict:
    filters = filters or {}
    end = end or utcnow()
    since = start or (end - timedelta(hours=hours))

    status_counts = dict(
        db.execute(
            select(TestRun.status, func.count())
            .where(TestRun.stats_reset_at.is_(None), TestRun.queued_at >= since, TestRun.queued_at <= end)
            .group_by(TestRun.status)
        ).all()
    )
    total = sum(status_counts.values())
    passed = status_counts.get("passed", 0)
    failed = status_counts.get("failed", 0)
    errored = status_counts.get("error", 0)
    timed_out = status_counts.get("timeout", 0)
    finished = passed + failed + errored + timed_out

    durations = db.execute(
        select(
            func.percentile_cont(0.5).within_group(cast(TestRun.duration_ms, Float)),
            func.percentile_cont(0.95).within_group(cast(TestRun.duration_ms, Float)),
            func.avg(cast(TestRun.duration_ms, Float)),
        ).where(TestRun.stats_reset_at.is_(None), TestRun.queued_at >= since, TestRun.queued_at <= end, TestRun.duration_ms.isnot(None))
    ).first()
    p50, p95, avg = (durations or (None, None, None))

    # Hourly run trend.
    bucket = func.date_trunc("hour", TestRun.queued_at)
    trend_rows = db.execute(
        select(bucket.label("h"), TestRun.status, func.count())
        .where(TestRun.stats_reset_at.is_(None), TestRun.queued_at >= since, TestRun.queued_at <= end)
        .group_by("h", TestRun.status).order_by("h")
    ).all()
    trend: dict[str, dict] = {}
    for h, status, count in trend_rows:
        key = h.isoformat()
        trend.setdefault(key, {"bucket": key})
        trend[key][status] = count

    queue_backlog = db.scalar(select(func.count()).select_from(TestRun).where(TestRun.stats_reset_at.is_(None), TestRun.status == "queued"))
    active_workers = db.scalar(
        select(func.count()).select_from(Worker)
        .where(Worker.last_heartbeat >= utcnow() - timedelta(seconds=30))
    )
    cleanup_failures = db.scalar(
        select(func.count()).select_from(TestRun)
        .where(TestRun.stats_reset_at.is_(None), TestRun.queued_at >= since, TestRun.queued_at <= end, TestRun.cleanup_failed == True)
    )

    # Per-target health.
    tgt_rows = db.execute(
        select(TestRun.target_id, TestRun.status, func.count())
        .where(TestRun.stats_reset_at.is_(None), TestRun.queued_at >= since, TestRun.queued_at <= end, TestRun.target_id.isnot(None))
        .group_by(TestRun.target_id, TestRun.status)
    ).all()
    per_target: dict[str, dict] = {}
    for tid, status, count in tgt_rows:
        per_target.setdefault(tid, {"target_id": tid, "total": 0, "passed": 0, "failed": 0})
        per_target[tid]["total"] += count
        if status == "passed":
            per_target[tid]["passed"] += count
        elif status in ("failed", "error", "timeout"):
            per_target[tid]["failed"] += count
    tgt_names = {t.id: t.key for t in db.scalars(select(Target)).all()}
    for tid, row in per_target.items():
        row["target_key"] = tgt_names.get(tid)
        row["health_rate"] = round(row["passed"] / row["total"], 4) if row["total"] else None

    per_target_rows = list(per_target.values())
    if filters.get("per_target_q"):
        needle = str(filters["per_target_q"]).lower()
        per_target_rows = [r for r in per_target_rows if needle in str(r.get("target_key") or "").lower()]
    if filters.get("per_target_health"):
        health = filters["per_target_health"]
        if health == "healthy":
            per_target_rows = [r for r in per_target_rows if r.get("failed", 0) == 0 and r.get("total", 0) > 0]
        elif health == "degraded":
            per_target_rows = [r for r in per_target_rows if r.get("failed", 0) > 0]

    per_target_sort = filters.get("per_target_sort") or "total"
    per_target_order = str(filters.get("per_target_order") or "desc").lower()
    per_target_sorters = {
        "target_key": lambda r: r.get("target_key") or "",
        "total": lambda r: r.get("total") or 0,
        "passed": lambda r: r.get("passed") or 0,
        "failed": lambda r: r.get("failed") or 0,
        "health_rate": lambda r: r.get("health_rate") or 0,
    }
    per_target_rows = sorted(
        per_target_rows,
        key=per_target_sorters.get(per_target_sort, per_target_sorters["total"]),
        reverse=per_target_order == "desc",
    )

    return {
        "window_hours": hours,
        "totals": {
            "total_runs": total, "passed": passed, "failed": failed,
            "error": errored, "timeout": timed_out,
            "queued": status_counts.get("queued", 0),
            "running": status_counts.get("running", 0) + status_counts.get("claimed", 0),
            "canceled": status_counts.get("canceled", 0),
        },
        "pass_rate": round(passed / finished, 4) if finished else None,
        "error_rate": round((errored + timed_out) / finished, 4) if finished else None,
        "duration_ms": {"p50": p50, "p95": p95, "avg": round(avg, 1) if avg else None},
        "queue_backlog": queue_backlog or 0,
        "active_workers": active_workers or 0,
        "cleanup_failures": cleanup_failures or 0,
        "trend": sorted(trend.values(), key=lambda x: x["bucket"]),
        "per_target": per_target_rows,
    }


def failures(db: Session, *, hours: int = 168, start: datetime | None = None,
             end: datetime | None = None, filters: dict | None = None) -> dict:
    filters = filters or {}
    end = end or utcnow()
    since = start or (end - timedelta(hours=hours))

    sig_rows = db.scalars(
        select(FailureSignature).order_by(FailureSignature.occurrences.desc()).limit(20)
    ).all()
    signatures = [{
        "signature_hash": s.signature_hash, "category": s.category,
        "sample_message": s.sample_message, "occurrences": s.occurrences,
        "last_defect_type": s.last_defect_type,
        "first_seen": _iso(s.first_seen), "last_seen": _iso(s.last_seen),
    } for s in sig_rows]

    defect_rows = db.execute(
        select(TestRun.defect_type, func.count())
        .where(TestRun.stats_reset_at.is_(None), TestRun.queued_at >= since, TestRun.queued_at <= end, TestRun.status.in_(["failed", "error", "timeout"]))
        .group_by(TestRun.defect_type)
    ).all()
    defect_distribution = {(dt or "untriaged"): c for dt, c in defect_rows}

    latest_subq = (
        select(TestRun.id)
        .distinct(TestRun.scenario_id)
        .where(
            TestRun.stats_reset_at.is_(None),
            TestRun.queued_at >= since,
            TestRun.queued_at <= end,
        )
        .order_by(TestRun.scenario_id, TestRun.queued_at.desc())
    ).subquery()

    recent_stmt = (
        select(TestRun)
        .join(latest_subq, TestRun.id == latest_subq.c.id)
        .outerjoin(Scenario, TestRun.scenario_id == Scenario.id)
        .where(
            TestRun.status.in_(["failed", "error", "timeout"]),
        )
    )
    if filters.get("recent_failed_q"):
        like = f"%{filters['recent_failed_q']}%"
        recent_stmt = recent_stmt.where(or_(Scenario.name.ilike(like), Scenario.key.ilike(like)))
    if filters.get("recent_failed_status"):
        recent_stmt = recent_stmt.where(TestRun.status == filters["recent_failed_status"])
    if filters.get("recent_failed_error_category"):
        recent_stmt = recent_stmt.where(TestRun.error_category.ilike(f"%{filters['recent_failed_error_category']}%"))
    if filters.get("recent_failed_defect_type"):
        recent_stmt = recent_stmt.where(TestRun.defect_type == filters["recent_failed_defect_type"])
    if filters.get("recent_failed_finished_at"):
        recent_stmt = recent_stmt.where(cast(TestRun.finished_at, String).ilike(f"%{filters['recent_failed_finished_at']}%"))

    recent_sort = filters.get("recent_failed_sort") or "finished_at"
    recent_order = str(filters.get("recent_failed_order") or "desc").lower()
    recent_sorters = {
        "test_name": Scenario.name,
        "status": TestRun.status,
        "error_category": TestRun.error_category,
        "defect_type": TestRun.defect_type,
        "finished_at": TestRun.finished_at,
    }
    recent_column = recent_sorters.get(recent_sort, TestRun.finished_at)
    recent_stmt = recent_stmt.order_by(recent_column.desc() if recent_order == "desc" else recent_column.asc()).limit(50)
    recent = db.scalars(recent_stmt).all()
    defs = {d.id: d.name for d in db.scalars(select(Scenario)).all()}
    recent_failed = [{
        "id": r.id, "scenario_id": r.scenario_id, "test_name": defs.get(r.scenario_id),
        "status": r.status, "error_category": r.error_category,
        "defect_type": r.defect_type, "finished_at": _iso(r.finished_at),
    } for r in recent]

    return {"window_hours": hours, "signatures": signatures,
            "defect_distribution": defect_distribution, "recent_failed": recent_failed}


def workers(db: Session) -> list[dict]:
    """Workers currently running, by fresh heartbeat.

    Only live workers are returned, so the list reflects exactly the replicas
    that are up: start one → one row; scale to five → five rows; scale back down
    and the stopped replicas drop off within one stale window (and their rows are
    deleted by reap_dead_workers on the scheduler tick).
    """
    now = utcnow()
    stale_after = Config.WORKER_STALE_SECONDS
    out = []
    for w in db.scalars(select(Worker).order_by(Worker.name)).all():
        age = (now - w.last_heartbeat).total_seconds() if w.last_heartbeat else None
        if age is None or age > stale_after:
            continue  # not alive — don't show it as a running worker
        out.append({
            "name": w.name, "capabilities": w.capabilities or [],
            "status": w.status, "current_run_id": w.current_run_id,
            "runs_completed": w.runs_completed, "last_heartbeat": _iso(w.last_heartbeat),
        })
    return out
