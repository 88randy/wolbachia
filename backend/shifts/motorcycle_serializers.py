"""Fleet requests and responses; block and void metadata is always read-only."""

from typing import Any

from rest_framework import serializers

from core.exceptions import FieldValidationError
from core.serializers import OrgScopedModelSerializer
from shifts.models import BlockedReason, Motorcycle


class MotorcycleSerializer(OrgScopedModelSerializer):
    blocked_reason = serializers.ChoiceField(
        choices=BlockedReason.choices, allow_blank=True, read_only=True
    )

    class Meta:
        model = Motorcycle
        fields = [
            "id",
            "code",
            "plate",
            "is_blocked",
            "blocked_reason",
            "created_at",
            "created_by",
            "voided_at",
            "voided_by",
            "void_reason",
        ]
        read_only_fields = fields


class MotorcycleWriteSerializer(OrgScopedModelSerializer):
    class Meta:
        model = Motorcycle
        fields = ["code", "plate"]
        # The service maps PostgreSQL's unique constraint, including concurrent requests.
        validators: list[Any] = []


class MotorcycleUpdateSerializer(OrgScopedModelSerializer):
    """Only the plate can change; code identifies pending schema-1 offline events forever."""

    class Meta:
        model = Motorcycle
        fields = ["plate"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "code" in self.initial_data:
            raise FieldValidationError("code", "immutable_code")
        return attrs


class MotorcycleFilterSerializer(serializers.Serializer[Any]):
    is_blocked = serializers.BooleanField(required=False)


class SnapshotMotorcycleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    plate = serializers.CharField()
    is_blocked = serializers.BooleanField()
    blocked_reason = serializers.CharField()
