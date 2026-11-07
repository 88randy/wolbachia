"""Closed, nonidentifying aggregate capture inputs shared by both transports."""

from typing import Any

from rest_framework import serializers

from core.void_reason import validate_void_reason
from ovitraps.payloads import StrictPayloadSerializer

MAX_ATTENDANCE = 2**53 - 1  # JSON interoperable integer bound, not a population rule.


class AttendanceField(serializers.IntegerField):
    def to_internal_value(self, value: Any) -> int:  # noqa: ANN401 -- strict wire boundary
        if type(value) is not int:
            self.fail("invalid")
        return int(super().to_internal_value(value))


class AggregateTextField(serializers.CharField):
    def to_internal_value(self, value: Any) -> str:  # noqa: ANN401 -- strict wire boundary
        if not isinstance(value, str):
            self.fail("invalid")
        return validate_void_reason(super().to_internal_value(value), enforce_minimum=False)


class CommunityActivityPayload(StrictPayloadSerializer):
    type_id = serializers.UUIDField()
    zone_id = serializers.UUIDField()
    attendance = AttendanceField(min_value=0, max_value=MAX_ATTENDANCE)
    agreements = AggregateTextField(max_length=1000, allow_blank=True, trim_whitespace=False)
    other_text = AggregateTextField(
        max_length=1000, allow_blank=True, required=False, default="", trim_whitespace=False
    )
    incident_id = serializers.UUIDField(required=False, allow_null=True, default=None)
