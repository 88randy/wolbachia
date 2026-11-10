"""Closed sample declarations; identities never imply source or assay authority."""

from typing import Any
from uuid import UUID

from rest_framework import serializers

from ovitraps.payloads import StrictPayloadSerializer


class SampleUUIDField(serializers.UUIDField):
    def to_internal_value(self, value: Any) -> UUID:  # noqa: ANN401 -- DRF field protocol
        if not isinstance(value, str | UUID):
            self.fail("invalid")
        return super().to_internal_value(value)


class SampleSourceSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["reading", "lot", "release"])
    id = SampleUUIDField()


class CollectSampleSerializer(StrictPayloadSerializer):
    sample_id = SampleUUIDField()
    code = serializers.CharField(max_length=50)
    origin_code = serializers.CharField(max_length=64)
    method_version = SampleUUIDField()
    source_ref = SampleSourceSerializer()
    other_text = serializers.CharField(
        max_length=1000, allow_blank=True, required=False, default=""
    )
    evidence_ids = serializers.ListField(
        child=SampleUUIDField(), max_length=20, required=False, default=list
    )


SampleCollectPayload = CollectSampleSerializer


class SampleCommandSerializer(StrictPayloadSerializer):
    command_id = SampleUUIDField()


class SampleResultSerializer(SampleCommandSerializer):
    status = serializers.ChoiceField(choices=["valid", "invalid", "disputed"])
    result = serializers.ChoiceField(choices=["positive", "negative"], allow_null=True)
    method_version = SampleUUIDField()
    repeat_of = SampleUUIDField(required=False, allow_null=True, default=None)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if (attrs["status"] == "valid") != (attrs["result"] is not None):
            raise serializers.ValidationError(
                {"result": "Only a valid attempt has a positive or negative result."},
                code="sample_result_status",
            )
        return attrs
