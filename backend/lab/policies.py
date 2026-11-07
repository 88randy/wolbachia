"""Pure first-pass observation/reporting rules; policy values arrive as captured inputs."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext

MAX_OBSERVATION = 2**53 - 1
PERCENT_BASE = 100
RATIO_QUANTUM = Decimal("0.000001")


class LabPolicyError(ValueError):
    """A coded invalid observation or an explicit policy/configuration gate."""


@dataclass(frozen=True)
class CountFacts:
    value: object
    confirmed_implausible: bool
    limit: int
    has_eggs: bool


@dataclass(frozen=True)
class CountEvaluation:
    recount_causes: tuple[str, ...]


@dataclass(frozen=True)
class ExaminedFacts:
    viable_eggs: int
    total_examined: int


@dataclass(frozen=True)
class ViabilityResult:
    percent: Decimal | None
    reason: str | None


def observation_integer(value: object) -> int:
    """Keep interoperable authored integers distinct from booleans and unavailable facts."""
    if type(value) is not int or not 0 <= value <= MAX_OBSERVATION:
        raise LabPolicyError("lab_integer_required")
    return value


def evaluate_count(facts: CountFacts) -> CountEvaluation:
    value = observation_integer(facts.value)
    if value > facts.limit and not facts.confirmed_implausible:
        raise LabPolicyError("lab_confirmation_required")
    causes = []
    if value > facts.limit:
        causes.append("implausible")
    if value > 0 and not facts.has_eggs:
        causes.append("eggs_flag_absent")
    return CountEvaluation(tuple(causes))


def viability(facts: ExaminedFacts) -> ViabilityResult:
    viable = observation_integer(facts.viable_eggs)
    examined = observation_integer(facts.total_examined)
    if viable > examined:
        raise LabPolicyError("lab_viability_invalid")
    if examined == 0:
        return ViabilityResult(None, "zero_examined")
    with localcontext() as context:
        context.prec = 40
        ratio = Decimal(viable) * PERCENT_BASE / Decimal(examined)
        return ViabilityResult(ratio.quantize(RATIO_QUANTUM, rounding=ROUND_HALF_UP), None)


def sample_size(population: int, per_100: int) -> int:
    """A nonempty closed-day population rounds its configured quota up, never down."""
    if population < 0 or not 0 < per_100 <= PERCENT_BASE:
        raise LabPolicyError("lab_sampling_unavailable")
    return (population * per_100 + PERCENT_BASE - 1) // PERCENT_BASE
