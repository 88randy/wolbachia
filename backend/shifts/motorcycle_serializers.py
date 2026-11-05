"""Fleet requests and responses; block and void metadata is always read-only."""

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.exceptions import FieldValidationError
from core.serializers import OrgScopedModelSerializer
from shifts.extensions import METRIC_READERS
from shifts.models import BlockedReason, Motorcycle


class MotorcycleMetricsSerializer(serializers.Serializer[Any]):
    last_service = serializers.UUIDField(allow_null=True)
    next_service_due_km = serializers.IntegerField(allow_null=True)
    next_service_due_date = serializers.DateField(allow_null=True)
    latest_odometer = serializers.IntegerField(allow_null=True)
    latest_efficiency = serializers.DecimalField(max_digits=18, decimal_places=6, allow_null=True)
    efficiency_status = serializers.CharField()
    due_metric_provenance = serializers.JSONField()


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
            "center",
            "revision",
            "is_blocked",
            "blocked_reason",
            "created_at",
            "created_by",
            "voided_at",
            "voided_by",
            "void_reason",
            "void_reason_code",
        ]
        read_only_fields = fields


class MotorcycleDetailSerializer(MotorcycleSerializer):
    metrics = serializers.SerializerMethodField()

    @extend_schema_field(MotorcycleMetricsSerializer)
    def get_metrics(self, motorcycle: Motorcycle) -> dict[str, Any]:
        values = {
            key: value for reader in METRIC_READERS for key, value in reader(motorcycle).items()
        }
        return dict(MotorcycleMetricsSerializer(values).data)

    class Meta(MotorcycleSerializer.Meta):
        fields = [*MotorcycleSerializer.Meta.fields, "metrics"]
        read_only_fields = fields


class MotorcycleWriteSerializer(OrgScopedModelSerializer):
    center = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Motorcycle
        fields = ["code", "plate", "center"]
        # The service maps PostgreSQL's unique constraint, including concurrent requests.
        validators: list[Any] = []


class MotorcycleUpdateSerializer(OrgScopedModelSerializer):
    """Plate and center can change; code identifies pending schema-1 offline events forever."""

    center = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Motorcycle
        fields = ["plate", "center"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "code" in self.initial_data:
            raise FieldValidationError("code", "immutable_code")
        return attrs


class MotorcycleFilterSerializer(serializers.Serializer[Any]):
    is_blocked = serializers.BooleanField(required=False)
    center = serializers.UUIDField(required=False)


class SnapshotMotorcycleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    plate = serializers.CharField()
    is_blocked = serializers.BooleanField()
    blocked_reason = serializers.CharField()
