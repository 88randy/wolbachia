"""Client declarations are identities, never release authorization."""

from decimal import Decimal
from re import fullmatch
from uuid import UUID

from rest_framework import serializers

from ovitraps.payloads import StrictPayloadSerializer


class ReleaseUUIDField(serializers.UUIDField):
    """Wire UUIDs are strings; the source guard shares this ASCII normalization."""

    def to_internal_value(self, value: object) -> UUID:
        if isinstance(value, UUID):
            return value
        if not isinstance(value, str):
            self.fail("invalid")
        normalized = value.replace("urn:", "").replace("uuid:", "").strip("{}").replace("-", "")
        if fullmatch(r"[0-9a-fA-F]{32}", normalized) is None:
            self.fail("invalid")
        return UUID(hex=normalized)


class ReleasePayload(StrictPayloadSerializer):
    permit_id = ReleaseUUIDField()
    release_device_id = ReleaseUUIDField()
    lot_id = ReleaseUUIDField()
    quantity = serializers.DecimalField(
        max_digits=20, decimal_places=6, min_value=Decimal("0.000001")
    )
    schedule_task_id = ReleaseUUIDField()
    training_version = ReleaseUUIDField()
    evidence_ids = serializers.ListField(child=ReleaseUUIDField(), max_length=20)
