"""Wire shapes of the privacy endpoints; services own the writes."""

from typing import Any

from rest_framework import serializers

from core.time import localdate, server_now
from privacy.models import (
    ApiKey,
    ArcoRequest,
    DataTransferAuthorization,
    ExportLog,
    PortalSettings,
)
from privacy.portal import PORTAL_INDICATORS


class TransferAuthorizationSerializer(serializers.ModelSerializer[DataTransferAuthorization]):
    center_id = serializers.UUIDField(read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    quadrant_code = serializers.CharField(source="quadrant.code", read_only=True, default=None)
    created_by_name = serializers.CharField(read_only=True, allow_null=True, default=None)
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
            "center_name",
            "quadrant_id",
            "quadrant_code",
            "valid_from",
            "valid_until",
            "reference",
            "created_by_name",
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
    owner_name = serializers.CharField(read_only=True, allow_null=True, default=None)
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
            "owner_name",
            "resolution_note",
            "resolved_at",
            "remaining_days",
            "created_at",
        ]
        read_only_fields = fields

    def get_remaining_days(self, obj: ArcoRequest) -> int | None:
        if obj.status in {ArcoRequest.Status.RESOLVED, ArcoRequest.Status.REJECTED}:
            return None
        organization = (
            getattr(self.context.get("request"), "organization", None) or obj.organization
        )
        return (obj.due_on - localdate(organization)).days


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


class ExportLogSerializer(serializers.ModelSerializer[ExportLog]):
    actor_name = serializers.CharField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = ExportLog
        fields = [
            "id",
            "dataset",
            "date_from",
            "date_to",
            "recipient_institution",
            "row_count",
            "rfc_rows_released",
            "actor_name",
            "created_at",
        ]
        read_only_fields = fields


class ApiKeySerializer(serializers.ModelSerializer[ApiKey]):
    """What the list and the detail show. The secret and its digest are never a field here."""

    center_id = serializers.UUIDField(read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    quadrant_code = serializers.CharField(source="quadrant.code", read_only=True, default=None)
    created_by_name = serializers.CharField(read_only=True, allow_null=True, default=None)
    revoked_by_name = serializers.CharField(read_only=True, allow_null=True, default=None)
    status = serializers.SerializerMethodField()

    class Meta:
        model = ApiKey
        fields = [
            "id",
            "institution",
            "prefix",
            "center_id",
            "center_name",
            "quadrant_id",
            "quadrant_code",
            "endpoints",
            "rate_limit_per_day",
            "valid_from",
            "valid_until",
            "status",
            "revoked_at",
            "revoke_reason",
            "revoked_by_name",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_status(self, obj: ApiKey) -> str:
        if obj.revoked_at is not None:
            return "revoked"
        now = server_now()
        if obj.valid_until <= now:
            return "expired"
        return "scheduled" if obj.valid_from > now else "active"


class ApiKeyCreatedSerializer(ApiKeySerializer):
    """The one response that carries the secret: the creation answer, never a read."""

    secret = serializers.CharField(read_only=True)

    class Meta(ApiKeySerializer.Meta):
        fields = [*ApiKeySerializer.Meta.fields, "secret"]
        read_only_fields = fields


class ApiKeyCreateSerializer(serializers.Serializer[Any]):
    institution = serializers.CharField(max_length=200)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    endpoints = serializers.ListField(
        child=serializers.CharField(max_length=32), allow_empty=False, max_length=20
    )
    rate_limit_per_day = serializers.IntegerField(min_value=1, max_value=1_000_000)
    valid_from = serializers.DateTimeField()
    valid_until = serializers.DateTimeField()


class ApiKeyRevokeSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(max_length=2000)


class RetentionRowSerializer(serializers.Serializer[Any]):
    code = serializers.CharField()
    period_days = serializers.IntegerField()
    action = serializers.ChoiceField(choices=("delete", "unlink"))
    last_run_at = serializers.DateTimeField(allow_null=True)
    records_processed = serializers.IntegerField(allow_null=True)


class RetentionSerializer(serializers.Serializer[Any]):
    nightly_at = serializers.CharField()
    timezone = serializers.CharField()
    rows = RetentionRowSerializer(many=True)
