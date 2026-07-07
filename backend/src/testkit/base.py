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
    metadata: TestMetadata

    def validate_config(self, config: dict[str, Any]) -> None:
        return None

    def setup(self, context: TestContext) -> None:
        return None

    @abstractmethod
    def execute(self, context: TestContext) -> TestResult:
        raise NotImplementedError

    def teardown(self, context: TestContext) -> None:
        return None
