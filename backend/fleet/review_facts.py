"""Original fuel comparison facts survive rollback; later context changes fail closed."""

from dataclasses import replace
from decimal import Decimal
from typing import Any

from field_sync.registry import EventContext
from fleet.models import FuelLoad
from reviews.effect_receipts import effective_effects
from reviews.exceptions import ReviewBlockedError
from shifts.models import Motorcycle
from shifts.selectors import highest_recorded_km


def _row_fact(row: FuelLoad | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row.pk),
        "event_id": str(row.event_id),
        "payload_sha256": row.event.payload_sha256,
        "device_time": row.event.device_time.isoformat(),
        "odometer_km": row.odometer_km,
        "litres": str(row.litres),
        "is_full_refill": row.is_full_refill,
    }


def _neighbors(ctx: EventContext, motorcycle: Motorcycle) -> dict[str, Any]:
    history = effective_effects(
        FuelLoad.objects.filter(organization=ctx.organization, motorcycle=motorcycle).exclude(
            event_id=ctx.envelope.id
        ),
        "event",
    ).select_related("event")
    previous = history.filter(event__device_time__lt=ctx.envelope.device_time).first()
    following = (
        history.filter(event__device_time__gte=ctx.envelope.device_time)
        .order_by("event__device_time", "id")
        .first()
    )
    return {"previous": _row_fact(previous), "following": _row_fact(following)}


def original_comparison(
    ctx: EventContext, motorcycle: Motorcycle, values: dict[str, Any]
) -> dict[str, Any]:
    from fleet.fuel_services import _comparable_baseline, _thresholds

    thresholds = _thresholds(ctx)
    baseline = _comparable_baseline(ctx, motorcycle, values)
    return calculation_facts(
        ctx, motorcycle, (baseline, thresholds, highest_recorded_km(motorcycle))
    )


def calculation_facts(
    ctx: EventContext,
    motorcycle: Motorcycle,
    selected: tuple[FuelLoad | None, dict[str, Any], int | None],
) -> dict[str, Any]:
    """Use the exact baseline/versions/maximum selected by the real calculation."""
    baseline, thresholds, maximum = selected
    return {
        "fuel": {
            "version": 1,
            "available": True,
            "motorcycle_id": str(motorcycle.pk),
            "shift_id": None if ctx.envelope.shift_id is None else str(ctx.envelope.shift_id),
            "baseline": _row_fact(baseline),
            "neighbors": _neighbors(ctx, motorcycle),
            "highest_recorded_km": maximum,
            "thresholds": {
                "threshold_min": _decimal_text(thresholds["threshold_min"]),
                "threshold_max": _decimal_text(thresholds["threshold_max"]),
                "rule_provenance": thresholds["rule_provenance"],
            },
        },
    }


def _decimal_text(value: Decimal | None) -> str | None:
    return None if value is None else str(value)


def frozen_comparison(ctx: EventContext) -> dict[str, Any]:
    authorization = ctx.review_authorization
    facts = {} if authorization is None else authorization.owner_facts.get("fuel", {})
    if facts.get("version") != 1 or not facts.get("available"):
        raise ReviewBlockedError(("fuel_original_context_unavailable",))
    return dict(facts)


def validate_original_comparison(
    ctx: EventContext, motorcycle: Motorcycle, values: dict[str, Any]
) -> None:
    original = frozen_comparison(ctx)
    current = original_comparison(replace(ctx, review_authorization=None), motorcycle, values)[
        "fuel"
    ]
    # Safety maxima are checked afresh by the real writer, while never forgetting
    # the independently observed original maximum. They do not change adjacency.
    original.pop("highest_recorded_km", None)
    current.pop("highest_recorded_km", None)
    if original != current:
        raise ReviewBlockedError(("fuel_context_changed",))


def frozen_thresholds(ctx: EventContext) -> dict[str, Any]:
    frozen = frozen_comparison(ctx)["thresholds"]
    return {
        "threshold_min": None
        if frozen["threshold_min"] is None
        else Decimal(frozen["threshold_min"]),
        "threshold_max": None
        if frozen["threshold_max"] is None
        else Decimal(frozen["threshold_max"]),
        "rule_provenance": frozen["rule_provenance"],
    }


def frozen_baseline(ctx: EventContext) -> FuelLoad | None:
    baseline = frozen_comparison(ctx)["baseline"]
    if baseline is None:
        return None
    row = (
        FuelLoad.objects.filter(organization=ctx.organization, pk=baseline["id"])
        .select_related("event")
        .first()
    )
    if row is None or _row_fact(row) != baseline:
        raise ReviewBlockedError(("fuel_context_changed",))
    return row
