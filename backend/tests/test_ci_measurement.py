"""Qualify the CI runner's selected measurement core and warning-failure policy."""

from contextlib import closing
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml
from coverage import CoverageData

from ci.coverage_data import read_coverage
from ci.evidence import BACKEND, read_json
from ci.runner import PYTEST_PREFIX, run_child

WORKER_SOURCE = """from threading import Thread


def thread_worker(results):
    results.append("thread-only")


def exercise():
    results = []
    worker = Thread(target=thread_worker, args=(results,))
    worker.start()
    worker.join()
    assert results == ["thread-only"]
    return sum(value for value in range(3))
"""

PROBE_SOURCE = """from measurement_sample.worker import exercise


def test_exercises_thread():
    assert exercise() == 3
"""


@pytest.fixture
def measurement(tmp_path, monkeypatch):
    workflow = yaml.safe_load((BACKEND.parent / ".github/workflows/backend.yml").read_text())
    package = tmp_path / "measurement_sample"
    package.mkdir()
    (package / "__init__.py").write_text("", encoding="utf-8", newline="\n")
    worker = package / "worker.py"
    worker.write_text(WORKER_SOURCE, encoding="utf-8", newline="\n")
    probe = tmp_path / "test_measurement_sample.py"
    probe.write_text(PROBE_SOURCE, encoding="utf-8", newline="\n")
    pytest_config = tmp_path / "pytest.ini"
    pytest_config.write_text("[pytest]\n", encoding="utf-8", newline="\n")
    coverage_config = tmp_path / ".coveragerc"
    coverage_config.write_text("[run]\nbranch = False\n", encoding="utf-8", newline="\n")
    monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
    monkeypatch.delenv("PYTEST_ADDOPTS", raising=False)
    monkeypatch.delenv("COVERAGE_PROCESS_START", raising=False)
    return SimpleNamespace(
        root=tmp_path,
        package=package,
        worker=worker,
        probe=probe,
        pytest_config=pytest_config,
        coverage_config=coverage_config,
        core=workflow["env"]["COVERAGE_CORE"],
        monkeypatch=monkeypatch,
    )


def run_measurement(context, core, *, extra_args=()):
    output = context.root / core
    output.mkdir()
    context.monkeypatch.setenv("COVERAGE_CORE", core)
    coverage_file = output / "coverage.data"
    context.monkeypatch.setenv("COVERAGE_FILE", str(coverage_file))
    log = output / "pytest.log"
    receipt = output / "exit.json"
    command = (
        *PYTEST_PREFIX,
        "-p",
        "pytest_cov.plugin",
        "-p",
        "no:cacheprovider",
        "-c",
        str(context.pytest_config),
        "--rootdir=" + str(context.root),
        "--confcutdir=" + str(context.root),
        "--cov=" + str(context.package),
        "--cov-config=" + str(context.coverage_config),
        "--cov-report=",
        "--cov-fail-under=0",
        *extra_args,
        str(context.probe),
    )
    status = run_child(command, receipt, log)
    assert read_json(receipt) == {"actual_child_exit": status}
    return status, log.read_text(encoding="utf-8"), coverage_file


def test_ci_measurement_refuses_startup_core_fallback_before_tests(measurement):
    status, transcript, _ = run_measurement(
        measurement, measurement.core, extra_args=("--cov-branch",)
    )

    assert status != 0
    assert "no-sysmon" in transcript
    assert "sys.monitoring can't measure branches" in transcript


def test_ci_measurement_refuses_late_warnings_after_pytest_cov_installs_its_filters(measurement):
    measurement.probe.write_text(
        PROBE_SOURCE
        + "    import warnings\n"
        + "    from coverage.exceptions import CoverageWarning\n"
        + '    warnings.warn("Synthetic late coverage warning", CoverageWarning)\n',
        encoding="utf-8",
        newline="\n",
    )

    status, transcript, _ = run_measurement(measurement, measurement.core)

    assert status != 0
    assert "CoverageWarning: Synthetic late coverage warning" in transcript


def test_ci_measurement_preserves_threaded_statement_lines_from_the_previous_core(measurement):
    recorded = {}
    for core in ("ctrace", measurement.core):
        status, transcript, coverage_file = run_measurement(measurement, core)
        assert status == 0, transcript
        recorded[core] = read_coverage(coverage_file, (measurement.package,))
        with closing(CoverageData(basename=str(coverage_file))) as coverage:
            coverage.read()
            assert not coverage.has_arcs()

    assert recorded[measurement.core] == recorded["ctrace"]
    worker_lines = next(
        lines
        for filename, lines in recorded[measurement.core].items()
        if Path(filename).resolve() == measurement.worker.resolve()
    )
    thread_line = WORKER_SOURCE.splitlines().index('    results.append("thread-only")') + 1
    assert thread_line in worker_lines
