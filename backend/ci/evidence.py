"""Current checkout identity and durable, bounded CI receipts."""

import hashlib
import json
import os
import re
import shutil
import subprocess
import tomllib
from importlib.metadata import version
from pathlib import Path
from typing import Any

from ci.contract import require

BACKEND = Path(__file__).resolve().parents[1]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, document: dict[str, Any]) -> None:
    """Flush the receipt before returning to a parser or artifact packager."""
    with path.open("x", encoding="utf-8") as stream:
        json.dump(document, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())


def read_json(path: Path) -> dict[str, Any]:
    require(path.is_file() and not path.is_symlink(), "missing JSON receipt")
    document = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(document, dict), "invalid JSON receipt")
    return document


def coverage_sources() -> tuple[Path, ...]:
    config = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))
    require(config["tool"]["coverage"]["report"]["fail_under"] == 85, "coverage gate changed")
    return tuple(BACKEND / source for source in config["tool"]["coverage"]["run"]["source"])


def current_identity() -> dict[str, Any]:
    git = shutil.which("git")
    require(git is not None, "Git executable missing")
    checkout = subprocess.check_output(  # noqa: S603 -- fixed read-only Git command
        (str(git), "rev-parse", "HEAD"),
        cwd=BACKEND,
        text=True,
    ).strip()
    require(checkout == os.environ["GITHUB_SHA"], "checkout differs from workflow SHA")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", os.environ["CI_SOURCE_SHA"])), "invalid source SHA")
    require(
        all(
            os.environ[key].isdigit() and int(os.environ[key]) > 0
            for key in ("GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")
        ),
        "invalid run/attempt",
    )
    clean = subprocess.run(  # noqa: S603 -- fixed read-only Git command
        (str(git), "diff", "--quiet", "HEAD"),
        cwd=BACKEND,
        check=False,
    )
    require(clean.returncode == 0, "checkout has tracked modifications")
    return {
        "repository": os.environ["GITHUB_REPOSITORY"],
        "run_id": os.environ["GITHUB_RUN_ID"],
        "run_attempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "checkout_sha": checkout,
        "source_sha": os.environ["CI_SOURCE_SHA"],
        "workflow": os.environ["GITHUB_WORKFLOW"],
        "config": digest(BACKEND / "pyproject.toml"),
        "lock": digest(BACKEND / "uv.lock"),
        "workflow_config": digest(BACKEND.parent / ".github/workflows/backend.yml"),
        "tools": {
            name: version(name) for name in ("pytest", "pytest-cov", "coverage", "pytest-django")
        },
    }
