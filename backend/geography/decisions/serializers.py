"""B33 request contracts and immutable authored results."""

from typing import Any
from uuid import UUID

from rest_framework import serializers

from geography.decisions.models import (
    QuadrantClosure,
    ThirdPartyIntervention,
)
from geography.serializers import PointVersionSerializer
from ovitraps.lifecycle.models import RelocationDecision


class RevisionRequestSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=0)


class RelocationDecisionRequestSerializer(RevisionRequestSerializer):
    reason = serializers.CharField(max_length=1000, trim_whitespace=False)


class RelocationDecisionSerializer(serializers.ModelSerializer[RelocationDecision]):
    class Meta:
        model = RelocationDecision
        fields = [
            "id",
            "proposal",
            "event",
            "decision",
            "reason",
            "revision",
            "decided_at",
            "published_point_version",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class NextDayTaskSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField(source="task_id")
    code = serializers.CharField(source="task.code")
    due_date = serializers.DateField(source="task.due_date")


class RelocationDecisionResultSerializer(serializers.Serializer[Any]):
    decision = RelocationDecisionSerializer()
    point_version = PointVersionSerializer(allow_null=True)
    next_day_task = NextDayTaskSerializer(allow_null=True)
    warnings = serializers.ListField(child=serializers.DictField())


class QuadrantClosureSerializer(serializers.ModelSerializer[QuadrantClosure]):
    revision = serializers.IntegerField(source="quadrant_version.revision", read_only=True)

    class Meta:
        model = QuadrantClosure
        fields = [
            "id",
            "quadrant_version",
            "closed_at",
            "revision",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ClosureBlockerSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField()
    permission = serializers.CharField()
    id = serializers.CharField(required=False)
    link = serializers.CharField(allow_blank=True)


class QuadrantReadinessSerializer(serializers.Serializer[Any]):
    quadrant_id = serializers.UUIDField()
    quadrant_version_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    is_closed = serializers.BooleanField()
    can_close = serializers.BooleanField()
    blockers = ClosureBlockerSerializer(many=True)
    closure = QuadrantClosureSerializer(allow_null=True)


class InterventionRequestSerializer(serializers.Serializer[Any]):
    type = serializers.UUIDField()
    product = serializers.CharField(max_length=200)
    source = serializers.CharField(max_length=200)  # type: ignore[assignment]  # Required wire name overlaps DRF Field.source.
    blocks = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    other_text = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=1000
    )


class InterventionSerializer(serializers.ModelSerializer[ThirdPartyIntervention]):
    blocks = serializers.SerializerMethodField()

    def get_blocks(self, obj: ThirdPartyIntervention) -> list[UUID]:
        return [link.block_id for link in obj.blocks.all()]

    class Meta:
        model = ThirdPartyIntervention
        fields = [
            "id",
            "type",
            "type_code",
            "type_label",
            "product",
            "source",
            "blocks",
            "date_from",
            "date_to",
            "other_text",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class InterventionQuerySerializer(serializers.Serializer[Any]):
    type = serializers.UUIDField(required=False)
    block = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
