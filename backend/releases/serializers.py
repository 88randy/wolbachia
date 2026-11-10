"""Closed regulatory commands and explicit provenance-only read contracts."""

from typing import Any

from django.db.models import Count
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


class PermitNoticeSummarySerializer(serializers.Serializer[Any]):
    kind = serializers.CharField()
    status = serializers.CharField()
    count = serializers.IntegerField()


class PermitSuspensionSerializer(OrgScopedModelSerializer):
    notices = serializers.SerializerMethodField()

    @extend_schema_field(PermitNoticeSummarySerializer(many=True))
    def get_notices(self, row: PermitSuspension) -> list[dict[str, Any]]:
        """Recorded recipients by kind and delivery outcome; never recipient identities."""
        rows = (
            row.notices.values("kind", "status")
            .annotate(count=Count("id"))
            .order_by("kind", "status")
        )
        return [dict(item) for item in rows]

    class Meta:
        model = PermitSuspension
        fields = [
            "id",
            "permit",
            "revision",
            "reason",
            "effective_from",
            "notices",
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
    suspension = PermitSuspensionSerializer(read_only=True, allow_null=True)
    center_code = serializers.CharField(source="center.code", read_only=True)
    quadrant_code = serializers.CharField(source="quadrant.code", read_only=True)
    type_name = serializers.SerializerMethodField()

    def get_type_name(self, row: Permit) -> str | None:
        version = current_permit_version(row)
        return None if version is None else str(version.type.name)

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
            "center_code",
            "quadrant",
            "quadrant_code",
            "type_name",
            "revision",
            "current_version",
            "suspension",
            "blocked_by",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReleaseDeviceSerializer(OrgScopedModelSerializer):
    center_code = serializers.CharField(source="center.code", read_only=True)
    quadrant_code = serializers.CharField(source="quadrant.code", read_only=True)
    source_lot_code = serializers.CharField(source="source_lot.code", read_only=True)
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
            "center_code",
            "quadrant",
            "quadrant_code",
            "source_lot",
            "source_lot_code",
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


class ReleaseScheduleProvenanceSerializer(serializers.Serializer[Any]):
    task_id = serializers.UUIDField(read_only=True)
    permit_version_id = serializers.UUIDField(read_only=True)


class ReleaseStockProvenanceSerializer(serializers.Serializer[Any]):
    unit_version_id = serializers.UUIDField(read_only=True)
    lot_version_id = serializers.UUIDField(read_only=True)
    transit_policy_id = serializers.UUIDField(read_only=True)
    transit_mode = serializers.CharField(read_only=True)
    quantity = serializers.CharField(read_only=True)


class ReleaseProvenanceSerializer(serializers.Serializer[Any]):
    """Regulatory ids only: no courier, certification, reviewer, assignment or receipt ids."""

    permit_version = serializers.UUIDField(read_only=True)
    current_permit_version = serializers.UUIDField(read_only=True)
    permit_type = serializers.UUIDField(read_only=True)
    official_document = serializers.UUIDField(read_only=True)
    source_lot_version = serializers.UUIDField(read_only=True)
    rules_version = serializers.CharField(read_only=True)
    catalog_version = serializers.CharField(read_only=True)
    schedule = ReleaseScheduleProvenanceSerializer(read_only=True)
    stock = ReleaseStockProvenanceSerializer(read_only=True)


class ReleaseSerializer(OrgScopedModelSerializer):
    permit_code = serializers.CharField(source="permit_version.permit.code", read_only=True)
    quadrant_code = serializers.CharField(
        source="permit_version.permit.quadrant.code", read_only=True
    )
    lot_code = serializers.CharField(source="lot.code", read_only=True)
    release_device_code = serializers.CharField(source="release_device.code", read_only=True)
    provenance = ReleaseProvenanceSerializer(read_only=True)
    blocked_by = ReleaseBlockerSerializer(many=True, read_only=True, default=list)

    class Meta:
        model = Release
        fields = [
            "id",
            "declared_event_id",
            "permit_version",
            "permit_code",
            "quadrant_code",
            "lot",
            "lot_code",
            "release_device",
            "release_device_code",
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
