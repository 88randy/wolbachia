"""Historical safety gates. All review signals happen BEFORE any operational write."""

from copy import deepcopy
from dataclasses import dataclass
from math import isfinite
from typing import Any
from zoneinfo import ZoneInfo

from core.time import epi_week_label
from field_sync.exceptions import EventNeedsReview
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from geography.geometry import distance_m
from geography.models import PointVersion, SamplingPoint
from geography.selectors import point_version_at
from ovitraps import codes
from rules.seeds import DEFAULT_PARAMETER_SEEDS
from rules.selectors import list_parameters_with_current, to_number

REQUIRED_RULES = ("max_distance_to_point_m", "max_gps_accuracy_m", "speed_lock_kmh")
SECONDS_PER_HOUR = 3600
METERS_PER_KILOMETER = 1000


@dataclass(frozen=True)
class Capture:
    point_version: PointVersion
    rules: dict[str, int | float | None]
    version_ids: dict[str, str]


def _usable_rules(values: dict[str, int | float | None]) -> None:
    seeds = {seed.key: seed for seed in DEFAULT_PARAMETER_SEEDS}
    for key in REQUIRED_RULES:
        value = values.get(key)
        definition = seeds[key]
        if (
            value is None
            or not isfinite(value)
            or value < definition.min_value
            or (definition.max_value is not None and value > definition.max_value)
        ):
            raise EventNeedsReview(codes.RULES_UNAVAILABLE)


def capture_context(ctx: EventContext, point: SamplingPoint) -> Capture:
    """Resolve R03 rules and point at device_time; absent GPS/rules cannot pass."""
    version, values, identifiers, previous = observed_capture_inputs(ctx, point)
    from geography.decisions.capture import capture_epoch

    capture_epoch(ctx, point)
    _usable_rules(values)
    if version is None or version.is_retired:
        raise EventNeedsReview(codes.POINT_UNAVAILABLE)
    _check_gps(ctx, version, values)
    _check_speed(ctx, values, previous)
    if ctx.review_code is not None and not ctx.acknowledges(ctx.review_code):
        raise EventNeedsReview(ctx.review_code)
    return Capture(version, values, identifiers)


def rule_snapshot(ctx: EventContext) -> tuple[dict[str, int | float | None], dict[str, str]]:
    """One SQL snapshot supplies BOTH consumed values and their actual immutable IDs."""
    rows = list(
        list_parameters_with_current(ctx.organization, ctx.envelope.device_time).values(  # type: ignore[misc]
            "key", "value_type", "current_value", "current_version_id"
        )
    )
    values = {
        row["key"]: None
        if row["current_value"] is None
        else to_number(row["value_type"], row["current_value"])
        for row in rows
    }
    identifiers = {
        row["key"]: str(row["current_version_id"])
        for row in rows
        if row["current_version_id"] is not None
    }
    return values, identifiers


def observed_capture_inputs(
    ctx: EventContext, point: SamplingPoint
) -> tuple[PointVersion | None, dict[str, int | float | None], dict[str, str], FieldEvent | None]:
    """Copy the exact selected inputs before any gate; no domain/rollback row is a proof."""
    values, identifiers = rule_snapshot(ctx)
    version = point_version_at(point, ctx.envelope.device_time)
    previous = _speed_reference(ctx)
    facts = {
        "version": 1,
        "available": version is not None,
        "point_id": str(point.pk),
        "point_version_id": None if version is None else str(version.pk),
        "rules": values,
        "rule_version_ids": identifiers,
        "speed_reference": None
        if previous is None
        else {
            "id": str(previous.pk),
            "payload_sha256": previous.payload_sha256,
            "device_time": previous.device_time.isoformat(),
            "gps_lat": previous.gps_lat,
            "gps_lng": previous.gps_lng,
            "gps_accuracy_m": previous.gps_accuracy_m,
        },
    }
    if ctx.review_authorization is not None:
        from reviews.exceptions import ReviewBlockedError

        original = ctx.review_authorization.owner_facts.get("ovitrap", {})
        if original.get("version") != 1 or not original.get("available"):
            raise ReviewBlockedError(("capture_context_unavailable",))
        comparison = dict(facts)
        if original.get("speed_reference") != facts[
            "speed_reference"
        ] and _resolved_speed_reference(ctx, previous):
            comparison["speed_reference"] = original.get("speed_reference")
        if original != comparison:
            raise ReviewBlockedError(("capture_context_changed",))
        # Equal current proof verifies applicability; original values remain the inputs.
        values = dict(original["rules"])
        identifiers = dict(original["rule_version_ids"])
    ctx.observed_facts["ovitrap"] = deepcopy(facts)
    return version, values, identifiers, previous


