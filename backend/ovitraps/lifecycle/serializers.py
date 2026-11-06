"""Strict lifecycle event payloads and scoped read projections."""

from typing import Any

from rest_framework import serializers

from geography.geometry import validate_location
from ovitraps.lifecycle.models import RelocationProposal
from ovitraps.payloads import (
    MAX_REFERENCES,
    OpaqueUUIDField,
    StrictBooleanField,
    StrictPayloadSerializer,
)
from ovitraps.serializers import PROVENANCE_FIELDS, ProvenanceSerializer


class PhysicalUUIDField(serializers.UUIDField):
    def to_internal_value(self, value: Any) -> Any:  # noqa: ANN401
        if not isinstance(value, str):
            self.fail("invalid")
        return super().to_internal_value(value)


class LifecyclePayloadSerializer(StrictPayloadSerializer):
    ovitrap_id = PhysicalUUIDField()
    reason_code = serializers.CharField(max_length=64)
    other_text = serializers.CharField(
        max_length=1000, allow_blank=True, required=False, default=""
    )
    evidence_ids = serializers.ListField(child=OpaqueUUIDField(), max_length=MAX_REFERENCES)


class ReplacePayloadSerializer(LifecyclePayloadSerializer):
    replacement_id = PhysicalUUIDField()


class RelocatePayloadSerializer(LifecyclePayloadSerializer):
    proposed_location = serializers.ListField()

    def validate_proposed_location(self, value: list[Any]) -> list[float]:
        try:
            return validate_location(value)
        except ValueError:
            raise serializers.ValidationError(
                "Use finite WGS84 [longitude, latitude].", code="invalid_location"
            ) from None


class RemovePayloadSerializer(LifecyclePayloadSerializer):
    is_recovered = StrictBooleanField()


PAYLOAD_SERIALIZERS = {
    "replace": ReplacePayloadSerializer,
    "relocate": RelocatePayloadSerializer,
    "remove": RemovePayloadSerializer,
}


class RelocationSerializer(ProvenanceSerializer):
    code = serializers.UUIDField(source="id", read_only=True)
    ovitrap = serializers.UUIDField(source="ovitrap.client_uuid", read_only=True)
    point = serializers.UUIDField(source="ovitrap.sampling_point_id", read_only=True)
    point_code = serializers.CharField(source="ovitrap.sampling_point.code", read_only=True)
    status = serializers.CharField(source="decision_status", read_only=True)  # type: ignore[assignment]

    class Meta:
        model = RelocationProposal
        fields = (
            "id",
            "code",
            "ovitrap",
            "point",
            "point_code",
            "point_version",
            "old_location",
            "new_location",
            "reason_code",
            "reason_label",
            "other_text",
            "evidence_ids",
            "evaluated_rules",
            "rule_version_ids",
            *PROVENANCE_FIELDS,
        )
        read_only_fields = fields


class RelocationQuerySerializer(serializers.Serializer[Any]):
    include_voided = serializers.BooleanField(required=False, default=False)
    code = serializers.UUIDField(required=False)
    status = serializers.ChoiceField(choices=["pending", "approved", "rejected"], required=False)
    point = serializers.UUIDField(required=False)
    ovitrap = serializers.UUIDField(required=False)


class HistoryEntrySerializer(serializers.Serializer[Any]):
    event_id = serializers.UUIDField()
    type = serializers.CharField()
    device_time = serializers.DateTimeField()
    server_received_at = serializers.DateTimeField()
    point_code = serializers.CharField()
    author = serializers.UUIDField(allow_null=True)
    voided_at = serializers.DateTimeField(allow_null=True)
    void_reason = serializers.CharField(allow_blank=True)
    void_reason_code = serializers.CharField(allow_blank=True)
    void_event_id = serializers.UUIDField(allow_null=True)
    ingest_status = serializers.CharField()
    rules_version = serializers.CharField()
    catalog_version = serializers.CharField()
    gps = serializers.JSONField(allow_null=True)
    payload = serializers.JSONField()
    effects = serializers.JSONField()


class OvitrapHistorySerializer(serializers.Serializer[Any]):
    ovitrap = serializers.UUIDField()
    point_code = serializers.CharField()
    suggest_relocation = serializers.BooleanField()
    entries = HistoryEntrySerializer(many=True)
