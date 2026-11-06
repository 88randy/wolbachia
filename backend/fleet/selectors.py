"""Historical fleet reads; provisional fuel never contributes to operational metrics."""

from datetime import timedelta
from typing import Any

from django.db.models import Max

from fleet.models import EfficiencyStatus, FuelLoad, InspectionClearance, ServiceRecord
from reviews.effect_receipts import effective_effects
from shifts.models import Motorcycle, MotorcycleBlockEvent


def active_blocks(motorcycle: Motorcycle) -> list[MotorcycleBlockEvent]:
    """Replay named inspection clearances and legacy per-reason unblock transitions."""
    named = dict(
        InspectionClearance.objects.filter(
            organization_id=motorcycle.organization_id, fault__motorcycle=motorcycle
        ).values_list("unblock_event_id", "fault_id")
    )
    opened: dict[object, MotorcycleBlockEvent] = {}
    for audit in MotorcycleBlockEvent.objects.filter(
        organization_id=motorcycle.organization_id, motorcycle=motorcycle
    ).order_by("created_at", "id"):
        if audit.action == "block":
            opened[audit.pk] = audit
        elif audit.pk in named:
            opened.pop(named[audit.pk], None)
        else:
            opened = {
                key: fault
                for key, fault in opened.items()
                if fault.blocked_reason != audit.blocked_reason
            }
    return list(opened.values())


def highest_fleet_km(motorcycle: Motorcycle) -> int | None:
    fuel = effective_effects(
        FuelLoad.objects.filter(
            organization_id=motorcycle.organization_id,
            motorcycle=motorcycle,
            event__voided_at__isnull=True,
        ),
        "event",
    ).aggregate(km=Max("odometer_km"))["km"]
    service = ServiceRecord.objects.filter(
        organization_id=motorcycle.organization_id, motorcycle=motorcycle, voided_at__isnull=True
    ).aggregate(km=Max("odometer_km"))["km"]
    readings = [value for value in (fuel, service) if value is not None]
    return max(readings) if readings else None


def motorcycle_metrics(motorcycle: Motorcycle) -> dict[str, Any]:
    from shifts.selectors import highest_recorded_km

    service = (
        None
        if motorcycle._state.adding
        else ServiceRecord.objects.filter(
            organization_id=motorcycle.organization_id,
            motorcycle=motorcycle,
            voided_at__isnull=True,
        ).first()
    )
    fuel = (
        None
        if motorcycle._state.adding
        else effective_effects(
            FuelLoad.objects.filter(
                organization_id=motorcycle.organization_id,
                motorcycle=motorcycle,
                event__voided_at__isnull=True,
            ),
            "event",
        ).first()
    )
    interval_km = None if service is None else service.service_interval_km
    interval_days = None if service is None else service.service_interval_days
    return {
        "last_service": None if service is None else service.pk,
        "next_service_due_km": None
        if service is None or interval_km is None
        else service.odometer_km + interval_km,
        "next_service_due_date": None
        if service is None or interval_days is None
        else service.performed_at + timedelta(days=interval_days),
        "latest_odometer": None if motorcycle._state.adding else highest_recorded_km(motorcycle),
        "latest_efficiency": None if fuel is None else fuel.efficiency_km_l,
        "efficiency_status": EfficiencyStatus.UNAVAILABLE
        if fuel is None
        else fuel.efficiency_status,
        "due_metric_provenance": {} if service is None else service.due_metric_provenance,
    }
