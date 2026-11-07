"""Validate explicit coverage inputs before coverage can skip an unreadable file."""

from contextlib import closing
from pathlib import Path

from coverage import CoverageData
from coverage.exceptions import CoverageException

from ci.contract import require


def read_coverage(path: Path, sources: tuple[Path, ...]) -> dict[str, set[int]]:
    require(path.is_file() and not path.is_symlink(), "missing coverage input")
    try:
        with closing(CoverageData(basename=str(path))) as recorded:
            recorded.read()
            filenames = recorded.measured_files()
            require(bool(filenames) and not recorded.has_arcs(), "empty or branch coverage input")
            executed = {filename: set(recorded.lines(filename) or ()) for filename in filenames}
            require(any(executed.values()), "coverage has no executed lines")
            for filename in filenames:
                resolved = Path(filename).resolve()
                require(
                    resolved.is_file()
                    and any(resolved.is_relative_to(root.resolve()) for root in sources),
                    "foreign coverage path",
                )
    except (CoverageException, OSError) as error:
        raise ValueError("CI evidence: unreadable coverage input") from error
    else:
        return executed
