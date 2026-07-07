"""The result contract shared by every adapter."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Terminal run statuses (see architecture section 11).
PASSED = "passed"
FAILED = "failed"
ERROR = "error"
TIMEOUT = "timeout"
CANCELED = "canceled"
SKIPPED = "skipped"

TERMINAL_STATUSES = frozenset({PASSED, FAILED, ERROR, TIMEOUT, CANCELED, SKIPPED})


@dataclass
class AssertionResult:
    source: str            # status_code | header | json_path | body_text | json_schema | response_time_ms
    operator: str
    expected: Any
    actual: Any
    passed: bool
    target: str | None = None   # e.g. the header name or json path
    message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "operator": self.operator,
            "target": self.target,
            "expected": self.expected,
            "actual": self.actual,
            "passed": self.passed,
            "message": self.message,
        }


@dataclass
class StepResult:
    name: str
    status: str
    duration_ms: int = 0
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "status": self.status,
                "duration_ms": self.duration_ms, "error": self.error}


@dataclass
class TestResult:
    status: str
    steps: list[StepResult] = field(default_factory=list)
    assertions: list[AssertionResult] = field(default_factory=list)
    error_category: str | None = None
    error_message: str | None = None
    # Free-form structured metadata (e.g. captured HTTP response summary).
    response: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, Any] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.status == PASSED
