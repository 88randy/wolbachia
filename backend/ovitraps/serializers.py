"""Read-only projections preserve event, capture, rule and catalog provenance."""

from typing import Any, cast
from uuid import UUID

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from lab.serializers import LabBagSummarySerializer, LabReceiptSerializer
from ovitraps.lifecycle.models import PhysicalOvitrapLineage
from ovitraps.models import Bag, Ovitrap, OvitrapReading, PlacementAttempt


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
    evaluated_rules = serializers.SerializerMethodField()
    rule_version_ids = serializers.SerializerMethodField()
    supply_refs = serializers.JSONField(
        source="placement.supply_refs", read_only=True, default=list
    )
    evidence_ids = serializers.SerializerMethodField()

    is_retired = serializers.SerializerMethodField()
    suggest_relocation = serializers.SerializerMethodField()

    def _capture_record(self, instance: Ovitrap) -> PlacementAttempt | PhysicalOvitrapLineage:
        return cast(
            PlacementAttempt | PhysicalOvitrapLineage,
            getattr(instance, "placement", None) or getattr(instance, "replacement", None),
        )

    @extend_schema_field(serializers.JSONField())
    def get_evaluated_rules(self, instance: Ovitrap) -> dict[str, Any]:
        return dict(self._capture_record(instance).evaluated_rules)

    @extend_schema_field(serializers.JSONField())
    def get_rule_version_ids(self, instance: Ovitrap) -> dict[str, str]:
        return dict(self._capture_record(instance).rule_version_ids)

    @extend_schema_field(serializers.JSONField())
    def get_evidence_ids(self, instance: Ovitrap) -> list[str]:
        return list(self._capture_record(instance).evidence_ids)

    def get_is_retired(self, instance: Ovitrap) -> bool:
        return bool(
            getattr(instance, "is_replaced", False) or getattr(instance, "is_removed", False)
        )

    def get_suggest_relocation(self, instance: Ovitrap) -> bool:
        from ovitraps.lifecycle.selectors import suggest_relocation

        return suggest_relocation(instance)

    class Meta:
        model = Ovitrap
        fields = (
            "id",
            "code",
            "is_retired",
            "suggest_relocation",
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
    lab_receipt = serializers.SerializerMethodField()
    incident_link = serializers.SerializerMethodField()

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_incident_link(self, instance: OvitrapReading) -> str | None:
        if instance.finding_code not in {"abandoned", "removed"}:
            return None
        marker = instance.ovitrap.incident_links.first()
        return None if marker is None else str(marker.pk)

    ovitrap = serializers.UUIDField(source="ovitrap.client_uuid", read_only=True)
    code = serializers.UUIDField(source="id", read_only=True)
    bag_id = serializers.UUIDField(source="bag.id", read_only=True, allow_null=True)
    bag_code = serializers.CharField(source="bag.code", read_only=True, allow_null=True)
    is_countable = serializers.SerializerMethodField()

    def get_is_countable(self, instance: OvitrapReading) -> bool:
        return instance.paddle_present and instance.event.voided_at is None

    @extend_schema_field(LabReceiptSerializer(allow_null=True))
    def get_lab_receipt(self, instance: OvitrapReading) -> dict[str, Any] | None:
        from lab.access import scoped_readings
        from lab.permissions import BAG_RECEIVE
        from lab.reception import receipt_projection
        from uploads.access import actor_from_request

        request = self.context.get("request")
        if (
            request is None
            or not scoped_readings(actor_from_request(request), BAG_RECEIVE)
            .filter(pk=instance.pk)
            .exists()
        ):
            return None
        receipt = getattr(instance, "lab_receipt", None)
        return None if receipt is None else receipt_projection(receipt)

    class Meta:
        model = OvitrapReading
        fields = (
            "id",
            "code",
            "ovitrap",
            "point_version",
            "finding",
            "finding_code",
            "incident_link",
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
            "lab_receipt",
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
    lab = serializers.SerializerMethodField()

    @extend_schema_field(LabBagSummarySerializer(allow_null=True))
    def get_lab(self, instance: Bag) -> dict[str, Any] | None:
        from lab.access import scoped_bags
        from lab.permissions import BAG_RECEIVE, COUNT_READ
        from lab.selectors import published_bag_lab_projection
        from uploads.access import actor_from_request

        request = self.context.get("request")
        if request is None:
            return None
        actor = actor_from_request(request)
        permission = next(
            (
                code
                for code in (BAG_RECEIVE, COUNT_READ)
                if scoped_bags(actor, code).filter(pk=instance.pk).exists()
            ),
            None,
        )
        if permission is None:
            return None
        return published_bag_lab_projection(actor, instance, permission)

    class Meta:
        model = Bag
        fields = (
            "id",
            "code",
            "reading",
            "collector",
            "field_flags",
            "lab",
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


class BagQuerySerializer(RecordQuerySerializer):
    lab_status = serializers.ChoiceField(
        choices=[
            "expected",
            "missing",
            "no_effective_reading",
            "pending_count",
            "counted",
            "awaiting_independent_qa",
            "rejected",
            "voided",
        ],
        required=False,
    )


class IdentityQuerySerializer(RecordQuerySerializer):
    code = serializers.UUIDField(required=False)  # type: ignore[assignment]


class OvitrapQuerySerializer(IdentityQuerySerializer):
    """`code` is the short code (`OVT-0001`) or, as before, the identity UUID."""

    code = serializers.CharField(max_length=50, required=False)  # type: ignore[assignment]

    def validate_code(self, value: str) -> str | UUID:
        value = value.strip()
        try:
            return UUID(value)
        except ValueError:
            return value
