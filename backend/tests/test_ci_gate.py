"""Protect our complete CI gate, not pytest's or GitHub's implementation."""

import copy
import gc
import sys
import warnings

import pytest
import yaml
from coverage import CoverageData

from ci.aggregate import GateInputs, combine_coverage, verify_inputs
from ci.contract import MIGRATION_MODULES, partition_nodes, validate_fragments
from ci.coverage_data import read_coverage
from ci.evidence import BACKEND, digest, write_json
from ci.runner import run_child

EXPECTED_COHORTS = {
    "migrations-foundation": {
        "tests/test_inventory_migrations_105.py",
    },
    "migrations-field": {
        "tests/test_geography_migrations_b_33.py",
    },
    "migrations-material": {
        "tests/test_transfer_migrations_106.py",
    },
    "migrations-void-reason": {"tests/test_void_reason_migration.py"},
    "migrations-review": {"tests/test_review_migrations_113.py"},
    "migrations-lab": {"tests/test_lab_migrations_114.py"},
    "migrations-community": {"tests/test_community_migrations_127.py"},
    "migrations-supplies": {"tests/test_inventory_allocations_migrations_107.py"},
    "migrations-session-audit": {"tests/test_session_audit_migrations_181.py"},
    "migrations-people": {"tests/test_people_migrations_101.py"},
    "regular-integration": {
        "tests/test_inventory_allocations_b_10.py",
        "tests/test_uploads_b_04.py",
        "tests/test_permit_api_116.py",
        "tests/test_release_guards_116.py",
        "tests/test_release_stock_116.py",
        "tests/test_release_uuid_116.py",
        "tests/test_releases_b_20.py",
        "tests/test_releases_concurrency_116.py",
        "tests/test_lab_recounts_b_19.py",
        "tests/test_lab_concurrency_114.py",
        "tests/test_ovitraps_lifecycle_b_15.py",
        "tests/test_seed_defaults.py",
        "tests/test_shift_concurrency.py",
        "tests/test_incidents_b_06.py",
        "tests/test_reviews_b_17.py",
        "tests/test_geography_decisions_b_33.py",
        "tests/test_sync_locks.py",
        "tests/test_inventory_transfers_106.py",
    },
}
EXPECTED_PARTITIONS = ("regular", *EXPECTED_COHORTS)


def fragments():
    nodes = ["tests/test_regular.py::test_regular"] + [
        f"{module}::test_upgrade"
        for module in sorted(module for modules in EXPECTED_COHORTS.values() for module in modules)
    ]
    identity = {"repository": "example/repo", "run_id": "12", "run_attempt": "1"}
    results = []
    for shard in EXPECTED_PARTITIONS:
        selected = (
            nodes[:1]
            if shard == "regular"
            else [node for node in nodes if node.split("::")[0] in EXPECTED_COHORTS[shard]]
        )
        reports = [
            {"nodeid": node, "when": phase, "outcome": "passed", "duration": 0.01, "xfail": False}
            for node in selected
            for phase in ("setup", "call", "teardown")
        ]
        results.append(
            {
                "schema": 1,
                "identity": identity.copy(),
                "shard": shard,
                "child_exit": 0,
                "coverage_sha256": "c" * 64,
                "session": {
                    "exit": 0,
                    "all": nodes.copy(),
                    "selected": selected.copy(),
                    "reports": reports,
                    "collection_errors": 0,
                    "postgres": {"vendor": "postgresql", "version": 180006},
                },
            }
        )
    return results, identity


@pytest.mark.parametrize(
    "fault",
    [
        "none",
        "missing_fragment",
        "duplicate_shard",
        "unknown_shard",
        "foreign_attempt",
        "different_inventory",
        "duplicate_node",
        "missing_selection",
        "duplicate_call",
        "missing_teardown",
        "skip",
        "xfail",
        "failed_child",
        "unfinished_session",
        "collection_error",
        "foreign_database",
    ],
)
def test_gate_requires_both_current_complete_exactly_once_fragments(fault):
    """Keep the existing owner/node IDs while extending its contract to every cohort."""
    bundles, expected = fragments()
    regular = bundles[0]
    session = regular["session"]
    changes = {
        "foreign_attempt": (regular["identity"], "run_attempt", "0"),
        "missing_selection": (session, "selected", []),
        "skip": (session["reports"][1], "outcome", "skipped"),
        "xfail": (session["reports"][1], "xfail", True),
        "failed_child": (regular, "child_exit", 7),
        "unfinished_session": (session, "exit", 2),
        "collection_error": (session, "collection_errors", 1),
        "foreign_database": (session["postgres"], "vendor", "sqlite"),
        "unknown_shard": (bundles[-1], "shard", "migrations"),
    }
    if fault in changes:
        target, key, value = changes[fault]
        target[key] = value
    elif fault == "missing_fragment":
        bundles.pop()
    elif fault == "duplicate_shard":
        bundles[-1] = copy.deepcopy(regular)
    elif fault == "different_inventory":
        bundles[-1]["session"]["all"].reverse()
    elif fault == "duplicate_node":
        session["all"].append(session["all"][0])
    elif fault == "duplicate_call":
        session["reports"].append(session["reports"][1].copy())
    elif fault == "missing_teardown":
        session["reports"].pop()
    if fault == "none":
        assert (
            validate_fragments(bundles, expected) == 29
        )  # Residual regular, ten migration owners and eighteen complete ordinary modules.
    else:
        with pytest.raises(ValueError, match="CI evidence"):
            validate_fragments(bundles, expected)


def test_partition_keeps_whole_migration_modules_and_rejects_unclassified_owners(
    tmp_path,
    monkeypatch,
):
    from ci import contract, pytest_plugin

    bundles, _ = fragments()
    collected = bundles[0]["session"]["all"]
    nodes = [
        *collected[:2],
        "tests/test_uploads_b_04.py::test_earlier_case",
        *collected[2:],
        "tests/test_inventory_allocations_b_10.py::test_later_case",
    ]
    parts = partition_nodes(nodes)
    assert tuple(parts) == EXPECTED_PARTITIONS
    assert parts["regular"] == nodes[:1]
    for shard, modules in EXPECTED_COHORTS.items():
        assert parts[shard] == [node for node in nodes if node.split("::")[0] in modules]
    assert sorted(node for selected in parts.values() for node in selected) == sorted(nodes)
    for absent in (
        "tests/test_uploads_b_04.py",
        "tests/test_inventory_allocations_migrations_107.py",
        "tests/test_release_stock_116.py",
        "tests/test_lab_recounts_b_19.py",
    ):
        with pytest.raises(ValueError, match="CI evidence"):
            partition_nodes([node for node in nodes if node.split("::")[0] != absent])
    for malformed in (
        {**EXPECTED_COHORTS, "migrations-foundation": set()},
        {**EXPECTED_COHORTS, "regular-integration": set()},
        {
            **EXPECTED_COHORTS,
            "regular-integration": EXPECTED_COHORTS["regular-integration"]
            | EXPECTED_COHORTS["migrations-foundation"],
        },
        {**EXPECTED_COHORTS, "migrations-field": EXPECTED_COHORTS["migrations-foundation"]},
        {
            name: modules | EXPECTED_COHORTS["migrations-void-reason"]
            if name == "migrations-foundation"
            else modules
            for name, modules in EXPECTED_COHORTS.items()
            if name != "migrations-void-reason"
        },
        {
            **{key: value for key, value in EXPECTED_COHORTS.items() if key != "migrations-lab"},
            "migrations-material": EXPECTED_COHORTS["migrations-material"]
            | EXPECTED_COHORTS["migrations-lab"],
        },
    ):
        with monkeypatch.context() as changed:
            changed.setattr(contract, "MODULE_PARTITIONS", malformed)
            with pytest.raises(ValueError, match="CI evidence"):
                partition_nodes(nodes)
    assert_partition_workflow()
    assert (
        frozenset(
            module
            for name, modules in EXPECTED_COHORTS.items()
            if name != "regular-integration"
            for module in modules
        )
        == MIGRATION_MODULES
    )
    monkeypatch.setattr(pytest_plugin, "BACKEND", tmp_path)
    for module in MIGRATION_MODULES:
        path = tmp_path / module
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            "from django.db.migrations.executor import MigrationExecutor\n",
            encoding="utf-8",
        )
    pytest_plugin._verify_migration_owners()
    forms = {
        "direct": "from django.db.migrations.executor import MigrationExecutor\nMigrationExecutor(connection)\n",
        "direct_alias": "from django.db.migrations.executor import MigrationExecutor as Executor\nExecutor(connection)\n",
        "module": "import django.db.migrations.executor\ndjango.db.migrations.executor.MigrationExecutor(connection)\n",
        "module_alias": "import django.db.migrations.executor as executor\nexecutor.MigrationExecutor(connection)\n",
        "package": "from django.db.migrations import executor\nexecutor.MigrationExecutor(connection)\n",
        "package_alias": "from django.db.migrations import executor as runner\nrunner.MigrationExecutor(connection)\n",
    }
    rejected = {}
    for label, source in forms.items():
        (tmp_path / "tests/test_unclassified_owner.py").write_text(source, encoding="utf-8")
        try:
            pytest_plugin._verify_migration_owners()
        except ValueError as error:
            rejected[label] = str(error)
    assert list(rejected) == [
        "direct",
        "direct_alias",
        "module",
        "module_alias",
        "package",
        "package_alias",
    ]
    assert all("unclassified migration owner" in error for error in rejected.values())


def assert_partition_workflow():
    workflow = yaml.safe_load((BACKEND.parent / ".github/workflows/backend.yml").read_text())
    jobs = workflow["jobs"]
    assert jobs["tests"]["strategy"]["matrix"]["shard"] == list(EXPECTED_PARTITIONS)
    assert jobs["tests"]["strategy"]["fail-fast"] is False
    assert jobs["tests"]["timeout-minutes"] == jobs["checks"]["timeout-minutes"] == 15
    rollup = jobs["migration_status"]
    assert rollup["name"] == "PostgreSQL (migrations)"
    assert rollup["needs"] == ["tests"]
    assert "always()" in rollup["if"]
    assert rollup["steps"][0]["env"]["PARTITIONS_RESULT"] == "${{ needs.tests.result }}"
    assert "always()" in jobs["checks"]["if"]
    assert jobs["checks"]["needs"] == ["tests", "migration_status"]
    downloads = [
        step["with"]
        for step in jobs["checks"]["steps"]
        if step.get("uses", "").startswith("actions/download-artifact@")
    ]
    prefix = "backend-${{ github.repository_id }}-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}-"
    assert [download["name"] for download in downloads] == [
        prefix + shard for shard in EXPECTED_PARTITIONS
    ]
    assert [download["path"] for download in downloads] == [
        f"backend/.pytest_cache/ci-downloads/{shard}" for shard in EXPECTED_PARTITIONS
    ]


@pytest.mark.parametrize("fault", ["none", "missing", "corrupt", "branch", "foreign", "empty"])
def test_coverage_inputs_are_readable_statement_data_from_allowed_sources(tmp_path, fault):
    source = tmp_path / "source"
    source.mkdir()
    module = source / "app.py"
    module.write_text("answer = 42\n", encoding="utf-8")
    path = tmp_path / "coverage.data"
    recorded = CoverageData(basename=str(path))
    filename = str(module if fault != "foreign" else tmp_path / "foreign.py")
    if fault == "branch":
        recorded.add_arcs({filename: {(1, -1)}})
    else:
        recorded.add_lines({filename: set() if fault == "empty" else {1}})
    recorded.write()
    recorded.close()
    if fault == "missing":
        path.unlink()
    elif fault == "corrupt":
        path.write_bytes(b"not coverage data")
    gc.collect()
    with warnings.catch_warnings(record=True) as observed:
        warnings.simplefilter("always", ResourceWarning)
        if fault == "none":
            assert read_coverage(path, (source,)) == {str(module): {1}}
        else:
            with pytest.raises(ValueError, match="CI evidence"):
                read_coverage(path, (source,))
        gc.collect()
    assert not [
        str(warning.message)
        for warning in observed
        if issubclass(warning.category, ResourceWarning)
    ]


