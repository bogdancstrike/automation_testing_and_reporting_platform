"""Failure signatures + defect-type suggestion (deterministic auto-analysis)."""
from __future__ import annotations

import hashlib
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.clock import utcnow
from src.execution.models import FailureSignature, TestRun

# Defect types (see architecture section 19).
DEFECT_TYPES = frozenset({
    "product_bug", "automation_bug", "system_issue", "to_investigate", "no_defect",
})

_NUM = re.compile(r"\d+")
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def _normalize(message: str | None) -> str:
    if not message:
        return ""
    msg = _UUID.sub("<uuid>", message.lower())
    msg = _NUM.sub("<n>", msg)
    return msg[:300]


def signature_hash(definition_id: str, category: str | None, message: str | None) -> str:
    raw = f"{definition_id}|{category or ''}|{_normalize(message)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def record_failure(db: Session, run: TestRun) -> tuple[str, str | None]:
    """Compute+persist the failure signature; return (hash, suggested_defect_type)."""
    sig = signature_hash(run.scenario_id, run.error_category, run.error_message)
    existing = db.scalars(
        select(FailureSignature).where(FailureSignature.signature_hash == sig)
    ).first()
    now = utcnow()
    if existing:
        existing.occurrences += 1
        existing.last_seen = now
        suggested = existing.last_defect_type or "to_investigate"
    else:
        db.add(FailureSignature(
            project_id=run.project_id, signature_hash=sig,
            category=run.error_category or "unknown_error",
            sample_message=run.error_message, occurrences=1,
            last_defect_type=None, first_seen=now, last_seen=now,
        ))
        suggested = "to_investigate"
    return sig, suggested


def apply_defect(db: Session, run: TestRun, defect_type: str) -> None:
    """Human triage — persist on the run and teach the signature."""
    if defect_type not in DEFECT_TYPES:
        from src.core.errors import ValidationError
        raise ValidationError(f"invalid defect_type; one of {sorted(DEFECT_TYPES)}")
    run.defect_type = defect_type
    if run.failure_signature:
        sig = db.scalars(
            select(FailureSignature).where(FailureSignature.signature_hash == run.failure_signature)
        ).first()
        if sig:
            sig.last_defect_type = defect_type
