"""Pure pinned scoring, half-open validity and server-ordered streak rules."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

SECTION_NAMES = frozenset({"presentation", "execution", "coverage"})
DEFAULT_WEIGHTS = {"presentation": 20, "execution": 50, "coverage": 30}
DEFAULT_PASS_THRESHOLD = Decimal("80")
NOTICE_STREAK_LENGTH = 3


@dataclass(frozen=True)
class RubricPolicy:
    weights: Mapping[str, int]
    pass_threshold: Decimal
    critical_checks: tuple[str, ...]

    def __post_init__(self) -> None:
        if (
            set(self.weights) != SECTION_NAMES
            or any(
                type(value) is not int or not 0 <= value <= 100 for value in self.weights.values()
            )
            or sum(self.weights.values()) != 100
            or not self.pass_threshold.is_finite()
            or not 0 <= self.pass_threshold <= 100
            or not self.critical_checks
            or len(set(self.critical_checks)) != len(self.critical_checks)
            or any(not isinstance(key, str) or not key.strip() for key in self.critical_checks)
        ):
            raise ValueError("rubric_configuration_unavailable")


@dataclass(frozen=True)
class EvaluationScore:
    outcome: str
    total: Decimal | None


def score_evaluation(
    policy: RubricPolicy,
    scores: Mapping[str, Decimal | None],
    critical: Mapping[str, bool | None],
) -> EvaluationScore:
    if set(scores) - SECTION_NAMES or set(critical) - set(policy.critical_checks):
        raise ValueError("invalid_observation")
    for value in scores.values():
        if value is not None and (not value.is_finite() or not 0 <= value <= 100):
            raise ValueError("invalid_score")
    if any(value is not None and type(value) is not bool for value in critical.values()):
        raise ValueError("invalid_critical_response")
    if any(scores.get(key) is None for key in SECTION_NAMES) or any(
        critical.get(key) is None for key in policy.critical_checks
    ):
        return EvaluationScore("incomplete", None)
    total = sum(
        (value * policy.weights[key] / 100 for key, value in scores.items() if value is not None),
        Decimal(0),
    )
    if not all(critical.values()):
        return EvaluationScore("critical_failure", total)
    return EvaluationScore("pass" if total >= policy.pass_threshold else "low", total)


@dataclass(frozen=True)
class ValidityWindow:
    start: datetime
    end: datetime
    maximum_duration: timedelta

    def __post_init__(self) -> None:
        if (
            self.start.tzinfo is None
            or self.end.tzinfo is None
            or self.maximum_duration <= timedelta(0)
            or not timedelta(0)
            < self.end.astimezone(UTC) - self.start.astimezone(UTC)
            <= self.maximum_duration
        ):
            raise ValueError("invalid_validity")

    def includes(self, instant: datetime) -> bool:
        if instant.tzinfo is None:
            raise ValueError("invalid_validity_instant")
        return self.start.astimezone(UTC) <= instant.astimezone(UTC) < self.end.astimezone(UTC)


@dataclass(frozen=True)
class StreakState:
    count: int = 0
    episode_start: int | None = None
    trigger_sequence: int | None = None
    last_sequence: int = 0


def advance_streak(state: StreakState, outcome: str, sequence: int | None) -> StreakState:
    if outcome == "incomplete":
        if sequence is not None:
            raise ValueError("incomplete_has_no_completion")
        return state
    if type(sequence) is not int or sequence <= state.last_sequence:
        raise ValueError("invalid_completion_sequence")
    if outcome == "pass":
        return StreakState(last_sequence=sequence)
    if outcome not in {"low", "critical_failure"}:
        raise ValueError("invalid_outcome")
    count = state.count + 1
    trigger = sequence if count == NOTICE_STREAK_LENGTH else state.trigger_sequence
    return StreakState(count, state.episode_start or sequence, trigger, sequence)
