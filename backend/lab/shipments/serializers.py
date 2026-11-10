"""Closed shipment command inputs and additive source projection outputs."""

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from lab.shipments.models import DeliveryReceipt
from ovitraps.payloads import StrictPayloadSerializer


class ShipmentWriteSerializer(StrictPayloadSerializer):
    source_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=200)
    cutoff = serializers.DateTimeField()
    recipient_institution = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
    )
    supersedes_id = serializers.UUIDField(required=False)
    reason = serializers.CharField(max_length=1000, required=False)


class ShipmentProjectionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    cutoff = serializers.DateTimeField()
    template_version = serializers.CharField()
    recipient_institution = serializers.CharField()
    source_snapshot = serializers.ListField(child=serializers.DictField())
    content_hash = serializers.CharField()
    supersedes_id = serializers.UUIDField(allow_null=True)
    is_superseded = serializers.BooleanField()
    rfc = serializers.CharField(allow_blank=True)
    rfc_omission_code = serializers.CharField()


class MaterialRequestWriteSerializer(StrictPayloadSerializer):
    recipient_institution = serializers.CharField(max_length=200)
    lot_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(required=False)
    unit_version_id = serializers.UUIDField(required=False)
    quantity = serializers.DecimalField(
        max_digits=18, decimal_places=6, min_value=Decimal("0.000001")
    )


class NotificationWriteSerializer(StrictPayloadSerializer):
    reference = serializers.CharField(max_length=200)
    date = serializers.DateField()
    evidence_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=20)


class DeliveryWriteSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    signature_upload_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)


class NotificationProjectionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    reference = serializers.CharField()
    date = serializers.DateField()
    evidence_id = serializers.UUIDField()


class MaterialRequestProjectionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    recipient_institution = serializers.CharField()
    lot_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(allow_null=True)
    unit_version_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=6)
    revision = serializers.IntegerField()
    is_voided = serializers.BooleanField()
    delivery_id = serializers.UUIDField(allow_null=True)
    notifications = NotificationProjectionSerializer(many=True)


class DeliveryReceiptSerializer(OrgScopedModelSerializer):
    class Meta:
        model = DeliveryReceipt
        fields = ["id", "request", "command_id", "created_at", "created_by", "expected_revision"]
        read_only_fields = fields


class ShipmentVoidSerializer(StrictPayloadSerializer):
    reason = serializers.CharField(max_length=1000)


class ShipmentQuerySerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    ordering = serializers.ChoiceField(
        choices=["created_at", "-created_at", "code", "-code"],
        required=False,
        default="-created_at",
    )
    include_voided = serializers.BooleanField(required=False, default=False)
