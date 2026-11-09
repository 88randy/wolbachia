"""Accept every current fragment before reporting whole-backend coverage."""

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ci.contract import PARTITION_NAMES, require, validate_fragments
from ci.coverage_data import read_coverage
from ci.evidence import BACKEND, coverage_sources, current_identity, digest, read_json, write_json
from ci.runner import run_child


@dataclass(frozen=True)
class GateInputs:
    directory: Path
    sources: tuple[Path, ...]


def verify_inputs(inputs: GateInputs, expected: dict[str, Any]) -> list[Path]:
    require(
        inputs.directory.is_dir() and not inputs.directory.is_symlink(),
        "missing artifact directory",
    )
    require(
        {path.name for path in inputs.directory.iterdir()} == set(PARTITION_NAMES),
        "missing or unconsumed artifact directory",
    )
    directories = [inputs.directory / shard for shard in PARTITION_NAMES]
    require(not any(path.is_symlink() for path in directories), "linked artifact directory")
    bundles = [read_json(path / "manifest.json") for path in directories]
    validate_fragments(bundles, expected)
    paths = []
    for directory, bundle in zip(directories, bundles, strict=True):
        require(bundle["shard"] == directory.name, "artifact name differs from shard")
        path = directory / "coverage.data"
        read_coverage(path, inputs.sources)
        require(digest(path) == bundle["coverage_sha256"], "coverage digest mismatch")
        paths.append(path)
    return paths


def combine_coverage(paths: list[Path], output: Path) -> None:
    log = output.parent / "combine.log"
    command = (
        sys.executable,
        "-m",
        "coverage",
        "combine",
        "--rcfile=" + str(BACKEND / "pyproject.toml"),
        "--keep",
        "--data-file=" + str(output),
        *(str(path) for path in paths),
    )
    status = run_child(command, output.parent / "combine-exit.json", log)
    transcript = log.read_text(encoding="utf-8")
    consumed = re.search(
        r"^Combined (\d+) files?(?:, skipped (\d+))?$", transcript, flags=re.MULTILINE
    )
    require(
        status == 0 and "Couldn't combine" not in transcript and "Warning:" not in transcript,
        "coverage combine failed or skipped an input",
    )
    if consumed is None:
        raise ValueError("CI evidence: missing coverage consumption receipt")
    combined, duplicate = (int(value or 0) for value in consumed.groups())
    require(
        combined == len({digest(path) for path in paths}) and combined + duplicate == len(paths),
        "coverage did not consume every input",
    )


def main() -> int:
    identity = current_identity()
    inputs = GateInputs(BACKEND / ".pytest_cache/ci-downloads", coverage_sources())
    paths = verify_inputs(inputs, identity)
    expected_lines: dict[str, set[int]] = {}
    for path in paths:
        for filename, lines in read_coverage(path, inputs.sources).items():
            expected_lines.setdefault(filename, set()).update(lines)
    hashes = [digest(path) for path in paths]
    output = BACKEND / ".pytest_cache/ci-combined"
    output.mkdir(parents=True, exist_ok=False)
    combine_coverage(paths, output / "coverage.data")
    require([digest(path) for path in paths] == hashes, "input changed during combine")
    require(
        read_coverage(output / "coverage.data", inputs.sources) == expected_lines,
        "combined executed-line union differs",
    )
    status = run_child(
        (
            sys.executable,
            "-m",
            "coverage",
            "report",
            "--rcfile=" + str(BACKEND / "pyproject.toml"),
            "--data-file=" + str(output / "coverage.data"),
            "--fail-under=85",
        ),
        output / "report-exit.json",
    )
    require(status == 0, "combined coverage did not pass 85 percent")
    write_json(
        output / "manifest.json",
        {
            "identity": identity,
            "shards": list(PARTITION_NAMES),
            "coverage_sha256": digest(output / "coverage.data"),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
