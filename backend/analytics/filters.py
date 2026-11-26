"""Shared dashboard filters: date range, granularity, center and quadrant (all optional)."""

# ruff: noqa: PLR0913 -- scope helpers take the caller, the grant, the permission and filters

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import QuerySet
from django.http import Http404
from rest_framework import serializers

from core.exceptions import FieldValidationError
from geography.models import Quadrant
from organizations.models import Center, Membership, Organization
from organizations.scope import EffectiveScope
from organizations.selectors import filter_by_scope

MAX_RANGE_DAYS = 366
DEFAULT_RANGE_DAYS = 84
GRANULARITIES = ("day", "week")


class DashboardQuerySerializer(serializers.Serializer[Any]):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    granularity = serializers.ChoiceField(choices=GRANULARITIES, default="week")
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)


@dataclass(frozen=True)
class DashboardFilters:
    date_from: date
    date_to: date
    granularity: str
    center: UUID | None
    quadrant: UUID | None

    def bounds(self, organization: Organization) -> tuple[datetime, datetime]:
        """Half-open instants covering the local days date_from..date_to."""
        zone = ZoneInfo(organization.timezone)
        start = datetime.combine(self.date_from, time.min, tzinfo=zone)
        end = datetime.combine(self.date_to + timedelta(days=1), time.min, tzinfo=zone)
        return start, end

    def echo(self) -> dict[str, str | None]:
        return {
            "date_from": self.date_from.isoformat(),
            "date_to": self.date_to.isoformat(),
            "granularity": self.granularity,
            "center": None if self.center is None else str(self.center),
            "quadrant": None if self.quadrant is None else str(self.quadrant),
        }


def parse_filters(values: dict[str, Any], today: date, default_days: int) -> DashboardFilters:
    date_to = values.get("date_to", today)
    date_from = values.get("date_from", date_to - timedelta(days=default_days - 1))
    if date_from > date_to:
        raise FieldValidationError("date_from", "after_date_to")
    if (date_to - date_from).days >= MAX_RANGE_DAYS:
        raise FieldValidationError("date_to", "range_too_long")
    return DashboardFilters(
        date_from, date_to, values["granularity"], values.get("center"), values.get("quadrant")
    )


def scoped(
    queryset: QuerySet[Any], member: Membership, effective: EffectiveScope, permission: str
) -> QuerySet[Any]:
    """Rows of the organization of the caller that the grant of `permission` covers."""
    return filter_by_scope(queryset.filter(organization=member.organization), effective, permission)


def validate_scope_filters(
    member: Membership, effective: EffectiveScope, permission: str, filters: DashboardFilters
) -> None:
    """A center or quadrant outside the organization or the grant is a 404, never an empty chart."""
    if (
        filters.center is not None
        and not scoped(Center.objects.all(), member, effective, permission)
        .filter(pk=filters.center)
        .exists()
    ):
        raise Http404
    if (
        filters.quadrant is not None
        and not scoped(Quadrant.objects.all(), member, effective, permission)
        .filter(pk=filters.quadrant)
        .exists()
    ):
        raise Http404


def apply_area(
    queryset: QuerySet[Any],
    filters: DashboardFilters,
    center_lookup: str,
    quadrant_lookup: str | None,
) -> QuerySet[Any]:
    if filters.center is not None:
        queryset = queryset.filter(**{center_lookup: filters.center})
    if filters.quadrant is not None and quadrant_lookup is not None:
        queryset = queryset.filter(**{quadrant_lookup: filters.quadrant})
    return queryset
