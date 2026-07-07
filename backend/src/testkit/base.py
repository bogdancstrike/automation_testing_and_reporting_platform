"""Base classes for code-based automation tests."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from src.testkit.context import TestContext
from src.testkit.result import TestResult

# Supported test/adapter types.
TYPE_HTTP = "http_request"
TYPE_PLAYWRIGHT = "playwright"
TYPE_SELENIUM = "selenium"
TYPE_CLI = "cli"
TYPE_PYTHON = "python_script"

SUPPORTED_TYPES = frozenset({TYPE_HTTP, TYPE_PLAYWRIGHT, TYPE_SELENIUM, TYPE_CLI, TYPE_PYTHON})


@dataclass(frozen=True)
class TestMetadata:
    key: str
    name: str
    type: str
    tags: list[str] = field(default_factory=list)
    owner: str | None = None
    target: str = "default"
    default_config: dict[str, Any] = field(default_factory=dict)


class BaseAutomationTest(ABC):
    """Base class exposing the full lifecycle contract for automation tests.

    The framework calls these hooks in order:
        validate_config -> setup -> execute -> cleanup -> teardown

    Only ``execute`` is abstract (required). Every other hook ships a default
    no-op body, so each test overrides ONLY the ones it needs — a read-only GET
    test may implement just ``execute``, while a test that POSTs will also
    implement ``cleanup`` to undo what it created. ``cleanup`` and ``teardown``
    always run, even when ``execute`` raised.
    """

    metadata: TestMetadata

    def validate_config(self, config: dict[str, Any]) -> None:
        return None

    def setup(self, context: TestContext) -> None:
        return None

    @abstractmethod
    def execute(self, context: TestContext) -> TestResult:
        raise NotImplementedError

    def cleanup(self, context: TestContext) -> None:
        """Undo data the test created (e.g. DELETE a resource a POST created).

        Optional. Runs after ``execute`` on BOTH success and failure, before
        ``teardown``. GET-only tests typically leave this as the default no-op;
        tests that mutate the target should override it so they don't leak
        state between runs. A failure here is logged but does not change the
        test's pass/fail status.
        """
        return None

    def teardown(self, context: TestContext) -> None:
        """Release resources the test held (sessions, browsers, drivers)."""
        return None
