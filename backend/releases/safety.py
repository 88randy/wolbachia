"""Nonoverridable safety gates shared by ingest and source-bound review."""

from dataclasses import dataclass
from datetime import datetime
from math import isfinite
from typing import Any, Never

from field_sync.envelope import GpsFix
from field_sync.exceptions import EventRejected
from geography.geometry import contains_point


@dataclass(frozen=True)
class PermitSafety:
    valid_from: datetime
    valid_to: datetime
    geometry: dict[str, Any]
    requirements: dict[str, Any]


def reject(code: str, reason: str = "") -> Never:
    raise EventRejected(code, {"severity": "critical", **({"reason": reason} if reason else {})})


def validate_permit_safety(permit: PermitSafety, at: datetime, gps: GpsFix | None) -> None:
    """The official polygon and its pinned requirements must both hold at each clock."""
    if not permit.valid_from <= at < permit.valid_to:
        reject("release_permit_expired")
    accuracy = permit.requirements.get("max_gps_accuracy_m")
    if (
        isinstance(accuracy, bool)
        or not isinstance(accuracy, int | float)
        or not isfinite(accuracy)
        or accuracy <= 0
    ):
        reject("release_configuration_unavailable")
    if (
        gps is None
        or gps.accuracy_m is None
        or not isfinite(gps.accuracy_m)
        or not 0 < gps.accuracy_m <= accuracy
    ):
        reject("release_gps_unusable")
    if not contains_point(permit.geometry, [gps.lng, gps.lat]):
        reject("release_zone_invalid")
