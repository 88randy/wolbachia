from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.utils import timezone

from accounts.models import User
from core.exceptions import FieldValidationError
from core.services import lock_record_for_update, void_validated_record
from core.time import local_today
from core.void_reason import resolve_void_reason
from organizations.services import lock_organization_configuration
from rules.exceptions import VersionNotScheduledError
from rules.models import RuleParameter, RuleParameterVersion, ValueType
from rules.selectors import to_number

# A version can be scheduled at most this far ahead: it keeps typos (2206 for 2026) out.
EFFECTIVE_FROM_HORIZON_DAYS = 365
TOO_FAR = "effective_from_too_far"
PAST_DATE = "effective_from_in_past"
DUPLICATE_DATE = "duplicate_effective_date"
OUT_OF_RANGE = "out_of_range"
NOT_AN_INTEGER = "not_an_integer"


@dataclass(frozen=True)
class RuleVersionSpec:
    """What an admin provides: the new value, the local date it starts on, and why."""

    value: Decimal
    effective_date: date
    reason: str


def resolve_effective_from(requested: date, timezone_name: str, now: datetime) -> datetime:
    """The UTC instant a version requested for a local date takes effect.

    Today takes effect at `now` (never retroactive); a future date at 00:00 in the organization's
    timezone. A past date is a field error (`effective_from_in_past`), and so is one further than
    `EFFECTIVE_FROM_HORIZON_DAYS` ahead (`effective_from_too_far`).
    """
    today = local_today(timezone_name, now)
    if requested < today:
        raise FieldValidationError("effective_from", PAST_DATE)
    if requested > today + timedelta(days=EFFECTIVE_FROM_HORIZON_DAYS):
        raise FieldValidationError("effective_from", TOO_FAR)
    if requested == today:
        return now
    midnight = datetime.combine(requested, time.min, tzinfo=ZoneInfo(timezone_name))
    return midnight.astimezone(UTC)


def validate_value(parameter: RuleParameter, value: Decimal) -> None:
    """Check the value against the parameter's type and bounds (field errors on `value`)."""
    if parameter.value_type == ValueType.INTEGER and value != value.to_integral_value():
        raise FieldValidationError("value", NOT_AN_INTEGER)
    below = parameter.min_value is not None and value < parameter.min_value
    above = parameter.max_value is not None and value > parameter.max_value
    if below or above:
        raise FieldValidationError("value", OUT_OF_RANGE, _bounds(parameter))


def _bounds(parameter: RuleParameter) -> dict[str, int | float | None]:
    """`{min, max}` as JSON numbers (None when unbounded) for the `out_of_range` params."""
    bounds = {"min": parameter.min_value, "max": parameter.max_value}
    return {
        name: None if bound is None else to_number(parameter.value_type, bound)
        for name, bound in bounds.items()
    }


def create_rule_version(
    parameter: RuleParameter, spec: RuleVersionSpec, user: User
) -> RuleParameterVersion:
    """Schedule a new value for a parameter (writes RuleParameterVersion). Never edits a version.

    The parameter row is locked, so two admins scheduling the same future date cannot both
    succeed: contention gets retryable 429; after retry, `duplicate_effective_date` (a voided version does not count, so a
    wrong one is voided first). A version for today is always allowed: it takes effect now and
    the latest `effective_from` wins, which lets an admin correct a seeded value on day one.
    Field errors: `effective_from_in_past`, `effective_from_too_far`, `duplicate_effective_date`,
    `not_an_integer`, `out_of_range` (with params `{min, max}`).
    """
    with lock_organization_configuration(parameter.organization_id):
        locked = (
            RuleParameter.objects.select_for_update(of=("self",))
            .select_related("organization")
            .get(pk=parameter.pk)
        )
        validate_value(locked, spec.value)
        now = timezone.now()
        effective_from = resolve_effective_from(
            spec.effective_date, locked.organization.timezone, now
        )
        _validate_fuel_pair(locked, spec.value, effective_from)
        if effective_from > now and _is_date_taken(locked, spec.effective_date):
            raise FieldValidationError("effective_from", DUPLICATE_DATE)
        return RuleParameterVersion.objects.create(
            organization_id=locked.organization_id,
            parameter=locked,
            value=spec.value,
            effective_from=effective_from,
            effective_date=spec.effective_date,
            reason=spec.reason,
            created_by=user,
        )


def _is_date_taken(parameter: RuleParameter, effective_date: date) -> bool:
    return RuleParameterVersion.objects.filter(
        parameter=parameter, effective_date=effective_date, voided_at__isnull=True
    ).exists()


def void_rule_version(  # noqa: PLR0913 -- explicit void contract
    version: RuleParameterVersion, user: User, reason: str, reason_code: str
) -> RuleParameterVersion:
    """Void a version that has not taken effect yet (writes the void fields). Never deletes.

    A version already in force or superseded is history that records may rely on, so it cannot
    be voided: `VersionNotScheduledError` (409). A voided version is excluded from the value
    in force and from the snapshots but stays in the history.
    """
    with lock_organization_configuration(version.organization_id):
        choice = resolve_void_reason(version.organization_id, reason, reason_code)
        locked = lock_record_for_update(version)
        if locked.effective_from <= timezone.now():
            raise VersionNotScheduledError
        if locked.parameter.key in (FUEL_MIN_KEY, FUEL_MAX_KEY):
            _validate_fuel_timeline(_fuel_versions(locked.parameter, locked), timezone.now())
        return void_validated_record(locked, user, choice)


FUEL_MIN_KEY = "fuel_efficiency_min_km_l"
FUEL_MAX_KEY = "fuel_efficiency_max_km_l"


def _validate_fuel_pair(parameter: RuleParameter, value: Decimal, effective_from: datetime) -> None:
    """Check every future transition, including this parameter's scheduled replacements."""
    if parameter.key not in (FUEL_MIN_KEY, FUEL_MAX_KEY):
        return
    versions = _fuel_versions(parameter)
    versions.append((effective_from, parameter.key, value))
    _validate_fuel_timeline(versions, effective_from)


def _fuel_versions(
    parameter: RuleParameter, exclude: RuleParameterVersion | None = None
) -> list[tuple[datetime, str, Decimal]]:
    versions = (
        RuleParameterVersion.objects.filter(
            organization_id=parameter.organization_id,
            parameter__key__in=[FUEL_MIN_KEY, FUEL_MAX_KEY],
            voided_at__isnull=True,
        )
        .select_related("parameter")
        .order_by("effective_from", "created_at", "id")
    )
    if exclude is not None:
        versions = versions.exclude(pk=exclude.pk)
    return [(version.effective_from, version.parameter.key, version.value) for version in versions]


def _validate_fuel_timeline(versions: list[tuple[datetime, str, Decimal]], start: datetime) -> None:
    current: dict[str, Decimal] = {}
    transitions: dict[datetime, list[tuple[str, Decimal]]] = {}
    for at, key, value in sorted(versions, key=lambda version: version[0]):
        transitions.setdefault(at, []).append((key, value))
    for at, changes in sorted(transitions.items()):
        current.update(changes)
        if (
            at >= start
            and FUEL_MIN_KEY in current
            and FUEL_MAX_KEY in current
            and current[FUEL_MIN_KEY] >= current[FUEL_MAX_KEY]
        ):
            raise FieldValidationError("value", "fuel_bounds_conflict")
