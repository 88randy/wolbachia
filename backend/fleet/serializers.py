"""Thin fleet contracts: writes validate input and services own state transitions."""

from datetime import date
from typing import Any

from rest_framework import serializers

from core.exceptions import FieldValidationError
from core.serializers import OrgScopedModelSerializer
from core.void_reason import VoidReasonField
from fleet.models import (
    EfficiencyStatus,
    FuelLoad,
    InspectionClearance,
    ResponsibilityLetter,
    ServiceRecord,
)
from shifts.models import MotorcycleBlockEvent

HISTORY_FIELDS = [
    "id",
    "motorcycle",
    "created_at",
    "created_by",
    "voided_at",
    "voided_by",
    "void_reason",
    "void_reason_code",
]


class ServiceRecordSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ServiceRecord
        fields = [
            *HISTORY_FIELDS,
            "kind",
            "performed_at",
            "odometer_km",
            "notes",
            "service_interval_km",
            "service_interval_days",
            "due_metric_provenance",
        ]
        read_only_fields = fields


class ServiceWriteSerializer(OrgScopedModelSerializer):
    odometer_km = serializers.IntegerField(min_value=0, max_value=999999)
    service_interval_km = serializers.IntegerField(
        min_value=1, max_value=2147483647, allow_null=True, required=False
    )
    service_interval_days = serializers.IntegerField(
        min_value=1, max_value=2147483647, allow_null=True, required=False
    )
    notes = serializers.CharField(max_length=1000, allow_blank=True, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        days = attrs.get("service_interval_days")
        if days is not None and days > (date.max - attrs["performed_at"]).days:
            raise FieldValidationError("service_interval_days", "out_of_range")
        return attrs

    class Meta:
        model = ServiceRecord
        fields = [
            "kind",
            "performed_at",
            "odometer_km",
            "notes",
            "service_interval_km",
            "service_interval_days",
        ]


class ResponsibilityLetterSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ResponsibilityLetter
        fields = [*HISTORY_FIELDS, "courier", "issued_at", "document_reference", "notes"]
        read_only_fields = fields


class LetterWriteSerializer(OrgScopedModelSerializer):
    courier = serializers.UUIDField()
    notes = serializers.CharField(max_length=1000, allow_blank=True, required=False)

    class Meta:
        model = ResponsibilityLetter
        fields = ["courier", "issued_at", "document_reference", "notes"]


class ClearanceSerializer(serializers.Serializer[Any]):
    fault_id = serializers.UUIDField()
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=50
    )
    reason = VoidReasonField(allow_blank=True, trim_whitespace=False)
    expected_revision = serializers.IntegerField(min_value=0)


class FuelLoadSerializer(OrgScopedModelSerializer):
    courier = serializers.UUIDField(source="shift.courier_id", read_only=True)
    device_time = serializers.DateTimeField(source="event.device_time", read_only=True)
    server_received_at = serializers.DateTimeField(
        source="event.server_received_at", read_only=True
    )
    rules_version = serializers.CharField(source="event.rules_version", read_only=True)
    catalog_version = serializers.CharField(source="event.catalog_version", read_only=True)

    class Meta:
        model = FuelLoad
        fields = [
            "id",
            "event",
            "shift",
            "motorcycle",
            "courier",
            "litres",
            "amount",
            "currency",
            "odometer_km",
            "receipt_upload_id",
            "receipt_pending",
            "is_full_refill",
            "efficiency_km_l",
            "efficiency_status",
            "threshold_min",
            "threshold_max",
            "rule_provenance",
            "baseline",
            "provisional",
            "created_at",
            "created_by",
            "device_time",
            "server_received_at",
            "rules_version",
            "catalog_version",
        ]
        read_only_fields = fields


class FuelFilterSerializer(serializers.Serializer[Any]):
    motorcycle = serializers.UUIDField(required=False)
    courier = serializers.UUIDField(required=False)
    efficiency_status = serializers.ChoiceField(choices=EfficiencyStatus.choices, required=False)
    date_from = serializers.DateTimeField(required=False)
    date_before = serializers.DateTimeField(required=False)


class FleetIncidentFilterSerializer(serializers.Serializer[Any]):
    motorcycle = serializers.UUIDField(
        required=False, help_text="Exact motorcycle UUID; applies only to fleet incident lists."
    )


class InspectionClearanceReadSerializer(OrgScopedModelSerializer):
    reviewer = serializers.UUIDField(source="reviewer_id", read_only=True)
    evidence_ids = serializers.ListField(child=serializers.UUIDField(), read_only=True)

    class Meta:
        model = InspectionClearance
        fields = ["id", "created_at", "reviewer", "reason", "evidence_ids"]
        read_only_fields = fields


class IncidentSerializer(OrgScopedModelSerializer):
    is_cleared = serializers.BooleanField(read_only=True)
    cleared_at = serializers.DateTimeField(read_only=True, allow_null=True)
    clearance = InspectionClearanceReadSerializer(
        source="inspection_clearance", read_only=True, allow_null=True
    )

    class Meta:
        model = MotorcycleBlockEvent
        fields = [
            "id",
            "motorcycle",
            "field_event",
            "blocked_reason",
            "created_at",
            "created_by",
            "is_cleared",
            "cleared_at",
            "clearance",
        ]
        read_only_fields = fields
