"""Response shapes of `GET /shifts/positions/` and `GET /shifts/{id}/track/` (read-only)."""

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from shifts.models import ShiftStatus


@extend_schema_field(
    {
        "type": "array",
        "items": {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 4,
            "maxItems": 4,
            "description": "[offset_s, lat, lng, accuracy_m]",
        },
    }
)
class PositionsField(serializers.JSONField):
    """`[[offset_s, lat, lng, accuracy_m], ...]`, offsets from the segment start."""


class LastPositionSerializer(serializers.Serializer[Any]):
    """The last stored position of an open shift. `recorded_at` is the phone's clock."""

    shift_id = serializers.UUIDField()
    shift_code = serializers.CharField()
    courier = serializers.UUIDField()
    motorcycle_code = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    accuracy_m = serializers.IntegerField()
    recorded_at = serializers.DateTimeField()
    received_at = serializers.DateTimeField()


class TrackSegmentReadSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    started_at = serializers.DateTimeField(source="started_at_device")
    ended_at = serializers.DateTimeField(source="ended_at_device")
    received_at = serializers.DateTimeField(source="field_event.server_received_at")
    positions = PositionsField()


class ShiftTrackSerializer(serializers.Serializer[Any]):
    shift_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=ShiftStatus.choices)
    segments = TrackSegmentReadSerializer(many=True)
    pending_review_count = serializers.IntegerField()
