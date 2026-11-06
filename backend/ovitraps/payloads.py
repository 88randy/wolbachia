"""Strict schema-1 payloads: the courier never submits a numeric egg count."""

from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

MAX_REFERENCES = 100
NO_PADDLE_FINDINGS = frozenset(
    {"closed-house", "absent", "missing", "destroyed", "abandoned", "removed"}
)


class StrictPayloadSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, value: Any) -> dict[str, Any]:  # noqa: ANN401
        if isinstance(value, dict) and (unknown := value.keys() - self.fields.keys()):
            raise serializers.ValidationError(
                {
                    name: [ErrorDetail("Unknown field.", code="unknown_field")]
                    for name in sorted(unknown)
                }
            )
        return dict(super().to_internal_value(value))


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, value: Any) -> bool:  # noqa: ANN401
        if type(value) is not bool:
            self.fail("invalid")
        return bool(value)


class OpaqueUUIDField(serializers.CharField):
    def to_internal_value(self, value: Any) -> str:  # noqa: ANN401
        if not isinstance(value, str):
            self.fail("invalid")
        serializers.UUIDField().to_internal_value(value)
        return value


class PlacePayloadSerializer(StrictPayloadSerializer):
    sampling_point_id = serializers.UUIDField()
    ovitrap_id = serializers.UUIDField()
    supply_refs = serializers.ListField(child=OpaqueUUIDField(), max_length=MAX_REFERENCES)
    evidence_ids = serializers.ListField(child=OpaqueUUIDField(), max_length=MAX_REFERENCES)


class CheckPayloadSerializer(StrictPayloadSerializer):
    evidence_ids = serializers.ListField(
        child=OpaqueUUIDField(), max_length=MAX_REFERENCES, required=False, default=list
    )
    ovitrap_id = serializers.UUIDField()
    finding = serializers.CharField(max_length=64)
    paddle_present = StrictBooleanField()
    has_eggs = StrictBooleanField(allow_null=True)
    temperature_c = serializers.FloatField(allow_null=True)
    humidity_pct = serializers.FloatField(min_value=0, max_value=100, allow_null=True)
    paddle_type = serializers.CharField(max_length=64, allow_null=True)
    is_lagged = StrictBooleanField()
    bag_code = serializers.RegexField(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$", allow_null=True)
    other_text = serializers.CharField(
        max_length=1000, allow_blank=True, required=False, default=""
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["paddle_present"] != (attrs["has_eggs"] is not None):
            raise serializers.ValidationError(
                {"has_eggs": "Use boolean with paddle, null without."}, code="conditional_eggs"
            )
        if attrs["finding"] in NO_PADDLE_FINDINGS and attrs["paddle_present"]:
            raise serializers.ValidationError(
                {"paddle_present": "Finding implies no paddle."}, code="finding_without_paddle"
            )
        return attrs
