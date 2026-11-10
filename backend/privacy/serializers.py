"""Wire shapes of the privacy endpoints; services own the writes."""

from typing import Any

from rest_framework import serializers

from core.time import server_now
from privacy.models import ArcoRequest, DataTransferAuthorization, PortalSettings
from privacy.portal import PORTAL_INDICATORS


class TransferAuthorizationSerializer(serializers.ModelSerializer[DataTransferAuthorization]):
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    status = serializers.SerializerMethodField()
    revoked_at = serializers.SerializerMethodField()
    revocation_reason = serializers.SerializerMethodField()

    class Meta:
        model = DataTransferAuthorization
        fields = [
            "id",
            "recipient_institution",
            "purpose",
            "fields",
            "center_id",
            "quadrant_id",
            "valid_from",
            "valid_until",
            "reference",
            "status",
            "revoked_at",
            "revocation_reason",
            "created_at",
        ]
        read_only_fields = fields

    def get_status(self, obj: DataTransferAuthorization) -> str:
        if hasattr(obj, "revocation"):
            return "revoked"
        now = server_now()
        if obj.valid_until <= now:
            return "expired"
        return "scheduled" if obj.valid_from > now else "active"

    def get_revoked_at(self, obj: DataTransferAuthorization) -> Any:  # noqa: ANN401
        revocation = getattr(obj, "revocation", None)
        return revocation.created_at if revocation else None

    def get_revocation_reason(self, obj: DataTransferAuthorization) -> str | None:
        revocation = getattr(obj, "revocation", None)
        return revocation.reason if revocation else None


class TransferAuthorizationCreateSerializer(serializers.Serializer[Any]):
    recipient_institution = serializers.CharField(max_length=200)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    valid_from = serializers.DateTimeField()
    valid_until = serializers.DateTimeField()
    reference = serializers.CharField(max_length=1000)
    fields = serializers.ListField(
        child=serializers.CharField(max_length=32), default=lambda: ["rfc"], max_length=5
    )


class TransferRevocationSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(max_length=2000)


class ArcoRequestSerializer(serializers.ModelSerializer[ArcoRequest]):
    owner_id = serializers.UUIDField(read_only=True, allow_null=True)
    remaining_days = serializers.SerializerMethodField()

    class Meta:
        model = ArcoRequest
        fields = [
            "id",
            "request_type",
            "requester_reference",
            "received_on",
            "due_on",
            "status",
            "owner_id",
            "resolution_note",
            "resolved_at",
            "remaining_days",
            "created_at",
        ]
        read_only_fields = fields

    def get_remaining_days(self, obj: ArcoRequest) -> int | None:
        if obj.status in {ArcoRequest.Status.RESOLVED, ArcoRequest.Status.REJECTED}:
            return None
        return (obj.due_on - server_now().date()).days


class ArcoCreateSerializer(serializers.Serializer[Any]):
    request_type = serializers.ChoiceField(choices=ArcoRequest.Kind.choices)
    requester_reference = serializers.CharField(max_length=200)
    received_on = serializers.DateField(required=False)
    owner_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class ArcoUpdateSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=[ArcoRequest.Status.IN_PROGRESS.value], required=False)
    owner_id = serializers.UUIDField(required=False, allow_null=True)


class ArcoResolveSerializer(serializers.Serializer[Any]):
    outcome = serializers.ChoiceField(
        choices=[ArcoRequest.Status.RESOLVED.value, ArcoRequest.Status.REJECTED.value]
    )
    resolution_note = serializers.CharField(max_length=4000)


class ExportQuerySerializer(serializers.Serializer[Any]):
    dataset = serializers.ChoiceField(choices=["releases", "readings", "lab_results"])
    file_format = serializers.ChoiceField(choices=["csv", "xlsx"], default="csv")
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    recipient_institution = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["date_to"] < attrs["date_from"]:
            raise serializers.ValidationError({"date_to": "invalid_interval"})
        return attrs


class PortalSettingsSerializer(serializers.ModelSerializer[PortalSettings]):
    indicators = serializers.ListField(
        child=serializers.ChoiceField(choices=list(PORTAL_INDICATORS)), max_length=20
    )

    class Meta:
        model = PortalSettings
        fields = ["enabled", "indicators", "updated_at"]
        read_only_fields = ["updated_at"]
