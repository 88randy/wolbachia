"""Exact independent-observation comparisons over already validated pinned inputs."""

from dataclasses import dataclass

from lab.policies import PERCENT_BASE


@dataclass(frozen=True)
class RecountComparison:
    first: int
    second: int
    absolute_tolerance: int
    relative_per_100: int


def requires_third(comparison: RecountComparison) -> bool:
    """Equality is within tolerance; integer scaling retains fractional boundaries."""
    difference = abs(comparison.first - comparison.second) * PERCENT_BASE
    threshold = max(
        comparison.absolute_tolerance * PERCENT_BASE,
        comparison.relative_per_100 * comparison.first,
    )
    return difference > threshold
