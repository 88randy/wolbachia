"""Closed regulatory commands and explicit provenance-only read contracts."""

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from geography.serializers import PolygonField
from ovitraps.payloads import StrictPayloadSerializer
from people.serializers import AwareInstantField, PeopleIntegerField
from releases.models import (
    Permit,
    PermitSuspension,
    PermitType,
    PermitVersion,
    Release,
    ReleaseDevice,
    ReleaseDeviceStatus,
)
from releases.selectors import (
    current_device_status,
    current_permit_version,
    device_revision,
    permit_blockers,
    permit_revision,
)
from releases.services import validate_requirements
from scheduling.serializers import PlanningDateField


class ReleaseContextFilterSerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)


class PermitTypeWriteSerializer(StrictPayloadSerializer):
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=200)
    requirements = serializers.JSONField()

    def validate_requirements(self, value: object) -> dict[str, float]:
        return validate_requirements(value)


class PermitVersionWriteSerializer(StrictPayloadSerializer):
    type = serializers.UUIDField(source="type_id")
    number = serializers.CharField(max_length=100)
    authority = serializers.CharField(max_length=300)
    official_document = serializers.UUIDField(source="official_document_id")
    document_attestation = serializers.CharField(max_length=1000)
    geometry = PolygonField()
    valid_from = AwareInstantField()
    valid_to = AwareInstantField()


class PermitWriteSerializer(PermitVersionWriteSerializer):
    code = serializers.CharField(max_length=50)
    quadrant = serializers.UUIDField(source="quadrant_id")


class PermitVersionAppendSerializer(PermitVersionWriteSerializer):
    expected_revision = PeopleIntegerField(min_value=1)


class PermitSuspensionWriteSerializer(StrictPayloadSerializer):
    reason = serializers.CharField(max_length=1000)
    expected_revision = PeopleIntegerField(min_value=1)


class ReleaseDeviceWriteSerializer(StrictPayloadSerializer):
    code = serializers.CharField(max_length=50)
    quadrant = serializers.UUIDField(source="quadrant_id")
    source_lot = serializers.UUIDField(source="source_lot_id")


class ReleaseScheduleWriteSerializer(StrictPayloadSerializer):
    point_id = serializers.UUIDField()
    courier_id = serializers.UUIDField()
    due_date = PlanningDateField()
    expected_revision = PeopleIntegerField(min_value=1)


class ReleaseDeviceStatusWriteSerializer(StrictPayloadSerializer):
    status = serializers.ChoiceField(choices=["active", "inactive", "retired"])
    reason = serializers.CharField(max_length=1000)
    expected_revision = PeopleIntegerField(min_value=1)


class ReleaseScheduleSerializer(serializers.Serializer[Any]):
    task_id = serializers.UUIDField()
    permit_version_id = serializers.UUIDField()
    due_date = serializers.DateField()
    courier_id = serializers.UUIDField()


class PermitTypeSerializer(OrgScopedModelSerializer):
    class Meta:
        model = PermitType
        fields = ["id", "code", "name", "requirements", "created_by", "created_at"]
        read_only_fields = fields


class PermitVersionSerializer(OrgScopedModelSerializer):
    requirements = serializers.JSONField(source="type.requirements", read_only=True)

    class Meta:
        model = PermitVersion
        fields = [
            "id",
            "permit",
            "revision",
            "type",
            "requirements",
            "number",
            "authority",
            "official_document",
            "document_attestation",
            "geometry",
            "valid_from",
            "valid_to",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class PermitSuspensionSerializer(OrgScopedModelSerializer):
    class Meta:
        model = PermitSuspension
        fields = [
            "id",
            "permit",
            "revision",
            "reason",
            "effective_from",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReleaseBlockerSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField()
    unblocked_by_role = serializers.CharField()
    link = serializers.CharField(allow_blank=True)


class PermitSerializer(OrgScopedModelSerializer):
    current_version = serializers.SerializerMethodField()
    revision = serializers.SerializerMethodField()
    blocked_by = serializers.SerializerMethodField()
    suspension = PermitSuspensionSerializer(read_only=True)

    @extend_schema_field(PermitVersionSerializer(allow_null=True))
    def get_current_version(self, row: Permit) -> dict[str, Any] | None:
        version = current_permit_version(row)
        return None if version is None else dict(PermitVersionSerializer(version).data)

    def get_revision(self, row: Permit) -> int:
        return permit_revision(row)

    @extend_schema_field(ReleaseBlockerSerializer(many=True))
    def get_blocked_by(self, row: Permit) -> list[dict[str, str]]:
        return permit_blockers(row)

    class Meta:
        model = Permit
        fields = [
            "id",
            "code",
            "center",
            "quadrant",
            "revision",
            "current_version",
            "suspension",
            "blocked_by",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReleaseDeviceSerializer(OrgScopedModelSerializer):
    status = serializers.SerializerMethodField()
    revision = serializers.SerializerMethodField()
    blocked_by = serializers.SerializerMethodField()

    def get_status(self, row: ReleaseDevice) -> str:
        return current_device_status(row)

    def get_revision(self, row: ReleaseDevice) -> int:
        return device_revision(row)

    @extend_schema_field(ReleaseBlockerSerializer(many=True))
    def get_blocked_by(self, row: ReleaseDevice) -> list[dict[str, str]]:
        if current_device_status(row) == "active":
            return []
        return [{"reason": "release_device_inactive", "unblocked_by_role": "admin", "link": ""}]

    class Meta:
        model = ReleaseDevice
        fields = [
            "id",
            "code",
            "center",
            "quadrant",
            "source_lot",
            "source_lot_version",
            "status",
            "revision",
            "blocked_by",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReleaseDeviceStatusSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ReleaseDeviceStatus
        fields = ["id", "device", "revision", "status", "reason", "created_by", "created_at"]
        read_only_fields = fields


class ReleaseSerializer(OrgScopedModelSerializer):
    blocked_by = ReleaseBlockerSerializer(many=True, read_only=True, default=list)

    class Meta:
        model = Release
        fields = [
            "id",
            "declared_event_id",
            "permit_version",
            "lot",
            "release_device",
            "training_version",
            "schedule_task",
            "quantity",
            "location",
            "device_time",
            "server_received_at",
            "provenance",
            "blocked_by",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields
