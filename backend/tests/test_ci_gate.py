"""Protect our complete CI gate, not pytest's or GitHub's implementation."""

import copy
import sys

import pytest
from coverage import CoverageData

from ci.aggregate import GateInputs, combine_coverage, verify_inputs
from ci.contract import MIGRATION_MODULES, partition_nodes, validate_pair
from ci.coverage_data import read_coverage
from ci.evidence import digest, write_json
from ci.runner import run_child


def fragments():
    nodes = ["tests/test_regular.py::test_regular"] + [
        f"{module}::test_upgrade" for module in sorted(MIGRATION_MODULES)
    ]
    identity = {"repository": "example/repo", "run_id": "12", "run_attempt": "1"}
    results = []
    for shard, selected in (("regular", nodes[:1]), ("migrations", nodes[1:])):
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
    }
    if fault in changes:
        target, key, value = changes[fault]
        target[key] = value
    elif fault == "missing_fragment":
        bundles.pop()
    elif fault == "duplicate_shard":
        bundles[1] = copy.deepcopy(regular)
    elif fault == "different_inventory":
        bundles[1]["session"]["all"].reverse()
    elif fault == "duplicate_node":
        session["all"].append(session["all"][0])
    elif fault == "duplicate_call":
        session["reports"].append(session["reports"][1].copy())
    elif fault == "missing_teardown":
        session["reports"].pop()
    if fault == "none":
        assert validate_pair(bundles, expected) == 6
    else:
        with pytest.raises(ValueError, match="CI evidence"):
            validate_pair(bundles, expected)


def test_partition_keeps_whole_migration_modules_and_rejects_unclassified_owners(
    tmp_path,
    monkeypatch,
):
    from ci import pytest_plugin

    bundles, _ = fragments()
    nodes = bundles[0]["session"]["all"]
    parts = partition_nodes(nodes)
    assert parts["regular"] == nodes[:1]
    assert parts["migrations"] == nodes[1:]
    with pytest.raises(ValueError, match="CI evidence"):
        partition_nodes(nodes[:-1])
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
        (tmp_path / "tests/test_sixth_owner.py").write_text(source, encoding="utf-8")
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
    if fault == "missing":
        path.unlink()
    elif fault == "corrupt":
        path.write_bytes(b"not coverage data")
    if fault == "none":
        assert read_coverage(path, (source,)) == {str(module): {1}}
    else:
        with pytest.raises(ValueError, match="CI evidence"):
            read_coverage(path, (source,))


@pytest.mark.parametrize("status", [0, 7])
def test_runner_persists_actual_child_exit_even_when_child_fails(tmp_path, status):
    import json

    receipt = tmp_path / "exit.json"
    returned = run_child((sys.executable, "-c", f"raise SystemExit({status})"), receipt)
    assert returned == status
    assert json.loads(receipt.read_text(encoding="utf-8"))["actual_child_exit"] == status


@pytest.mark.parametrize("fault", ["none", "missing", "corrupt", "digest", "identity"])
def test_aggregate_requires_two_current_inputs_even_if_one_has_full_coverage(tmp_path, fault):
    source = tmp_path / "source"
    source.mkdir()
    module = source / "app.py"
    module.write_text("first = 1\nsecond = 2\n", encoding="utf-8")
    bundles, expected = fragments()
    for bundle in bundles:
        directory = tmp_path / bundle["shard"]
        directory.mkdir()
        coverage = directory / "coverage.data"
        recorded = CoverageData(basename=str(coverage))
        recorded.add_lines({str(module): {1, 2}})
        recorded.write()
        bundle["coverage_sha256"] = digest(coverage)
        if bundle["shard"] == "migrations":
            if fault == "digest":
                bundle["coverage_sha256"] = "0" * 64
            elif fault == "identity":
                bundle["identity"]["run_attempt"] = "99"
            elif fault == "corrupt":
                coverage.write_bytes(b"broken")
                bundle["coverage_sha256"] = digest(coverage)
        write_json(directory / "manifest.json", bundle)
    if fault == "missing":
        (tmp_path / "migrations/manifest.json").unlink()
    inputs = GateInputs(directory=tmp_path, sources=(source,))
    if fault == "none":
        assert [path.parent.name for path in verify_inputs(inputs, expected)] == [
            "regular",
            "migrations",
        ]
    else:
        with pytest.raises(ValueError, match="CI evidence"):
            verify_inputs(inputs, expected)


def test_verified_coverage_combine_keeps_both_line_sets_and_direct_exit(tmp_path):
    source = tmp_path / "app.py"
    source.write_text("first = 1\nsecond = 2\n", encoding="utf-8")
    paths = []
    for line in (1, 2):
        path = tmp_path / f"coverage-{line}.data"
        recorded = CoverageData(basename=str(path))
        recorded.add_lines({str(source): {line}})
        recorded.write()
        paths.append(path)
    combined = tmp_path / "combined.data"
    combine_coverage(paths, combined)
    recorded = CoverageData(basename=str(combined))
    recorded.read()
    assert recorded.lines(str(source)) == [1, 2]
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
