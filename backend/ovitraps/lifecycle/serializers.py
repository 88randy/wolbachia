"""Strict lifecycle event payloads and scoped read projections."""

import re
from datetime import UTC, datetime
from typing import Any

from rest_framework import serializers

from core.author_names import AuthorNamesMixin
from core.serializers import OrgScopedModelSerializer
from core.void_reason import VOID_REASON_MAX_LENGTH, validate_void_reason
from field_sync.serializers import SafeDateTimeField, validate_plausible_time
from geography.geometry import validate_location
from ovitraps.lifecycle.models import RelocationProposal, RemovalResolution
from ovitraps.payloads import (
    MAX_REFERENCES,
    OpaqueUUIDField,
    StrictBooleanField,
    StrictPayloadSerializer,
)
from ovitraps.serializers import PROVENANCE_FIELDS, ProvenanceSerializer

MAX_ADVISORY_WEEKS = 8  # Existing OP03 upper bound; this response is not reading history.
RFC3339_CUTOFF = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", re.IGNORECASE
)


class AdvisoryCutoffField(SafeDateTimeField):
    def to_internal_value(self, value: Any) -> datetime:  # noqa: ANN401
        if not isinstance(value, str) or RFC3339_CUTOFF.fullmatch(value) is None:
            self.fail("invalid", format="RFC3339 with an explicit offset")
        return super().to_internal_value(value.upper())


class OvitrapAdvisoryQuerySerializer(serializers.Serializer[Any]):
    at = AdvisoryCutoffField(default_timezone=UTC, validators=[validate_plausible_time])


class AdvisoryRuleVersionSerializer(serializers.Serializer[Any]):
    version_id = serializers.UUIDField()
    value = serializers.IntegerField()
    effective_from = serializers.DateTimeField()


class AdvisoryParametersSerializer(serializers.Serializer[Any]):
    closed_house_weeks_to_relocate = AdvisoryRuleVersionSerializer()
    incidents_to_relocate = AdvisoryRuleVersionSerializer()


class AdvisoryRuleContextSerializer(serializers.Serializer[Any]):
    timezone = serializers.CharField()
    epi_week = serializers.ChoiceField(choices=["iso", "mmwr"])
    parameters = AdvisoryParametersSerializer()


class OvitrapAdvisorySerializer(serializers.Serializer[Any]):
    schema_version = serializers.IntegerField(min_value=1, max_value=1)
    version = serializers.CharField()
    physical_ovitrap_id = serializers.UUIDField()
    point_id = serializers.UUIDField()
    as_of = serializers.DateTimeField()
    state = serializers.ChoiceField(choices=["available", "unavailable"])
    unavailable_reason = serializers.ChoiceField(
        choices=["rule_context_unavailable", "organization_context_unavailable", "future_cutoff"],
        allow_null=True,
    )
    rule_context = AdvisoryRuleContextSerializer(allow_null=True)
    rule_context_version = serializers.CharField(allow_null=True)
    required_epi_weeks = serializers.ListField(
        child=serializers.CharField(), max_length=MAX_ADVISORY_WEEKS, allow_null=True
    )
    observed_closed_house_weeks = serializers.ListField(
        child=serializers.CharField(), max_length=MAX_ADVISORY_WEEKS, allow_null=True
    )
    incident_count = serializers.IntegerField(min_value=0, allow_null=True)
    suggested = serializers.BooleanField(allow_null=True)


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
    ovitrap_code = serializers.CharField(source="ovitrap.code", read_only=True)
    status = serializers.CharField(source="decision_status", read_only=True)  # type: ignore[assignment]

    class Meta:
        model = RelocationProposal
        fields = (
            "id",
            "code",
            "ovitrap",
            "point",
            "point_code",
            "ovitrap_code",
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


class HistoryEntrySerializer(AuthorNamesMixin, serializers.Serializer[Any]):
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


class RemovalResolutionRequestSerializer(StrictPayloadSerializer):
    expected_state = serializers.ChoiceField(
        choices=["unrecovered", "recovered", "resolved", "voided"]
    )
    outcome = serializers.ChoiceField(choices=["recovered_later", "written_off"])
    reason = serializers.CharField(max_length=VOID_REASON_MAX_LENGTH)

    def validate_reason(self, value: str) -> str:
        return validate_void_reason(value)


class RemovalResolutionSerializer(OrgScopedModelSerializer):
    class Meta:
        model = RemovalResolution
        fields = ("id", "removal", "outcome", "reason", "created_by", "created_at")
        read_only_fields = fields
