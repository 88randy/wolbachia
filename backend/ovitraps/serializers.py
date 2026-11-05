"""Read-only projections preserve event, capture, rule and catalog provenance."""

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from ovitraps.models import Bag, Ovitrap, OvitrapReading


class ProvenanceSerializer(OrgScopedModelSerializer):
    event_id = serializers.UUIDField(read_only=True)
    device_time = serializers.DateTimeField(source="event.device_time", read_only=True)
    server_received_at = serializers.DateTimeField(
        source="event.server_received_at", read_only=True
    )
    rules_version = serializers.CharField(source="event.rules_version", read_only=True)
    catalog_version = serializers.CharField(source="event.catalog_version", read_only=True)
    manual_capture = serializers.BooleanField(source="event.manual_capture", read_only=True)
    gps = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    voided_at = serializers.DateTimeField(source="event.voided_at", read_only=True, allow_null=True)
    void_reason = serializers.CharField(source="event.void_reason", read_only=True)
    void_reason_code = serializers.CharField(source="event.void_reason_code", read_only=True)

    @extend_schema_field(
        {
            "type": "object",
            "nullable": True,
            "properties": {
                "lat": {"type": "number"},
                "lng": {"type": "number"},
                "accuracy_m": {"type": "number", "nullable": True},
            },
        }
    )
    def get_gps(self, instance: Any) -> dict[str, float | None] | None:  # noqa: ANN401
        event = instance.event
        return (
            None
            if event.gps_lat is None
            else {"lat": event.gps_lat, "lng": event.gps_lng, "accuracy_m": event.gps_accuracy_m}
        )

    @extend_schema_field({"type": "string", "enum": ["active", "voided"]})
    def get_status(self, instance: Any) -> str:  # noqa: ANN401
        return "active" if instance.event.voided_at is None else "voided"


PROVENANCE_FIELDS = (
    "event_id",
    "device_time",
    "server_received_at",
    "rules_version",
    "catalog_version",
    "manual_capture",
    "gps",
    "status",
    "voided_at",
    "void_reason",
    "void_reason_code",
    "created_by",
    "created_at",
)


class OvitrapSerializer(ProvenanceSerializer):
    id = serializers.UUIDField(source="client_uuid", read_only=True)
    code = serializers.CharField(read_only=True)
    point_code = serializers.CharField(source="sampling_point.code", read_only=True)
    evaluated_rules = serializers.JSONField(source="placement.evaluated_rules", read_only=True)
    rule_version_ids = serializers.JSONField(source="placement.rule_version_ids", read_only=True)
    supply_refs = serializers.JSONField(source="placement.supply_refs", read_only=True)
    evidence_ids = serializers.JSONField(source="placement.evidence_ids", read_only=True)

    class Meta:
        model = Ovitrap
        fields = (
            "id",
            "code",
            "sampling_point",
            "point_code",
            "point_version",
            "evaluated_rules",
            "rule_version_ids",
            "supply_refs",
            "evidence_ids",
            *PROVENANCE_FIELDS,
        )
        read_only_fields = fields


class ReadingSerializer(ProvenanceSerializer):
    ovitrap = serializers.UUIDField(source="ovitrap.client_uuid", read_only=True)
    code = serializers.UUIDField(source="id", read_only=True)
    bag_id = serializers.UUIDField(source="bag.id", read_only=True, allow_null=True)
    bag_code = serializers.CharField(source="bag.code", read_only=True, allow_null=True)
    is_countable = serializers.SerializerMethodField()

    def get_is_countable(self, instance: OvitrapReading) -> bool:
        return instance.paddle_present and instance.event.voided_at is None

    class Meta:
        model = OvitrapReading
        fields = (
            "id",
            "code",
            "ovitrap",
            "point_version",
            "finding",
            "finding_code",
            "finding_label",
            "other_text",
            "paddle_present",
            "has_eggs",
            "temperature_c",
            "humidity_pct",
            "paddle_type",
            "is_lagged",
            "is_index_excluded",
            "index_exclusion_reason",
            "is_countable",
            "epi_week",
            "bag_id",
            "bag_code",
            "evaluated_rules",
            "rule_version_ids",
            *PROVENANCE_FIELDS,
        )
        read_only_fields = fields


class BagSerializer(ProvenanceSerializer):
    evaluated_rules = serializers.JSONField(source="reading.evaluated_rules", read_only=True)
    rule_version_ids = serializers.JSONField(source="reading.rule_version_ids", read_only=True)

    class Meta:
        model = Bag
        fields = (
            "id",
            "code",
            "reading",
            "collector",
            "field_flags",
            "evaluated_rules",
            "rule_version_ids",
            *PROVENANCE_FIELDS,
        )
        read_only_fields = fields


class RecordQuerySerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=("active", "voided", "all"), required=False)
    point = serializers.UUIDField(required=False)
    week = serializers.RegexField(r"^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$", required=False)
    code = serializers.CharField(max_length=50, required=False)


class IdentityQuerySerializer(RecordQuerySerializer):
    code = serializers.UUIDField(required=False)  # type: ignore[assignment]
