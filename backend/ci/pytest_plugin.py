"""Collect the complete suite, then select one conserved serial partition."""

import ast
import os
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pytest

from ci.contract import MIGRATION_MODULES, partition_nodes, require
from ci.evidence import BACKEND, write_json

_state: dict[str, Any] = {
    "reports": [],
    "collection_errors": 0,
    "node_id_policy": "user_id UUID values use unknown-user-uuid category",
}


def pytest_make_parametrize_id(val: object, argname: str) -> str | None:
    """Keep import-time random UUID values intact while making their CI IDs stable."""
    if argname != "user_id" or not isinstance(val, str):
        return None
    try:
        UUID(val)
    except ValueError:
        return None
    return "unknown-user-uuid"


def _imports_migration_executor(node: ast.AST) -> bool:
    if isinstance(node, ast.Import):
        return any(alias.name == "django.db.migrations.executor" for alias in node.names)
    if not isinstance(node, ast.ImportFrom):
        return False
    if node.module == "django.db.migrations.executor":
        return True
    return node.module == "django.db.migrations" and any(
        alias.name == "executor" for alias in node.names
    )


def _verify_migration_owners() -> None:
    owners = set()
    for path in (BACKEND / "tests").rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        if any(_imports_migration_executor(node) for node in ast.walk(tree)):
            owners.add(path.relative_to(BACKEND).as_posix())
    require(owners == MIGRATION_MODULES, "unclassified migration owner")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    _verify_migration_owners()
    require(not config.option.keyword and not config.option.markexpr, "selective pytest options")
    require(not config.getoption("numprocesses", default=None), "parallel pytest is forbidden")
    nodes = [item.nodeid for item in items]
    selected = partition_nodes(nodes)[os.environ["BACKEND_CI_SHARD"]]
    chosen = set(selected)
    _state.update({"all": nodes, "selected": selected})
    config.hook.pytest_deselected(items=[item for item in items if item.nodeid not in chosen])
    items[:] = [item for item in items if item.nodeid in chosen]


def pytest_collectreport(report: pytest.CollectReport) -> None:
    if report.failed:
        _state["collection_errors"] += 1


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    _state["reports"].append(
        {
            "nodeid": report.nodeid,
            "when": report.when,
            "outcome": report.outcome,
            "duration": report.duration,
            "xfail": hasattr(report, "wasxfail"),
        }
    )


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    if session.config.option.collectonly or exitstatus != 0:
        return
    from django.db import connection
    from django.db.backends.postgresql.base import DatabaseWrapper

    _state.update(
        {
            "exit": int(exitstatus),
            "postgres": {
                "vendor": connection.vendor,
                "version": cast(DatabaseWrapper, connection).pg_version,
            },
        }
    )
    write_json(Path(os.environ["BACKEND_CI_OUTPUT"]) / "session.json", _state)
