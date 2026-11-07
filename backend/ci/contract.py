"""Conserve the complete ordered suite and successful phase accounting."""

import math
import re
from collections import Counter
from typing import Any

MIGRATION_MODULES = frozenset(
    {
        "tests/test_inventory_migrations_105.py",
        "tests/test_void_reason_migration.py",
        "tests/test_review_migrations_113.py",
        "tests/test_geography_migrations_b_33.py",
        "tests/test_transfer_migrations_106.py",
        "tests/test_lab_migrations_114.py",
    }
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError("CI evidence: " + message)


def partition_nodes(nodes: list[str]) -> dict[str, list[str]]:
    require(isinstance(nodes, list) and bool(nodes), "empty inventory")
    require(all(isinstance(node, str) and "::" in node for node in nodes), "invalid node")
    require(len(nodes) == len(set(nodes)), "duplicate node")
    owners = {node.split("::")[0] for node in nodes}
    require(owners >= MIGRATION_MODULES, "missing migration owner")
    parts = {
        shard: [node for node in nodes if (node.split("::")[0] in MIGRATION_MODULES) == migration]
        for shard, migration in (("regular", False), ("migrations", True))
    }
    require(all(parts.values()), "empty partition")
    return parts


def _validate_reports(session: dict[str, Any]) -> None:
    expected = Counter(
        (node, phase) for node in session["selected"] for phase in ("setup", "call", "teardown")
    )
    actual: Counter[tuple[str, str]] = Counter()
    for report in session["reports"]:
        require(report["outcome"] == "passed" and report["xfail"] is False, "non-pass phase")
        duration = report["duration"]
        require(
            type(duration) in (int, float) and math.isfinite(duration) and duration >= 0,
            "invalid duration",
        )
        actual[(report["nodeid"], report["when"])] += 1
    require(actual == expected, "incomplete or duplicate phase accounting")


def validate_fragment(bundle: dict[str, Any], expected: dict[str, Any]) -> None:
    try:
        require(
            type(bundle["schema"]) is int
            and bundle["schema"] == 1
            and bundle["identity"] == expected,
            "foreign identity/schema",
        )
        require(type(bundle["child_exit"]) is int and bundle["child_exit"] == 0, "child failed")
        require(bool(re.fullmatch(r"[0-9a-f]{64}", bundle["coverage_sha256"])), "invalid digest")
        session = bundle["session"]
        require(
            type(session["exit"]) is int
            and session["exit"] == 0
            and type(session["collection_errors"]) is int
            and session["collection_errors"] == 0,
            "unfinished session",
        )
        parts = partition_nodes(session["all"])
        require(session["selected"] == parts[bundle["shard"]], "wrong selection")
        postgres = session["postgres"]
        require(
            postgres["vendor"] == "postgresql" and 180000 <= postgres["version"] < 190000,
            "wrong PostgreSQL service",
        )
        _validate_reports(session)
    except (KeyError, TypeError, AttributeError) as error:
        raise ValueError("CI evidence: malformed fragment") from error


def validate_pair(bundles: list[dict[str, Any]], expected: dict[str, Any]) -> int:
    require(len(bundles) == 2, "both fragments required")
    for bundle in bundles:
        validate_fragment(bundle, expected)
    require({bundle["shard"] for bundle in bundles} == {"regular", "migrations"}, "duplicate shard")
    first, second = (bundle["session"] for bundle in bundles)
    require(first["all"] == second["all"], "ordered inventories differ")
    require(first["postgres"] == second["postgres"], "database versions differ")
    return len(first["all"])