def _resolved_speed_reference(ctx: EventContext, previous: FieldEvent | None) -> bool:
    from reviews.effect_receipts import is_effective
    from reviews.models import ReviewDependencyResolution

    authorization = ctx.review_authorization
    if (
        authorization is None
        or authorization.pending_code != "causal_parent_pending"
        or previous is None
        or previous.created_by_id != ctx.user.pk
        or not is_effective(previous)
    ):
        return False
    resolution = ReviewDependencyResolution.objects.filter(
        organization=ctx.organization,
        dependency__source_event_id=authorization.source_id,
        dependency__kind="ovitrap",
        parent_source=previous,
    ).first()
    if resolution is None:
        return False
    ctx.observed_facts["resolved_speed_reference"] = {
        "source_event_id": str(previous.pk),
        "payload_sha256": previous.payload_sha256,
        "resolution_id": str(resolution.pk),
    }
    return True


def _check_gps(ctx: EventContext, point: PointVersion, rules: dict[str, Any]) -> None:
    gps = ctx.envelope.gps
    if gps is None or gps.accuracy_m is None or not isfinite(gps.accuracy_m) or gps.accuracy_m <= 0:
        raise EventNeedsReview(codes.GPS_UNUSABLE)
    if gps.accuracy_m > rules["max_gps_accuracy_m"]:
        raise EventNeedsReview(codes.GPS_UNUSABLE)
    if distance_m([gps.lng, gps.lat], point.location) > rules[
        "max_distance_to_point_m"
    ] and not ctx.acknowledges(codes.TOO_FAR):
        raise EventNeedsReview(codes.TOO_FAR)


def _speed_reference(ctx: EventContext) -> FieldEvent | None:
    from reviews.effect_receipts import effective_effects

    return (
        effective_effects(
            FieldEvent.objects.filter(
                organization=ctx.organization,
                created_by=ctx.user,
                type__in=(
                    "ovitrap.place",
                    "ovitrap.check",
                    "ovitrap.replace",
                    "ovitrap.relocate",
                    "ovitrap.remove",
                ),
                voided_at__isnull=True,
                device_time__lte=ctx.envelope.device_time,
                gps_lat__isnull=False,
                gps_lng__isnull=False,
                gps_accuracy_m__gt=0,
            )
        )
        .exclude(pk=ctx.envelope.id)
        .order_by("-device_time", "id")
        .first()
    )


def _check_speed(ctx: EventContext, rules: dict[str, Any], previous: FieldEvent | None) -> None:
    gps = ctx.envelope.gps
    if previous is None or gps is None:
        return
    if previous.gps_lng is None or previous.gps_lat is None:
        return
    meters = distance_m([previous.gps_lng, previous.gps_lat], [gps.lng, gps.lat])
    elapsed = (ctx.envelope.device_time - previous.device_time).total_seconds()
    speed = (
        meters / elapsed * SECONDS_PER_HOUR / METERS_PER_KILOMETER
        if elapsed > 0
        else (float("inf") if meters else 0)
    )
    if speed > rules["speed_lock_kmh"] and not ctx.acknowledges(codes.SPEED_ANOMALY):
        raise EventNeedsReview(codes.SPEED_ANOMALY)


def epi_week(ctx: EventContext) -> str:
    """Organization-local label shared with scheduling; preserve the capture-time contract."""
    captured = ctx.envelope.device_time.astimezone(ZoneInfo(ctx.organization.timezone)).date()
    return epi_week_label(captured, ctx.organization.epi_week)
