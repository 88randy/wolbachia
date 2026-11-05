from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.db.models import Max, QuerySet

from organizations.models import Organization
from shifts.models import Motorcycle, Shift


@dataclass(frozen=True)
class ShiftFilters:
    """Filters of `GET /shifts/`. `opened_from` is inclusive and `opened_before` exclusive, both
    compared with the phone's `opened_at_device`."""

    status: str | None = None
    courier: UUID | None = None
    opened_from: datetime | None = None
    opened_before: datetime | None = None


def list_shifts(scoped: QuerySet[Any], filters: ShiftFilters) -> QuerySet[Shift]:
    """Newest first, with checklist and motorcycle loaded, narrowed by `filters` (reads).

    `scoped` must already be limited to one organization.
    """
    shifts = scoped.select_related("motorcycle").prefetch_related("checks__item")
    if filters.status is not None:
        shifts = shifts.filter(status=filters.status)
    if filters.courier is not None:
        shifts = shifts.filter(courier_id=filters.courier)
    if filters.opened_from is not None:
        shifts = shifts.filter(opened_at_device__gte=filters.opened_from)
    if filters.opened_before is not None:
        shifts = shifts.filter(opened_at_device__lt=filters.opened_before)
    return shifts.order_by("-opened_at_device", "-id")


def highest_recorded_km(motorcycle: Motorcycle) -> int | None:
    """The highest odometer reading ever recorded for the motorcycle (open or close, of any of its
    shifts), or `None` for a motorcycle with no shift yet (reads, one aggregate).

    An odometer only goes up, so the maximum is the reference. It needs no ordering of shifts:
    the events of one batch share one receipt time and the phone's clock cannot be trusted.
    """
    readings = Shift.objects.filter(motorcycle=motorcycle).aggregate(
        highest_open=Max("odometer_open_km"), highest_close=Max("odometer_close_km")
    )
    values = [value for value in readings.values() if value is not None]
    return max(values) if values else None


def list_snapshot_motorcycles(organization: Organization) -> list[dict[str, Any]]:
    """Live fleet, including blocked motorcycles and their reason, in stable code order."""
    return [
        {
            "id": str(motorcycle.pk),
            "code": motorcycle.code,
            "plate": motorcycle.plate,
            "is_blocked": motorcycle.is_blocked,
            "blocked_reason": motorcycle.blocked_reason,
        }
        for motorcycle in Motorcycle.objects.for_org(organization)
        .not_voided()
        .order_by("code", "id")
    ]
