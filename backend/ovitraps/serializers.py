"""Read-only projections preserve event, capture, rule and catalog provenance."""

from typing import Any, cast

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


class OvitrapListSerializer(serializers.ListSerializer[Any]):
    """Evaluates `suggest_relocation` for the whole page at once."""

    def _child(self) -> serializers.BaseSerializer[Any]:
        return cast("serializers.BaseSerializer[Any]", self.child)

    def to_representation(self, data: Any) -> list[Any]:  # noqa: ANN401 -- DRF page or queryset
        from ovitraps.lifecycle.selectors import suggest_relocation_page

        traps = list(data)
        if isinstance(self.child, OvitrapSerializer):
            self.child.relocation_page = suggest_relocation_page(traps)
        return [self._child().to_representation(trap) for trap in traps]


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
    relocation_page: dict[object, bool] | None = None

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

        if self.relocation_page is not None:
            return self.relocation_page[instance.pk]
        return suggest_relocation(instance)

    class Meta:
        model = Ovitrap
        list_serializer_class = OvitrapListSerializer
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


class ReadingListSerializer(serializers.ListSerializer[Any]):
    """Resolves what each reading needs beyond its own row once per page: receipt visibility
    (one scoped query instead of an actor, a scope and a 9-table lookup per row) and the
    incident marker of the abandoned and removed ones."""

    def _child(self) -> serializers.BaseSerializer[Any]:
        return cast("serializers.BaseSerializer[Any]", self.child)

    def to_representation(self, data: Any) -> list[Any]:  # noqa: ANN401 -- DRF page or queryset
        readings = list(data)
        request = self.context.get("request")
        child = self.child
        if request is not None and isinstance(child, ReadingSerializer):
            from lab.access import scoped_readings
            from lab.permissions import BAG_RECEIVE
            from uploads.access import actor_from_request

            child.receipt_visible = set(
                scoped_readings(actor_from_request(request), BAG_RECEIVE)
                .filter(pk__in=[reading.pk for reading in readings])
                .values_list("pk", flat=True)
            )
            child.incident_links = _first_incident_links(readings)
        return [self._child().to_representation(reading) for reading in readings]


def _first_incident_links(readings: list[OvitrapReading]) -> dict[Any, Any]:
    """The marker `ovitrap.incident_links.first()` would return, for every abandoned/removed one."""
    from ovitraps.lifecycle.models import OvitrapIncidentLink

    wanted = {
        reading.ovitrap_id for reading in readings if reading.finding_code in INCIDENT_FINDINGS
    }
    markers: dict[Any, Any] = {}
    for marker in OvitrapIncidentLink.objects.filter(ovitrap_id__in=wanted).order_by(
        *(OvitrapIncidentLink._meta.ordering or ["pk"])
    ):
        markers.setdefault(marker.ovitrap_id, marker)
    return markers


INCIDENT_FINDINGS = {"abandoned", "removed"}


class ReadingSerializer(ProvenanceSerializer):
    lab_receipt = serializers.SerializerMethodField()
    incident_link = serializers.SerializerMethodField()
    receipt_visible: set[Any] | None = None
    incident_links: dict[Any, Any] | None = None

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_incident_link(self, instance: OvitrapReading) -> str | None:
        if instance.finding_code not in INCIDENT_FINDINGS:
            return None
        if self.incident_links is not None:
            marker = self.incident_links.get(instance.ovitrap_id)
        else:
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
        if request is None:
            return None
        if self.receipt_visible is not None:
            visible = instance.pk in self.receipt_visible
        else:
            visible = (
                scoped_readings(actor_from_request(request), BAG_RECEIVE)
                .filter(pk=instance.pk)
                .exists()
            )
        if not visible:
            return None
        receipt = getattr(instance, "lab_receipt", None)
        return None if receipt is None else receipt_projection(receipt)

    class Meta:
        model = OvitrapReading
        list_serializer_class = ReadingListSerializer
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


class BagListSerializer(serializers.ListSerializer[Any]):
    """Resolves the `lab` block of the whole page at once (one lock, constant queries)."""

    def _child(self) -> serializers.BaseSerializer[Any]:
        return cast("serializers.BaseSerializer[Any]", self.child)

    def to_representation(self, data: Any) -> list[Any]:  # noqa: ANN401 -- DRF page or queryset
        bags = list(data)
        request = self.context.get("request")
        if request is not None and isinstance(self.child, BagSerializer):
            from lab.selectors import published_bag_lab_page
            from uploads.access import actor_from_request

            self.child.lab_page = published_bag_lab_page(actor_from_request(request), bags)
        return [self._child().to_representation(bag) for bag in bags]


class BagSerializer(ProvenanceSerializer):
    evaluated_rules = serializers.JSONField(source="reading.evaluated_rules", read_only=True)
    rule_version_ids = serializers.JSONField(source="reading.rule_version_ids", read_only=True)
    lab = serializers.SerializerMethodField()
    lab_page: dict[Any, dict[str, Any] | None] | None = None

    @extend_schema_field(LabBagSummarySerializer(allow_null=True))
    def get_lab(self, instance: Bag) -> dict[str, Any] | None:
        from lab.selectors import published_bag_lab_page
        from uploads.access import actor_from_request

        request = self.context.get("request")
        if request is None:
            return None
        page = self.lab_page
        if page is None:
            page = published_bag_lab_page(actor_from_request(request), [instance])
        return page[instance.pk]

    class Meta:
        model = Bag
        list_serializer_class = BagListSerializer
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
