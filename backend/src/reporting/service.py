"""Reporting service: dashboard aggregates over runs and failures."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import Float, cast, func, select
from sqlalchemy.orm import Session

from src.catalog.models import Target, TestDefinition
from src.core.clock import utcnow
from src.execution.models import FailureSignature, TestRun, Worker

_TERMINAL = ["passed", "failed", "error", "timeout", "canceled", "skipped"]


def _iso(dt):
    return dt.isoformat() if dt else None


def overview(db: Session, *, hours: int = 24) -> dict:
    since = utcnow() - timedelta(hours=hours)

    status_counts = dict(
        db.execute(
            select(TestRun.status, func.count()).where(TestRun.queued_at >= since)
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
        ).where(TestRun.queued_at >= since, TestRun.duration_ms.isnot(None))
    ).first()
    p50, p95, avg = (durations or (None, None, None))

    # Hourly run trend.
    bucket = func.date_trunc("hour", TestRun.queued_at)
    trend_rows = db.execute(
        select(bucket.label("h"), TestRun.status, func.count())
        .where(TestRun.queued_at >= since)
        .group_by("h", TestRun.status).order_by("h")
    ).all()
    trend: dict[str, dict] = {}
    for h, status, count in trend_rows:
        key = h.isoformat()
        trend.setdefault(key, {"bucket": key})
        trend[key][status] = count

    queue_backlog = db.scalar(select(func.count()).select_from(TestRun).where(TestRun.status == "queued"))
    active_workers = db.scalar(
        select(func.count()).select_from(Worker)
        .where(Worker.last_heartbeat >= utcnow() - timedelta(seconds=30))
    )

    # Per-target health.
    tgt_rows = db.execute(
        select(TestRun.target_id, TestRun.status, func.count())
        .where(TestRun.queued_at >= since, TestRun.target_id.isnot(None))
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

    return {
        "window_hours": hours,
        "totals": {
            "total_runs": total, "passed": passed, "failed": failed,
            "error": errored, "timeout": timed_out,
            "queued": status_counts.get("queued", 0),
            "canceled": status_counts.get("canceled", 0),
        },
        "pass_rate": round(passed / finished, 4) if finished else None,
        "error_rate": round((errored + timed_out) / finished, 4) if finished else None,
        "duration_ms": {"p50": p50, "p95": p95, "avg": round(avg, 1) if avg else None},
        "queue_backlog": queue_backlog or 0,
        "active_workers": active_workers or 0,
        "trend": sorted(trend.values(), key=lambda x: x["bucket"]),
        "per_target": list(per_target.values()),
    }


def failures(db: Session, *, hours: int = 168) -> dict:
    since = utcnow() - timedelta(hours=hours)

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
        .where(TestRun.queued_at >= since, TestRun.status.in_(["failed", "error", "timeout"]))
        .group_by(TestRun.defect_type)
    ).all()
    defect_distribution = {(dt or "untriaged"): c for dt, c in defect_rows}

    recent = db.scalars(
        select(TestRun).where(TestRun.status.in_(["failed", "error", "timeout"]))
        .order_by(TestRun.queued_at.desc()).limit(15)
    ).all()
    defs = {d.id: d.name for d in db.scalars(select(TestDefinition)).all()}
    recent_failed = [{
        "id": r.id, "test_name": defs.get(r.test_definition_id),
        "status": r.status, "error_category": r.error_category,
        "defect_type": r.defect_type, "finished_at": _iso(r.finished_at),
    } for r in recent]

    return {"window_hours": hours, "signatures": signatures,
            "defect_distribution": defect_distribution, "recent_failed": recent_failed}


def workers(db: Session) -> list[dict]:
    now = utcnow()
    out = []
    for w in db.scalars(select(Worker).order_by(Worker.name)).all():
        stale = (now - w.last_heartbeat).total_seconds() > 30 if w.last_heartbeat else True
        out.append({
            "name": w.name, "capabilities": w.capabilities or [],
            "status": "offline" if stale else w.status,
            "current_run_id": w.current_run_id, "runs_completed": w.runs_completed,
            "last_heartbeat": _iso(w.last_heartbeat),
        })
    return out
