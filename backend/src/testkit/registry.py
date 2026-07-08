"""Discovery registry for code-based automation tests.

A test author creates one Python file under ``backend/tests/automations/`` and
puts a ``BaseAutomationTest`` subclass in it. Discovery recursively imports those
files and registers concrete test classes by ``metadata.key``. The old explicit
module-list API remains for compatibility.
"""
from __future__ import annotations

import importlib
import inspect
from pathlib import Path
from typing import Iterable

from src.core.errors import ValidationError
from src.testkit.base import SUPPORTED_TYPES, BaseAutomationTest


def _register_from_module(module_name: str, found: dict[str, type[BaseAutomationTest]]) -> None:
    module = importlib.import_module(module_name)
    importlib.reload(module)
    for _, obj in inspect.getmembers(module, inspect.isclass):
        if not issubclass(obj, BaseAutomationTest) or obj is BaseAutomationTest:
            continue
        # Imported helper/base classes should not become separate tests.
        if obj.__module__ != module.__name__:
            continue
        meta = getattr(obj, "metadata", None)
        if meta is None:
            continue
        if meta.type not in SUPPORTED_TYPES:
            raise ValidationError(f"test {meta.key!r} has unsupported type {meta.type!r}")
        if meta.key in found:
            raise ValidationError(f"duplicate test key {meta.key!r}")
        obj().validate_config(dict(meta.default_config))
        found[meta.key] = obj


def discover_classes(modules: Iterable[str]) -> dict[str, type[BaseAutomationTest]]:
    """Return {metadata.key: class} for every valid test found in modules."""
    found: dict[str, type[BaseAutomationTest]] = {}
    for module_name in modules:
        _register_from_module(module_name, found)
    return found


def discover_from_path(root: Path, *, package_root: str = "scenarios.automation") -> dict[str, type[BaseAutomationTest]]:
    """Recursively discover scenarios from a filesystem tree.

    ``root`` is ``backend/scenarios/automation`` — one directory per target
    (``scenarios/automation/qtp_self``, …).
    Every Python file under it is imported as ``scenarios.automation.<target>.
    <module>`` and its ``BaseAutomationTest`` subclass registered. Adding a new
    target directory therefore needs no registration step. Files whose name
    starts with ``_`` are treated as helpers and skipped.
    """
    root = root.resolve()
    if not root.exists():
        return {}
    found: dict[str, type[BaseAutomationTest]] = {}
    for file in sorted(root.rglob("*.py")):
        if file.name == "__init__.py" or file.name.startswith("_"):
            continue
        rel = file.relative_to(root).with_suffix("")
        module_name = ".".join((package_root, *rel.parts))
        _register_from_module(module_name, found)
    return found
