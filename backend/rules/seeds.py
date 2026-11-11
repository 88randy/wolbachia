"""Default rule parameters of a new organization. Safe to run twice.

Values come from the design brief (NOM-032-SSA2-2014 / CENAPRECE guide as cited by the client)
and must be validated with the program entomologist. A parameter whose value the brief does not
give is supplied by accepted OP03/OP04 and MO02-MO04 launch decisions (#99).
Reruns never overwrite versioned organization values.
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
    ParameterSeed(
        "lab_count_plausibility_limit",
        ValueType.INTEGER,
        Unit.COUNT,
        1000,
        Decimal(100),
        Decimal(10000),
    ),
    ParameterSeed(
        "lab_recount_sample_per_100",
        ValueType.INTEGER,
        Unit.COUNT,
        5,
        Decimal(1),
        Decimal(20),
    ),
    # [ASSUMPTION] Operational daily target, never a capture cap; confirm bounds with client.
    ParameterSeed("daily_task_target", ValueType.INTEGER, Unit.COUNT, 40, Decimal(1), Decimal(200)),
    # [ASSUMPTION] Pilot accuracy policy; versioned per organization, never hard-coded in a handler.
    ParameterSeed(
        "max_gps_accuracy_m", ValueType.INTEGER, Unit.METERS, 50, Decimal(1), Decimal(200)
    ),
    ParameterSeed(
        "max_distance_to_point_m", ValueType.INTEGER, Unit.METERS, 50, Decimal(10), Decimal(200)
    ),
    ParameterSeed(
        "min_distance_same_block_m", ValueType.INTEGER, Unit.METERS, 50, Decimal(10), Decimal(200)
    ),
    ParameterSeed(
        "speed_lock_kmh", ValueType.INTEGER, Unit.KILOMETERS_PER_HOUR, 10, Decimal(5), Decimal(15)
    ),
    ParameterSeed(
        "speed_unlock_seconds", ValueType.INTEGER, Unit.SECONDS, 5, Decimal(3), Decimal(30)
    ),
    ParameterSeed(
        "clock_skew_review_seconds",
        ValueType.INTEGER,
        Unit.SECONDS,
        300,
        Decimal(30),
        Decimal(3600),
    ),
    ParameterSeed(
        "closed_house_weeks_to_relocate", ValueType.INTEGER, Unit.WEEKS, 2, Decimal(1), Decimal(8)
    ),
    ParameterSeed(
        "incidents_to_relocate", ValueType.INTEGER, Unit.COUNT, 3, Decimal(1), Decimal(10)
    ),
    ParameterSeed(
        "fuel_efficiency_min_km_l",
        ValueType.DECIMAL,
        Unit.KILOMETERS_PER_LITER,
        15,
        Decimal(5),
        Decimal(100),
    ),
    ParameterSeed(
        "fuel_efficiency_max_km_l",
        ValueType.DECIMAL,
        Unit.KILOMETERS_PER_LITER,
        60,
        Decimal(5),
        Decimal(100),
    ),
    ParameterSeed(
        "session_idle_minutes", ValueType.INTEGER, Unit.MINUTES, 5, Decimal(1), Decimal(30)
    ),
    ParameterSeed("pin_max_attempts", ValueType.INTEGER, Unit.COUNT, 3, Decimal(1), Decimal(10)),
    ParameterSeed(
        "reminder_minutes_before_end", ValueType.INTEGER, Unit.MINUTES, 60, Decimal(5), Decimal(180)
    ),
    ParameterSeed("max_paddle_reuses", ValueType.INTEGER, Unit.COUNT, 2, Decimal(0), Decimal(2)),
    # Reuse #88's key and day unit; no second revisit rule or consumer.
    ParameterSeed(
        "revisit_interval_days", ValueType.INTEGER, Unit.DAYS, 7, Decimal(1), Decimal(28)
    ),
    # Boolean stored as 0/1. The offline map pack is recommended, not required, until the tile
    # source is chosen (client decision delegated); 1 restores the blocking departure gate.
    ParameterSeed(
        "departure_requires_offline_map", ValueType.INTEGER, Unit.COUNT, 0, Decimal(0), Decimal(1)
    ),
)


def missing_parameter_keys(organization: Organization) -> list[str]:
    """Read-only: definitions, first versions or reviewed bounds the launch seed would fill."""
    existing = {
        parameter.key: parameter
        for parameter in RuleParameter.objects.filter(organization=organization).prefetch_related(
            "versions"
        )
    }
    return [
        seed.key
        for seed in DEFAULT_PARAMETER_SEEDS
        if _needs_parameter_seed(existing.get(seed.key), seed)
    ]


def _needs_parameter_seed(parameter: RuleParameter | None, seed: ParameterSeed) -> bool:
    if parameter is None:
        return True
    if parameter.min_value != seed.min_value or parameter.max_value != seed.max_value:
        return True
    return seed.value is not None and not parameter.versions.exists()


def seed_default_rule_parameters(organization: Organization) -> list[RuleParameter]:
    """Create the default parameters and, where the brief has a value, their first version.

    Writes RuleParameter and RuleParameterVersion. A parameter that already has any version is
    left alone, so running it again never adds a second version or touches admin changes.
    Missing fuel defaults are staged together and checked against the complete resulting
    current/future timeline before insertion; a conflict rolls back the whole seed.
    """
    now = timezone.now()
    with transaction.atomic():
        Organization.objects.select_for_update(no_key=True).get(pk=organization.pk)
        parameters = [_ensure_parameter(organization, seed) for seed in DEFAULT_PARAMETER_SEEDS]
        pending = [
            (parameter, seed.value)
            for parameter, seed in zip(parameters, DEFAULT_PARAMETER_SEEDS, strict=True)
            if seed.value is not None and not parameter.versions.exists()
        ]
        _validate_pending_fuel_defaults(organization, pending, now)
        for parameter, value in pending:
            _create_first_version(parameter, value, now)
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
    # Bounds are reviewed schema definitions, not editable organization values.
    if parameter.min_value != seed.min_value or parameter.max_value != seed.max_value:
        parameter.min_value = seed.min_value
        parameter.max_value = seed.max_value
        parameter.save(update_fields=["min_value", "max_value"])
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


def _validate_pending_fuel_defaults(
    organization: Organization, pending: list[tuple[RuleParameter, int]], now: datetime
) -> None:
    """Validate both proposed fuel defaults together against current and scheduled history."""
    # Runtime import: organization services load these seed definitions during startup.
    from rules.services import FUEL_MAX_KEY, FUEL_MIN_KEY, validate_fuel_timeline

    fuel_keys = {FUEL_MIN_KEY, FUEL_MAX_KEY}
    proposed = [
        (now, parameter.key, Decimal(value))
        for parameter, value in pending
        if parameter.key in fuel_keys
    ]
    if not proposed:
        return
    existing = (
        RuleParameterVersion.objects.filter(
            organization=organization, parameter__key__in=fuel_keys, voided_at__isnull=True
        )
        .select_related("parameter")
        .order_by("effective_from", "created_at", "id")
    )
    timeline = [
        (version.effective_from, version.parameter.key, version.value) for version in existing
    ]
    validate_fuel_timeline([*timeline, *proposed], now)
