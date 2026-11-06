"""Historical safety gates. All review signals happen BEFORE any operational write."""

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
from rules.selectors import list_parameters_with_current

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
    values = ctx.rules_at(ctx.envelope.device_time)
    _usable_rules(values)
    version = point_version_at(point, ctx.envelope.device_time)
    if version is None or version.is_retired:
        raise EventNeedsReview(codes.POINT_UNAVAILABLE)
    _check_gps(ctx, version, values)
    _check_speed(ctx, values)
    if ctx.review_code is not None:
        raise EventNeedsReview(ctx.review_code)
    rows = list_parameters_with_current(ctx.organization, ctx.envelope.device_time).values(  # type: ignore[misc]
        "key", "current_version_id"
    )
    identifiers = {
        row["key"]: str(row["current_version_id"])
        for row in rows
        if row["current_version_id"] is not None
    }
    return Capture(version, values, identifiers)


def _check_gps(ctx: EventContext, point: PointVersion, rules: dict[str, Any]) -> None:
    gps = ctx.envelope.gps
    if gps is None or gps.accuracy_m is None or not isfinite(gps.accuracy_m) or gps.accuracy_m <= 0:
        raise EventNeedsReview(codes.GPS_UNUSABLE)
    if gps.accuracy_m > rules["max_gps_accuracy_m"]:
        raise EventNeedsReview(codes.GPS_UNUSABLE)
    if distance_m([gps.lng, gps.lat], point.location) > rules["max_distance_to_point_m"]:
        raise EventNeedsReview(codes.TOO_FAR)


def _check_speed(ctx: EventContext, rules: dict[str, Any]) -> None:
    previous = (
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
            status="accepted",
            voided_at__isnull=True,
            device_time__lte=ctx.envelope.device_time,
            gps_lat__isnull=False,
            gps_lng__isnull=False,
            gps_accuracy_m__gt=0,
        )
        .exclude(pk=ctx.envelope.id)
        .order_by("-device_time", "id")
        .first()
    )
    gps = ctx.envelope.gps
    if previous is None or gps is None:
        return
    meters = distance_m([previous.gps_lng, previous.gps_lat], [gps.lng, gps.lat])
    elapsed = (ctx.envelope.device_time - previous.device_time).total_seconds()
    speed = (
        meters / elapsed * SECONDS_PER_HOUR / METERS_PER_KILOMETER
        if elapsed > 0
        else (float("inf") if meters else 0)
    )
    if speed > rules["speed_lock_kmh"]:
        raise EventNeedsReview(codes.SPEED_ANOMALY)


def epi_week(ctx: EventContext) -> str:
    """Organization-local label shared with scheduling; preserve the capture-time contract."""
    captured = ctx.envelope.device_time.astimezone(ZoneInfo(ctx.organization.timezone)).date()
    return epi_week_label(captured, ctx.organization.epi_week)
