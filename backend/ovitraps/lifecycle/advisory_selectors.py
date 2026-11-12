"""OP03 observed facts at a source cutoff; no historical authorization is inferred."""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from math import isfinite
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Count

from core.time import epi_week_label, format_instant
from organizations.models import Organization
from ovitraps.lifecycle.models import OvitrapIncidentLink
from ovitraps.models import Ovitrap, OvitrapReading
from rules.seeds import DEFAULT_PARAMETER_SEEDS
from rules.selectors import list_parameters_with_current, to_number

THRESHOLD_KEYS = ("closed_house_weeks_to_relocate", "incidents_to_relocate")


@dataclass(frozen=True)
class AdvisoryRules:
    context: dict[str, Any]
    weeks: int
    incidents: int


@dataclass(frozen=True)
class AdvisoryObservation:
    rules: AdvisoryRules
    required_epi_weeks: tuple[str, ...]
    observed_closed_house_weeks: tuple[str, ...]
    incident_count: int

    @property
    def suggested(self) -> bool:
        return (
            len(self.observed_closed_house_weeks) == self.rules.weeks
            or self.incident_count >= self.rules.incidents
        )


def relocation_thresholds(values: dict[str, int | float | None]) -> tuple[int, int] | None:
    """Reuse canonical OP03 bounds; seed defaults never repair absent values."""
    definitions = {seed.key: seed for seed in DEFAULT_PARAMETER_SEEDS}
    resolved = []
    for key in THRESHOLD_KEYS:
        value, definition = values.get(key), definitions[key]
        if (
            value is None
            or isinstance(value, bool)
            or not isfinite(value)
            or value != int(value)
            or value < definition.min_value
            or (definition.max_value is not None and value > definition.max_value)
        ):
            return None
        resolved.append(int(value))
    return resolved[0], resolved[1]


def select_advisory_rules(ovitrap: Ovitrap, at: datetime) -> AdvisoryRules | None:
    return select_organization_advisory_rules(ovitrap.organization, at)


def select_organization_advisory_rules(
    organization: Organization, at: datetime
) -> AdvisoryRules | None:
    """The relocation thresholds depend on the organization and the instant, never on the trap."""
    query = list_parameters_with_current(organization, at).filter(key__in=THRESHOLD_KEYS)
    rows = list(
        query.values(  # type: ignore[misc]  # current_* are the owner's Subquery annotations.
            "key", "value_type", "current_value", "current_version_id", "current_effective_from"
        )
    )
    values = {
        row["key"]: None
        if row["current_value"] is None
        else to_number(row["value_type"], row["current_value"])
        for row in rows
    }
    thresholds = relocation_thresholds(values)
    if thresholds is None:
        return None
    parameters = {row["key"]: _rule_tuple(row, values[row["key"]]) for row in rows}
    context = {
        "timezone": organization.timezone,
        "epi_week": organization.epi_week,
        "parameters": parameters,
    }
    return AdvisoryRules(context, *thresholds)


def _rule_tuple(row: dict[str, Any], value: int | float | None) -> dict[str, Any]:
    return {
        "version_id": str(row["current_version_id"]),
        "value": value,
        "effective_from": format_instant(row["current_effective_from"]),
    }


def required_weeks(ovitrap: Ovitrap, at: datetime, count: int) -> tuple[str, ...]:
    return organization_required_weeks(ovitrap.organization, at, count)


def organization_required_weeks(
    organization: Organization, at: datetime, count: int
) -> tuple[str, ...]:
    local_date = at.astimezone(ZoneInfo(organization.timezone)).date()
    return tuple(
        epi_week_label(local_date - timedelta(weeks=offset), organization.epi_week)
        for offset in range(count)
    )


def observed_weeks(ovitrap: Ovitrap, at: datetime, required: tuple[str, ...]) -> tuple[str, ...]:
    matching = set(
        OvitrapReading.objects.filter(
            organization=ovitrap.organization,
            ovitrap__sampling_point_id=ovitrap.sampling_point_id,
            finding_code="closed-house",
            epi_week__in=required,
            event__device_time__lte=at,
            event__voided_at__isnull=True,
        )
        .values_list("epi_week", flat=True)
        .distinct()
    )
    return tuple(label for label in required if label in matching)


def select_advisory_observation(ovitrap: Ovitrap, at: datetime) -> AdvisoryObservation | None:
    """Current committed nonvoid point-wide facts, including effects applied by review."""
    rules = select_advisory_rules(ovitrap, at)
    if rules is None:
        return None
    required = required_weeks(ovitrap, at, rules.weeks)
    observed = observed_weeks(ovitrap, at, required)
    incidents = OvitrapIncidentLink.objects.filter(
        organization=ovitrap.organization,
        ovitrap__sampling_point_id=ovitrap.sampling_point_id,
        event__device_time__lte=at,
        event__voided_at__isnull=True,
    ).count()
    return AdvisoryObservation(rules, required, observed, incidents)


def select_advisory_observations(
    ovitraps: Sequence[Ovitrap], at: datetime
) -> dict[object, AdvisoryObservation | None]:
    """`select_advisory_observation` for a page of ovitraps in a constant number of queries.

    Rules and required weeks are resolved once per organization; the closed-house weeks and the
    incident counts of every sampling point come from one grouped query each. Keyed by ovitrap pk.
    """
    result: dict[object, AdvisoryObservation | None] = {trap.pk: None for trap in ovitraps}
    by_organization: dict[object, list[Ovitrap]] = defaultdict(list)
    for trap in ovitraps:
        by_organization[trap.organization_id].append(trap)
    organizations = Organization.objects.in_bulk(list(by_organization))
    for organization_id, traps in by_organization.items():
        organization = organizations[organization_id]
        rules = select_organization_advisory_rules(organization, at)
        if rules is None:
            continue
        required = organization_required_weeks(organization, at, rules.weeks)
        points = {trap.sampling_point_id for trap in traps}
        matching: dict[object, set[str]] = defaultdict(set)
        for point_id, week in (
            OvitrapReading.objects.filter(
                organization=organization,
                ovitrap__sampling_point_id__in=points,
                finding_code="closed-house",
                epi_week__in=required,
                event__device_time__lte=at,
                event__voided_at__isnull=True,
            )
            .values_list("ovitrap__sampling_point_id", "epi_week")
            .distinct()
        ):
            matching[point_id].add(week)
        incidents = dict(
            OvitrapIncidentLink.objects.filter(
                organization=organization,
                ovitrap__sampling_point_id__in=points,
                event__device_time__lte=at,
                event__voided_at__isnull=True,
            )
            .values_list("ovitrap__sampling_point_id")
            .annotate(total=Count("pk"))
            .order_by()
        )
        for trap in traps:
            observed = tuple(
                label for label in required if label in matching[trap.sampling_point_id]
            )
            result[trap.pk] = AdvisoryObservation(
                rules, required, observed, incidents.get(trap.sampling_point_id, 0)
            )
    return result
