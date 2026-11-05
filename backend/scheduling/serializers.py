"""Explicit B-12 request and response contracts; relations resolve in scoped services."""

from datetime import date
from typing import Any

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from scheduling.csv_import import SOURCES
from scheduling.models import RiskCategoryVersion, RiskImport


class PlanningDateField(serializers.DateField):
    def to_internal_value(self, value: Any) -> date:  # noqa: ANN401
        parsed = super().to_internal_value(value)
        if not date(2020, 1, 1) <= parsed <= date(2100, 1, 1):
            raise serializers.ValidationError(
                "Outside the supported planning dates.", code="out_of_range"
            )
        return parsed


class UploadRequestSerializer(serializers.Serializer[Any]):
    file = serializers.FileField()


class UploadResponseSerializer(serializers.Serializer[Any]):
    upload_id = serializers.UUIDField()
    sha256 = serializers.CharField()
    size = serializers.IntegerField()


class PreviewRequestSerializer(serializers.Serializer[Any]):
    upload_id = serializers.UUIDField()
    week = PlanningDateField(
        help_text="Local date in the organization's epi week; normalized to its start."
    )
    source = serializers.ChoiceField(choices=SOURCES)  # type: ignore[assignment]


class RevisionSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=0)


class ImportSerializer(OrgScopedModelSerializer):
    applied_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = RiskImport
        fields = (
            "id",
            "file_hash",
            "preview_rows",
            "errors",
            "source",
            "week_start",
            "revision",
            "applied_at",
            "created_by",
            "created_at",
        )
        read_only_fields = fields


class ApplicationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    risk_import = serializers.UUIDField(source="risk_import_id")
    applied_at = serializers.DateTimeField(source="created_at")
    applied_by = serializers.UUIDField(source="created_by_id")


class RiskSerializer(OrgScopedModelSerializer):
    code = serializers.CharField(source="block.code", read_only=True)
    revision = serializers.IntegerField(source="version", read_only=True)

    class Meta:
        model = RiskCategoryVersion
        fields = (
            "id",
            "block",
            "code",
            "week_start",
            "category",
            "source",
            "origin",
            "protocol",
            "revision",
            "created_by",
            "created_at",
        )
        read_only_fields = fields


class WeekQuerySerializer(serializers.Serializer[Any]):
    week = PlanningDateField()


class RiskQuerySerializer(WeekQuerySerializer):
    block = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    code = serializers.CharField(max_length=50, required=False)


class AssignmentQuerySerializer(serializers.Serializer[Any]):
    courier = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    center = serializers.UUIDField(required=False)
    code = serializers.CharField(max_length=50, required=False)
    ordering = serializers.ChoiceField(choices=("code", "-code", "load", "-load"), required=False)


class AssignmentRequestSerializer(RevisionSerializer):
    quadrant_id = serializers.UUIDField()
    courier_id = serializers.UUIDField(allow_null=True)


class BlockerSerializer(serializers.Serializer[Any]):
    code = serializers.CharField()


class AssignmentSerializer(serializers.Serializer[Any]):
    quadrant = serializers.UUIDField()
    code = serializers.CharField()
    center_id = serializers.UUIDField()
    courier = serializers.UUIDField(allow_null=True)
    revision = serializers.IntegerField()
    assignment_version = serializers.UUIDField(allow_null=True)
    load = serializers.IntegerField()
    target = serializers.IntegerField()
    blockers = BlockerSerializer(many=True)


class AssignmentResultSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    quadrant = serializers.UUIDField()
    courier = serializers.UUIDField(allow_null=True)
    revision = serializers.IntegerField()
    schedule_revision = serializers.IntegerField()
    valid_from = serializers.DateTimeField()


class ScheduleQuerySerializer(WeekQuerySerializer):
    courier = serializers.UUIDField(required=False)
    day = PlanningDateField(required=False)
    quadrant = serializers.UUIDField(required=False)
    code = serializers.CharField(
        max_length=80, required=False, help_text="Exact task code: point:action:YYYY-MM-DD."
    )


class TaskSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    point = serializers.UUIDField()
    organization_id = serializers.UUIDField(read_only=True)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField()
    action = serializers.ChoiceField(choices=("place", "check"))
    date = serializers.DateField()
    courier = serializers.UUIDField(allow_null=True)
    revision = serializers.IntegerField(
        help_text="Task ownership revision; reassign uses the page's organization schedule revision."
    )
    load = serializers.IntegerField()
    target = serializers.IntegerField()
    category = serializers.CharField(allow_null=True)
    source = serializers.CharField(allow_null=True)  # type: ignore[assignment]
    origin = serializers.UUIDField(allow_null=True)
    protocol = serializers.CharField(allow_null=True)
    is_completed = serializers.BooleanField()
    blockers = BlockerSerializer(many=True)


class LoadSerializer(serializers.Serializer[Any]):
    courier = serializers.UUIDField(allow_null=True)
    load = serializers.IntegerField()


@extend_schema_serializer(many=False)
class SchedulePageSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = TaskSerializer(many=True)
    revision = serializers.IntegerField()
    load = LoadSerializer(many=True)
    target = serializers.IntegerField(
        help_text="Daily target on the selected day or week start; task targets resolve their due dates."
    )


class GenerateResultSerializer(serializers.Serializer[Any]):
    created = serializers.IntegerField()
    revision = serializers.IntegerField()


class ReassignRequestSerializer(RevisionSerializer):
    task_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=200)
    courier = serializers.UUIDField()


class OwnershipResultSerializer(serializers.Serializer[Any]):
    task = serializers.UUIDField()
    courier = serializers.UUIDField()
    revision = serializers.IntegerField()


class ReassignResultSerializer(serializers.Serializer[Any]):
    revision = serializers.IntegerField()
    owners = OwnershipResultSerializer(many=True)
