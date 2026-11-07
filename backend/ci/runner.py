"""Run exactly one serial shard and preserve the actual child exit before parsing."""

import argparse
import os
import subprocess
import sys
from contextlib import nullcontext
from pathlib import Path

from ci.contract import require, validate_fragment
from ci.coverage_data import read_coverage
from ci.evidence import BACKEND, coverage_sources, current_identity, digest, read_json, write_json


def run_child(command: tuple[str, ...], receipt: Path, log: Path | None = None) -> int:
    with log.open("w", encoding="utf-8") if log else nullcontext(None) as stream:
        completed = subprocess.run(  # noqa: S603 -- fixed module commands, no shell
            command,
            check=False,
            stdout=stream,
            stderr=subprocess.STDOUT,
        )
        write_json(receipt, {"actual_child_exit": completed.returncode})
    return completed.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("shard", choices=("regular", "migrations"))
    options = parser.parse_args()
    require(not os.environ.get("PYTEST_ADDOPTS"), "external pytest selection is forbidden")
    identity = current_identity()
    output = BACKEND / ".pytest_cache/ci" / options.shard
    output.mkdir(parents=True, exist_ok=False)
    os.environ["BACKEND_CI_SHARD"] = options.shard
    os.environ["BACKEND_CI_OUTPUT"] = str(output)
    os.environ["COVERAGE_FILE"] = str(BACKEND / ".coverage")
    command = (
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "ci.pytest_plugin",
        "--cov",
        "--cov-config=" + str(BACKEND / "pyproject.toml"),
        "--cov-report=",
        "--cov-fail-under=0",
        "--durations=25",
    )
    status = run_child(command, output / "exit.json")
    if status != 0:
        return status
    coverage = BACKEND / ".coverage"
    read_coverage(coverage, coverage_sources())
    coverage.rename(output / "coverage.data")
    require(current_identity() == identity, "checkout changed during shard execution")
    bundle = {
        "schema": 1,
        "identity": identity,
        "shard": options.shard,
        "child_exit": status,
        "session": read_json(output / "session.json"),
        "coverage_sha256": digest(output / "coverage.data"),
    }
    validate_fragment(bundle, identity)
    write_json(output / "manifest.json", bundle)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
