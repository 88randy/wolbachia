"""Payload of `track.segment` schema 1 (docs/sync.md "Courier track")."""

import math
from typing import Any

from rest_framework import serializers

from tracks.codes import COORDINATE_DECIMALS, MAX_ACCURACY_M, MAX_POSITIONS, MAX_SPAN_SECONDS

POSITION_LENGTH = 4


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_coordinate(value: object, limit: int) -> bool:
    if not isinstance(value, int | float) or isinstance(value, bool):
        return False
    number = float(value)
    return (
        math.isfinite(number)
        and -limit <= number <= limit
        and round(number, COORDINATE_DECIMALS) == number
    )


def _is_position(item: object) -> bool:
    if not isinstance(item, list) or len(item) != POSITION_LENGTH:
        return False
    offset, lat, lng, accuracy = item
    return (
        _is_int(offset)
        and 0 <= offset <= MAX_SPAN_SECONDS
        and _is_coordinate(lat, 90)
        and _is_coordinate(lng, 180)
        and _is_int(accuracy)
        and 0 <= accuracy <= MAX_ACCURACY_M
    )


class TrackSegmentPayloadSerializer(serializers.Serializer[Any]):
    """`{started_at, positions: [[offset_s, lat, lng, accuracy_m], ...]}`: 1..250 positions,
    integer offsets from `started_at`, non-decreasing, at most one day; WGS84 degrees with at most
    6 decimals; integer accuracy 0..5000 m. Any failure is `invalid_payload`."""

    started_at = serializers.DateTimeField()
    positions = serializers.ListField(
        child=serializers.JSONField(), min_length=1, max_length=MAX_POSITIONS
    )

    def validate_positions(self, positions: list[Any]) -> list[list[Any]]:
        if not all(_is_position(item) for item in positions):
            raise serializers.ValidationError("Invalid position.", code="invalid_position")
        offsets = [item[0] for item in positions]
        if offsets != sorted(offsets):
            raise serializers.ValidationError("Offsets must not decrease.", code="not_ordered")
        return positions
