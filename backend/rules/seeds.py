"""Default rule parameters of a new organization. Safe to run twice.

Values come from the design brief (NOM-032-SSA2-2014 / CENAPRECE guide as cited by the client)
and must be validated with the program entomologist. A parameter whose value the brief does not
give is created without a version: its snapshot `value` is null ("not configured").
[PENDING client] speed_unlock_seconds, clock_skew_review_seconds, session_idle_minutes and the
two fuel efficiency bounds.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.time import local_today
from organizations.models import Organization
from rules.models import RuleParameter, RuleParameterVersion, Unit, ValueType

SEED_REASON = "seed: design brief"
# [ASSUMPTION] Every parameter is a non-negative quantity (distance, speed, time, count, yield).
NON_NEGATIVE = Decimal(0)


@dataclass(frozen=True)
class ParameterSeed:
    key: str
    value_type: ValueType
    unit: Unit
    value: int | None = None
    min_value: Decimal = NON_NEGATIVE
    max_value: Decimal | None = None


DEFAULT_PARAMETER_SEEDS = (
    ParameterSeed("max_distance_to_point_m", ValueType.INTEGER, Unit.METERS, 50),
    ParameterSeed("min_distance_same_block_m", ValueType.INTEGER, Unit.METERS, 50),
    ParameterSeed("speed_lock_kmh", ValueType.INTEGER, Unit.KILOMETERS_PER_HOUR, 10),
    ParameterSeed("speed_unlock_seconds", ValueType.INTEGER, Unit.SECONDS),
    ParameterSeed("clock_skew_review_seconds", ValueType.INTEGER, Unit.SECONDS),
    ParameterSeed("closed_house_weeks_to_relocate", ValueType.INTEGER, Unit.WEEKS, 2),
    ParameterSeed("incidents_to_relocate", ValueType.INTEGER, Unit.COUNT, 3),
    ParameterSeed("fuel_efficiency_min_km_l", ValueType.DECIMAL, Unit.KILOMETERS_PER_LITER),
    ParameterSeed("fuel_efficiency_max_km_l", ValueType.DECIMAL, Unit.KILOMETERS_PER_LITER),
    ParameterSeed("session_idle_minutes", ValueType.INTEGER, Unit.MINUTES),
    ParameterSeed("reminder_minutes_before_end", ValueType.INTEGER, Unit.MINUTES, 60),
    ParameterSeed("max_paddle_reuses", ValueType.INTEGER, Unit.COUNT, 2),
    # Decision OP02/OP03 (docs/pending-decisions-proposal.md): revisit every 7 days, 1 to 28.
    ParameterSeed(
        "revisit_interval_days",
        ValueType.INTEGER,
        Unit.DAYS,
        7,
        min_value=Decimal(1),
        max_value=Decimal(28),
    ),
)


def missing_parameter_keys(organization: Organization) -> list[str]:
    """Read-only: default parameters the organization does not have yet."""
    existing = set(
        RuleParameter.objects.filter(organization=organization).values_list("key", flat=True)
    )
    return [seed.key for seed in DEFAULT_PARAMETER_SEEDS if seed.key not in existing]


def seed_default_rule_parameters(organization: Organization) -> list[RuleParameter]:
    """Create the default parameters and, where the brief has a value, their first version.

    Writes RuleParameter and RuleParameterVersion. A parameter that already has any version is
    left alone, so running it again never adds a second version or touches admin changes.
    """
    now = timezone.now()
    with transaction.atomic():
        parameters = [_ensure_parameter(organization, seed) for seed in DEFAULT_PARAMETER_SEEDS]
        for parameter, seed in zip(parameters, DEFAULT_PARAMETER_SEEDS, strict=True):
            if seed.value is not None and not parameter.versions.exists():
                _create_first_version(parameter, seed.value, now)
    return parameters


def _ensure_parameter(organization: Organization, seed: ParameterSeed) -> RuleParameter:
    parameter, _ = RuleParameter.objects.get_or_create(
        organization=organization,
        key=seed.key,
        defaults={
            "value_type": seed.value_type,
            "unit": seed.unit,
            "min_value": seed.min_value,
            "max_value": seed.max_value,
        },
    )
    return parameter


def _create_first_version(parameter: RuleParameter, value: int, now: datetime) -> None:
    organization = parameter.organization
    RuleParameterVersion.objects.create(
        organization=organization,
        parameter=parameter,
        value=value,
        effective_from=now,
        effective_date=local_today(organization.timezone, now),
        reason=SEED_REASON,
    )
