from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from accounts.models import User
from core.exceptions import FieldValidationError
from rules.models import RuleParameter, RuleParameterVersion, ValueType
from rules.selectors import to_number

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


def local_today(timezone_name: str, now: datetime) -> date:
    return now.astimezone(ZoneInfo(timezone_name)).date()


def resolve_effective_from(requested: date, timezone_name: str, now: datetime) -> datetime:
    """The UTC instant a version requested for a local date takes effect.

    Today takes effect at `now` (never retroactive); a future date at 00:00 in the organization's
    timezone; a past date is a field error (`effective_from_in_past`).
    """
    today = local_today(timezone_name, now)
    if requested < today:
        raise FieldValidationError("effective_from", PAST_DATE)
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

    The parameter row is locked, so two admins scheduling the same date cannot both succeed:
    the second gets `duplicate_effective_date`. Field errors: `effective_from_in_past`,
    `duplicate_effective_date`, `not_an_integer`, `out_of_range` (with params `{min, max}`).
    """
    with transaction.atomic():
        locked = (
            RuleParameter.objects.select_for_update(of=("self",))
            .select_related("organization")
            .get(pk=parameter.pk)
        )
        validate_value(locked, spec.value)
        effective_from = resolve_effective_from(
            spec.effective_date, locked.organization.timezone, timezone.now()
        )
        if locked.versions.filter(effective_date=spec.effective_date).exists():
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
