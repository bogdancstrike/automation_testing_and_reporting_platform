"""Discovery registry for code-based automation tests.

Imports configured modules and registers ``BaseAutomationTest`` subclasses by
their globally-unique ``metadata.key``.
"""
from __future__ import annotations

import importlib
import inspect
from typing import Iterable

from src.core.errors import ValidationError
from src.testkit.base import SUPPORTED_TYPES, BaseAutomationTest


def discover_classes(modules: Iterable[str]) -> dict[str, type[BaseAutomationTest]]:
    """Return {metadata.key: class} for every valid test found in *modules*."""
    found: dict[str, type[BaseAutomationTest]] = {}
    for module_name in modules:
        module = importlib.import_module(module_name)
        importlib.reload(module)
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if not issubclass(obj, BaseAutomationTest) or obj is BaseAutomationTest:
                continue
            if obj.__module__ != module.__name__:
                continue
            meta = getattr(obj, "metadata", None)
            if meta is None:
                continue
            if meta.type not in SUPPORTED_TYPES:
                raise ValidationError(f"test {meta.key!r} has unsupported type {meta.type!r}")
            if meta.key in found:
                raise ValidationError(f"duplicate test key {meta.key!r}")
            # Fail fast on invalid default config.
            obj().validate_config(dict(meta.default_config))
            found[meta.key] = obj
    return found
