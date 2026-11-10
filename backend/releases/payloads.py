"""Client declarations are identities, never release authorization."""

from decimal import Decimal

from rest_framework import serializers

from ovitraps.payloads import StrictPayloadSerializer


class ReleasePayload(StrictPayloadSerializer):
    permit_id = serializers.UUIDField()
    release_device_id = serializers.UUIDField()
    lot_id = serializers.UUIDField()
    quantity = serializers.DecimalField(
        max_digits=20, decimal_places=6, min_value=Decimal("0.000001")
    )
    schedule_task_id = serializers.UUIDField()
    training_version = serializers.UUIDField()
    evidence_ids = serializers.ListField(child=serializers.UUIDField(), max_length=20)
