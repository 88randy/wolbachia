"""Separate private administration and limited operational wire allowlists."""

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import AccessLog, Personnel
from core.serializers import OrgScopedModelSerializer


class PersonnelSerializer(OrgScopedModelSerializer):
    id = serializers.UUIDField(source="membership.user_id", read_only=True)
    personnel_id = serializers.UUIDField(source="pk", read_only=True)
    membership_id = serializers.UUIDField(read_only=True)
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    is_active = serializers.BooleanField(source="membership.is_active", read_only=True)
    has_rfc = serializers.SerializerMethodField()
    deactivation_reason = serializers.SerializerMethodField()

    class Meta:
        model = Personnel
        fields = [
            "id",
            "personnel_id",
            "membership_id",
            "display_name",
            "center_id",
            "quadrant_id",
            "work_email",
            "work_phone",
            "revision",
            "is_active",
            "has_rfc",
            "deactivation_reason",
        ]
        read_only_fields = fields

    def get_has_rfc(self, obj: Personnel) -> bool:
        return bool(obj.rfc_ciphertext)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_deactivation_reason(self, obj: Personnel) -> str | None:
        """The reason of the latest deactivation while the membership is inactive, else null.

        Lists annotate it (`last_deactivation_reason`); a single record reads its receipt.
        """
        if obj.membership.is_active:
            return None
        if hasattr(obj, "last_deactivation_reason"):
            return obj.last_deactivation_reason or None
        reason = (
            AccessLog.objects.filter(target=obj, action=AccessLog.Action.DEACTIVATE)
            .order_by("-created_at", "-id")
            .values_list("reason", flat=True)
            .first()
        )
        return reason or None


class PersonnelDeactivateSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=1)
    # Validated by the void-reason rule in the service (`void_reason_too_short`, ...).
    reason = serializers.CharField(trim_whitespace=False, allow_blank=True)


class PersonnelWriteSerializer(serializers.Serializer[Any]):
    membership_id = serializers.UUIDField(required=False)
    username = serializers.RegexField(r"^[\w.@+-]+$", max_length=150, required=False)
    display_name = serializers.CharField(max_length=200)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True, required=False, default=None)
    work_email = serializers.EmailField(required=False, allow_blank=True, default="")
    work_phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    rfc = serializers.CharField(
        max_length=32, required=False, write_only=True, trim_whitespace=True
    )
    expected_revision = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.partial:
            if "expected_revision" not in attrs:
                raise serializers.ValidationError({"expected_revision": "Required."})
            if {"membership_id", "username"} & attrs.keys():
                raise serializers.ValidationError({"membership_id": "Immutable."})
        elif ("membership_id" in attrs) == ("username" in attrs):
            raise serializers.ValidationError(
                {"membership_id": "Choose membership_id or username."}
            )
        return attrs


class TemporaryPasswordSerializer(serializers.Serializer[Any]):
    temporary_password = serializers.CharField()
    expires_at = serializers.DateTimeField()


class RfcRevealSerializer(serializers.Serializer[Any]):
    rfc = serializers.CharField()


class OperationalTrainingSerializer(serializers.Serializer[Any]):
    training_code = serializers.CharField()
    valid_from = serializers.DateTimeField()
    valid_to = serializers.DateTimeField()
    is_revoked = serializers.BooleanField()


class OperationalDeviceSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    # The wire name overlaps the base Field.label attribute.
    label = serializers.CharField()  # type: ignore[assignment]


class OperationalPersonnelSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    work_email = serializers.EmailField(allow_blank=True)
    work_phone = serializers.CharField(allow_blank=True)
    is_active = serializers.BooleanField()
    profiles = serializers.ListField(child=serializers.CharField())
    trainings = OperationalTrainingSerializer(many=True)
    devices = OperationalDeviceSerializer(many=True)


class PersonnelFilterSerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    is_active = serializers.BooleanField(required=False)


class AccessLogSerializer(OrgScopedModelSerializer):
    actor_id = serializers.UUIDField(source="created_by_id", read_only=True)
    target_id = serializers.UUIDField(read_only=True, allow_null=True)
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    actor_name = serializers.CharField(read_only=True, allow_null=True, default=None)
    target_name = serializers.CharField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = AccessLog
        fields = [
            "id",
            "actor_id",
            "actor_name",
            "target_id",
            "target_name",
            "center_id",
            "quadrant_id",
            "action",
            "origin",
            "result",
            "revision",
            "reason",
            "created_at",
        ]
        read_only_fields = fields


class AccessLogFilterSerializer(serializers.Serializer[Any]):
    action = serializers.ChoiceField(choices=AccessLog.Action.choices, required=False)
    result = serializers.ChoiceField(choices=AccessLog.Result.choices, required=False)
    actor_id = serializers.UUIDField(required=False)
    created_after = serializers.DateTimeField(required=False)
    created_before = serializers.DateTimeField(required=False)
