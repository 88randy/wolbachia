"""Conserve the complete ordered suite and successful phase accounting."""

import math
import re
from collections import Counter
from typing import Any

MIGRATION_PARTITIONS = {
    "migrations-foundation": frozenset(
        {"tests/test_inventory_migrations_105.py", "tests/test_void_reason_migration.py"}
    ),
    "migrations-field": frozenset(
        {"tests/test_geography_migrations_b_33.py", "tests/test_review_migrations_113.py"}
    ),
    "migrations-material": frozenset(
        {"tests/test_transfer_migrations_106.py", "tests/test_lab_migrations_114.py"}
    ),
}
PARTITION_NAMES = ("regular", *MIGRATION_PARTITIONS)
MIGRATION_MODULES = frozenset(
    module for modules in MIGRATION_PARTITIONS.values() for module in modules
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError("CI evidence: " + message)


def partition_nodes(nodes: list[str]) -> dict[str, list[str]]:
    require(isinstance(nodes, list) and bool(nodes), "empty inventory")
    require(all(isinstance(node, str) and "::" in node for node in nodes), "invalid node")
    require(len(nodes) == len(set(nodes)), "duplicate node")
    modules = [module for cohort in MIGRATION_PARTITIONS.values() for module in cohort]
    require(
        all(MIGRATION_PARTITIONS.values())
        and len(modules) == len(set(modules))
        and set(modules) == MIGRATION_MODULES,
        "empty, overlapping or incomplete migration registry",
    )
    owners = {node.split("::")[0] for node in nodes}
    require(owners >= MIGRATION_MODULES, "missing migration owner")
    parts = {"regular": [node for node in nodes if node.split("::")[0] not in MIGRATION_MODULES]}
    parts.update(
        {
            shard: [node for node in nodes if node.split("::")[0] in cohort]
            for shard, cohort in MIGRATION_PARTITIONS.items()
        }
    )
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


def validate_fragments(bundles: list[dict[str, Any]], expected: dict[str, Any]) -> int:
    require(len(bundles) == len(PARTITION_NAMES), "all current fragments required")
    for bundle in bundles:
        validate_fragment(bundle, expected)
    require(
        {bundle["shard"] for bundle in bundles} == set(PARTITION_NAMES),
        "duplicate or missing shard",
    )
    first = bundles[0]["session"]
    require(
        all(bundle["session"]["all"] == first["all"] for bundle in bundles),
        "ordered inventories differ",
    )
    require(
        all(bundle["session"]["postgres"] == first["postgres"] for bundle in bundles),
        "database versions differ",
    )
    return len(first["all"])
