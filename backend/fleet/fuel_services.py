"""fuel.load: immutable capture with review-only advisories and explicit provisional history."""

from decimal import Decimal
from typing import Any, cast

from django.http import Http404

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext
from fleet.codes import FUEL_EFFICIENCY_REVIEW, FUEL_MOTORCYCLE_MISMATCH
from fleet.models import EfficiencyStatus, FuelLoad
from rules.selectors import list_parameters_with_current
from shifts.access import authorize_motorcycle, lock_motorcycle
from shifts.codes import MOTORCYCLE_UNKNOWN, ODOMETER_DECREASED, SHIFT_NOT_OPEN
from shifts.models import Motorcycle, Shift
from shifts.permissions import MOTORCYCLE_MANAGE
from shifts.selectors import highest_recorded_km

MIN_KEY = "fuel_efficiency_min_km_l"
MAX_KEY = "fuel_efficiency_max_km_l"


def apply_fuel_load(ctx: EventContext, values: dict[str, Any]) -> None:
    """Called in sync's savepoint, after account/courier locks; never prevents shift closure."""
    motorcycle = Motorcycle.objects.filter(
        organization=ctx.organization, code=values["motorcycle_id"], voided_at__isnull=True
    ).first()
    if motorcycle is None:
        raise EventRejected(MOTORCYCLE_UNKNOWN)
    with lock_motorcycle(motorcycle) as locked:
        _authorize_capture(ctx, locked)
        if ctx.envelope.shift_id is None:
            raise EventRejected(SHIFT_NOT_OPEN)
        shift = Shift.objects.filter(
            pk=ctx.envelope.shift_id, organization=ctx.organization, courier=ctx.user, status="open"
        ).first()
        if shift is None:
            raise EventRejected(SHIFT_NOT_OPEN)
        if shift.motorcycle_id != locked.pk:
            raise EventRejected(FUEL_MOTORCYCLE_MISMATCH)
        review_signal = _insert_fuel(ctx, shift, values)
    # Leave the lock's nested savepoint normally so sync can keep provisional evidence.
    if review_signal is not None:
        raise review_signal


def _authorize_capture(ctx: EventContext, motorcycle: Motorcycle) -> None:
    try:
        authorize_motorcycle(motorcycle, ctx.user, MOTORCYCLE_MANAGE)
    except Http404:
        raise EventRejected(MOTORCYCLE_UNKNOWN) from None


def _thresholds(ctx: EventContext) -> dict[str, Any]:
    values = ctx.rules_at(ctx.envelope.device_time)
    versions = list_parameters_with_current(ctx.organization, ctx.envelope.device_time).filter(
        key__in=[MIN_KEY, MAX_KEY]
    )
    version_fields = ("key", "current_version_id", "current_effective_from")
    provenance = {
        row["key"]: {
            "version_id": None
            if row["current_version_id"] is None
            else str(row["current_version_id"]),
            "value": values.get(row["key"]),
            "effective_from": None
            if row["current_effective_from"] is None
            else row["current_effective_from"].isoformat(),
        }
        for row in versions.values(*version_fields)
    }
    return {
        "threshold_min": None if values.get(MIN_KEY) is None else Decimal(str(values[MIN_KEY])),
        "threshold_max": None if values.get(MAX_KEY) is None else Decimal(str(values[MAX_KEY])),
        "rule_provenance": provenance,
    }


def _comparable_baseline(
    ctx: EventContext, motorcycle: Motorcycle, values: dict[str, Any]
) -> FuelLoad | None:
    history = FuelLoad.objects.filter(
        organization=ctx.organization,
        motorcycle=motorcycle,
        provisional=False,
        event__voided_at__isnull=True,
    )
    # Late uploads cannot rewrite an already measured interval. Equal timestamps are unknown.
    if (
        not values["is_full_refill"]
        or history.filter(event__device_time__gte=ctx.envelope.device_time).exists()
    ):
        return None
    previous = history.filter(event__device_time__lt=ctx.envelope.device_time).first()
    if previous is None or not previous.is_full_refill:
        return None
    return cast(FuelLoad, previous)


def _insert_fuel(
    ctx: EventContext, shift: Shift, values: dict[str, Any]
) -> EventNeedsReview | None:
    thresholds = _thresholds(ctx)
    baseline = _comparable_baseline(ctx, shift.motorcycle, values)
    previous_km = highest_recorded_km(shift.motorcycle)
    decreased = previous_km is not None and values["odometer_km"] < previous_km
    efficiency = (
        None
        if baseline is None or decreased
        else Decimal(values["odometer_km"] - baseline.odometer_km) / values["litres"]
    )
    minimum, maximum = thresholds["threshold_min"], thresholds["threshold_max"]
    outside = efficiency is not None and (
        (minimum is not None and efficiency < minimum)
        or (maximum is not None and efficiency > maximum)
    )
    state = (
        EfficiencyStatus.UNAVAILABLE
        if efficiency is None
        else (EfficiencyStatus.REVIEW if outside else EfficiencyStatus.OK)
    )
    FuelLoad.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event_id=ctx.envelope.id,
        shift=shift,
        motorcycle=shift.motorcycle,
        **{key: value for key, value in values.items() if key != "motorcycle_id"},
        receipt_pending=values["receipt_upload_id"] is None,
        efficiency_km_l=efficiency,
        efficiency_status=state,
        baseline=baseline,
        provisional=bool(ctx.review_code or decreased or outside),
        **thresholds,
    )
    params = {
        **thresholds,
        "threshold_min": None if minimum is None else str(minimum),
        "threshold_max": None if maximum is None else str(maximum),
        "baseline_id": None if baseline is None else str(baseline.pk),
        "efficiency_km_l": None if efficiency is None else str(efficiency),
    }
    if decreased:
        return EventNeedsReview(
            ODOMETER_DECREASED,
            {**params, "previous_km": previous_km, "odometer_km": values["odometer_km"]},
        )
    if outside:
        return EventNeedsReview(FUEL_EFFICIENCY_REVIEW, params)
    return None
