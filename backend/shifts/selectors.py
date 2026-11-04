from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.db.models import QuerySet

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


def last_known_km(motorcycle: Motorcycle) -> int | None:
    """The odometer the motorcycle last reported: the close reading of its latest shift, or its
    open reading while that shift is still open. `None` for a motorcycle with no shift yet."""
    latest = (
        Shift.objects.filter(motorcycle=motorcycle)
        .order_by("-opened_at_device", "-id")
        .values_list("odometer_open_km", "odometer_close_km")
        .first()
    )
    if latest is None:
        return None
    opened_km, closed_km = latest
    return int(closed_km if closed_km is not None else opened_km)
