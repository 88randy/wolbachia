from datetime import datetime
from decimal import Decimal
from typing import Any, cast

from django.db.models import Case, CharField, Min, OuterRef, QuerySet, Subquery, Value, When

from core.snapshots import with_version
from core.time import format_instant
from organizations.models import Organization
from rules.models import RuleParameter, RuleParameterVersion, ValueType

STATUS_SCHEDULED = "scheduled"
STATUS_IN_FORCE = "in_force"
STATUS_SUPERSEDED = "superseded"
STATUS_VOIDED = "voided"
# Latest start wins; `created_at` breaks the tie between versions that start at the same instant.
IN_FORCE_ORDER = ("-effective_from", "-created_at")


def to_number(value_type: str, value: Decimal) -> int | float:
    """A stored value as the JSON number clients expect: `50`, not `50.000`."""
    return int(value) if value_type == ValueType.INTEGER else float(value)


def get_version_in_force(parameter: RuleParameter, at: datetime) -> RuleParameterVersion | None:
    """The latest non-voided version that started at or before `at`; None if there is none."""
    started = RuleParameterVersion.objects.filter(
        parameter=parameter, effective_from__lte=at, voided_at__isnull=True
    )
    return started.order_by(*IN_FORCE_ORDER).first()


def list_versions(parameter: RuleParameter, at: datetime) -> QuerySet[RuleParameterVersion]:
    """Full history (voided included), newest first, each labelled with its `status`.

    Statuses: `voided`, `scheduled`, `in_force` or `superseded`.
    """
    in_force = get_version_in_force(parameter, at)
    cases = [
        When(voided_at__isnull=False, then=Value(STATUS_VOIDED)),
        When(effective_from__gt=at, then=Value(STATUS_SCHEDULED)),
    ]
    if in_force is not None:
        cases.append(When(pk=in_force.pk, then=Value(STATUS_IN_FORCE)))
    status = Case(*cases, default=Value(STATUS_SUPERSEDED), output_field=CharField())
    history = (
        RuleParameterVersion.objects.filter(parameter=parameter)
        .select_related("parameter")
        .annotate(status=status)
        .order_by("-effective_from", "-created_at")
    )
    return cast("QuerySet[RuleParameterVersion]", history)


def list_parameters_with_current(
    organization: Organization, at: datetime
) -> QuerySet[RuleParameter]:
    """Parameters of the organization annotated with the version in force at `at` and the next change.

    Voided versions are ignored. Annotations: `current_value`, `current_effective_from`,
    `current_version_id` (null when no version applies yet) and `next_change_at` (the earliest
    later version). One query, no N+1.
    """
    live = RuleParameterVersion.objects.filter(parameter=OuterRef("pk"), voided_at__isnull=True)
    started = live.filter(effective_from__lte=at).order_by(*IN_FORCE_ORDER)
    upcoming = live.filter(effective_from__gt=at).order_by("effective_from")
    return (
        RuleParameter.objects.for_org(organization)
        .annotate(
            current_value=Subquery(started.values("value")[:1]),
            current_effective_from=Subquery(started.values("effective_from")[:1]),
            current_version_id=Subquery(started.values("id")[:1]),
            next_change_at=Subquery(upcoming.values("effective_from")[:1]),
        )
        .order_by("key")
    )


def get_next_change_at(organization: Organization, at: datetime) -> datetime | None:
    """When the next scheduled, non-voided version of any parameter takes effect, or None."""
    upcoming = RuleParameterVersion.objects.for_org(organization).filter(
        effective_from__gt=at, voided_at__isnull=True
    )
    result: datetime | None = upcoming.aggregate(next_change=Min("effective_from"))["next_change"]
    return result


def _snapshot_parameter(row: dict[str, Any]) -> dict[str, Any]:
    value = row["current_value"]
    effective_from = row["current_effective_from"]
    version_id = row["current_version_id"]
    return {
        "key": row["key"],
        "value_type": row["value_type"],
        "unit": row["unit"],
        "value": None if value is None else to_number(row["value_type"], value),
        "effective_from": None if effective_from is None else format_instant(effective_from),
        "version_id": None if version_id is None else str(version_id),
    }


def build_rules_snapshot(organization: Organization, at: datetime) -> dict[str, Any]:
    """The values in force at `at` plus `next_change_at`, hashed into a `version`.

    Versions scheduled for later (and voided ones) are left out, but the earliest scheduled one
    is exposed as `next_change_at` (and is part of the hash), so a phone knows when to ask again.
    """
    rows = list_parameters_with_current(organization, at).values(  # type: ignore[misc]
        "key", "value_type", "unit", "current_value", "current_effective_from", "current_version_id"
    )
    next_change = get_next_change_at(organization, at)
    return with_version(
        {
            "next_change_at": None if next_change is None else format_instant(next_change),
            "parameters": [_snapshot_parameter(row) for row in rows],
        }
    )