@pytest.mark.parametrize("status", [0, 7])
def test_runner_persists_actual_child_exit_even_when_child_fails(tmp_path, status):
    import json

    receipt = tmp_path / "exit.json"
    returned = run_child((sys.executable, "-c", f"raise SystemExit({status})"), receipt)
    assert returned == status
    assert json.loads(receipt.read_text(encoding="utf-8"))["actual_child_exit"] == status


@pytest.mark.parametrize("fault", ["none", "missing", "corrupt", "digest", "identity", "extra"])
def test_aggregate_requires_two_current_inputs_even_if_one_has_full_coverage(tmp_path, fault):
    source = tmp_path / "source"
    source.mkdir()
    module = source / "app.py"
    module.write_text("first = 1\nsecond = 2\n", encoding="utf-8")
    bundles, expected = fragments()
    downloads = tmp_path / "downloads"
    downloads.mkdir()
    for bundle in bundles:
        directory = downloads / bundle["shard"]
        directory.mkdir()
        coverage = directory / "coverage.data"
        recorded = CoverageData(basename=str(coverage))
        recorded.add_lines({str(module): {1, 2}})
        recorded.write()
        recorded.close()
        bundle["coverage_sha256"] = digest(coverage)
        if bundle["shard"] == "migrations-material":
            if fault == "digest":
                bundle["coverage_sha256"] = "0" * 64
            elif fault == "identity":
                bundle["identity"]["run_attempt"] = "99"
            elif fault == "corrupt":
                coverage.write_bytes(b"broken")
                bundle["coverage_sha256"] = digest(coverage)
        write_json(directory / "manifest.json", bundle)
    if fault == "missing":
        (downloads / "migrations-material/manifest.json").unlink()
    elif fault == "extra":
        (downloads / "old-migrations").mkdir()
    inputs = GateInputs(directory=downloads, sources=(source,))
    if fault == "none":
        assert [path.parent.name for path in verify_inputs(inputs, expected)] == list(
            EXPECTED_PARTITIONS
        )
    else:
        with pytest.raises(ValueError, match="CI evidence"):
            verify_inputs(inputs, expected)


def test_verified_coverage_combine_keeps_both_line_sets_and_direct_exit(tmp_path):
    source = tmp_path / "app.py"
    lines = list(range(1, len(EXPECTED_PARTITIONS) + 1))
    source.write_text("".join(f"value_{line} = {line}\n" for line in lines), encoding="utf-8")
    paths = []
    for line in lines:
        path = tmp_path / f"coverage-{line}.data"
        recorded = CoverageData(basename=str(path))
        recorded.add_lines({str(source): {line}})
        recorded.write()
        recorded.close()
        paths.append(path)
    combined = tmp_path / "combined.data"
    combine_coverage(paths, combined)
    recorded = CoverageData(basename=str(combined))
    recorded.read()
    assert recorded.lines(str(source)) == lines
    recorded.close()
    assert (tmp_path / "combine-exit.json").is_file()


def test_ci_parameter_id_keeps_random_uuid_values_but_stabilizes_their_category():
    from ci import pytest_plugin

    identify = getattr(pytest_plugin, "pytest_make_parametrize_id", lambda val, argname: None)
    first = "11111111-1111-4111-8111-111111111111"
    second = "22222222-2222-4222-8222-222222222222"
    assert identify(first, "user_id") == "unknown-user-uuid"
    assert identify(second, "user_id") == "unknown-user-uuid"
    assert identify("not-a-uuid", "user_id") is None
    assert identify(first, "other_argument") is None
