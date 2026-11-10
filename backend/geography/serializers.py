"""Thin geography contracts; authored versions and coded warnings are read-only."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from core.fields import OrgScopedPrimaryKeyRelatedField
from core.serializers import OrgScopedModelSerializer
from geography.geometry import validate_location, validate_polygon
from geography.models import (
    Block,
    BlockVersion,
    ExcludedPointResolution,
    PointVersion,
    Quadrant,
    QuadrantVersion,
    SamplingPoint,
)
from geography.selectors import block_version_at, point_version_at, quadrant_version_at
from organizations.models import Center
from organizations.selectors import filter_by_effective_scope


@extend_schema_field(
    {
        "type": "object",
        "required": ["type", "coordinates"],
        "properties": {
            "type": {"type": "string", "enum": ["Polygon"]},
            "coordinates": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "number"},
                        "minItems": 2,
                        "maxItems": 2,
                    },
                    "minItems": 4,
                },
                "minItems": 1,
            },
        },
    }
)
class PolygonField(serializers.JSONField):
    def to_internal_value(self, value: object) -> dict[str, Any]:
        try:
            return validate_polygon(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error), code="invalid_geometry") from error


@extend_schema_field({"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2})
class LocationField(serializers.JSONField):
    def to_internal_value(self, value: object) -> list[float]:  # type: ignore[override]  # DRF stub narrows JSON arrays to object arrays
        try:
            return validate_location(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error), code="invalid_location") from error


class GeographyRelatedField(OrgScopedPrimaryKeyRelatedField):
    def get_queryset(self) -> QuerySet[Any] | None:
        queryset = super().get_queryset()
        request = self.context.get("request")
        if queryset is None or request is None:
            return queryset
        view = self.context["view"]
        permission = view.required_permissions.get(view.action)
        if not permission:
            return queryset.none()
        return filter_by_effective_scope(queryset, request.membership, permission)

    def to_internal_value(self, value: object) -> Any:  # noqa: ANN401 -- DRF relation protocol
        try:
            return super().to_internal_value(value)
        except serializers.ValidationError as error:
            raise NotFound from error


class ExcludedPointResolutionSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ExcludedPointResolution
        fields = [
            "id",
            "point",
            "point_version",
            "decision",
            "evidence",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class QuadrantVersionSerializer(OrgScopedModelSerializer):
    geometry = PolygonField(read_only=True)
    point_resolutions = ExcludedPointResolutionSerializer(many=True, read_only=True)

    class Meta:
        model = QuadrantVersion
        fields = [
            "id",
            "quadrant",
            "geometry",
            "revision",
            "effective_from",
            "created_by",
            "created_at",
            "point_resolutions",
        ]
        read_only_fields = fields


class BlockVersionSerializer(OrgScopedModelSerializer):
    geometry = PolygonField(read_only=True)

    class Meta:
        model = BlockVersion
        fields = [
            "id",
            "block",
            "geometry",
            "revision",
            "effective_from",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class PointVersionSerializer(OrgScopedModelSerializer):
    location = LocationField(read_only=True)

    class Meta:
        model = PointVersion
        fields = [
            "id",
            "point",
            "location",
            "version",
            "effective_from",
            "is_retired",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class QuadrantSerializer(OrgScopedModelSerializer):
    current_version = serializers.SerializerMethodField()

    @extend_schema_field(QuadrantVersionSerializer(allow_null=True))
    def get_current_version(self, quadrant: Quadrant) -> dict[str, Any] | None:
        if written_version := self.context.get("written_version"):
            return dict(QuadrantVersionSerializer(written_version).data)
        captured_at = self.context.get("captured_at")
        version = (
            quadrant_version_at(quadrant, captured_at)
            if captured_at
            else quadrant.versions.order_by("-revision").first()
        )
        return dict(QuadrantVersionSerializer(version).data) if version else None

    class Meta:
        model = Quadrant
        fields = ["id", "code", "center", "current_version", "created_by", "created_at"]
        read_only_fields = fields


class BlockSerializer(OrgScopedModelSerializer):
    current_version = serializers.SerializerMethodField()

    @extend_schema_field(BlockVersionSerializer(allow_null=True))
    def get_current_version(self, block: Block) -> dict[str, Any] | None:
        if written_version := self.context.get("written_version"):
            return dict(BlockVersionSerializer(written_version).data)
        captured_at = self.context.get("captured_at")
        version = (
            block_version_at(block, captured_at)
            if captured_at
            else block.versions.order_by("-revision").first()
        )
        return dict(BlockVersionSerializer(version).data) if version else None

    class Meta:
        model = Block
        fields = ["id", "code", "quadrant", "current_version", "created_by", "created_at"]
        read_only_fields = fields


class SamplingPointSerializer(OrgScopedModelSerializer):
    current_version = serializers.SerializerMethodField()
    block_code = serializers.CharField(source="block.code", read_only=True)

    @extend_schema_field(PointVersionSerializer(allow_null=True))
    def get_current_version(self, point: SamplingPoint) -> dict[str, Any] | None:
        if written_version := self.context.get("written_version"):
            return dict(PointVersionSerializer(written_version).data)
        captured_at = self.context.get("captured_at")
        version = (
            point_version_at(point, captured_at)
            if captured_at
            else point.versions.order_by("-version").first()
        )
        return dict(PointVersionSerializer(version).data) if version else None

    class Meta:
        model = SamplingPoint
        fields = [
            "id",
            "code",
            "block",
            "block_code",
            "current_version",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class QuadrantCreateSerializer(OrgScopedModelSerializer):
    center = GeographyRelatedField(queryset=Center.objects.all())
    geometry = PolygonField()

    class Meta:
        model = Quadrant
        fields = ["center", "code", "geometry"]
        validators: list[Any] = []


class BlockCreateSerializer(OrgScopedModelSerializer):
    quadrant = GeographyRelatedField(queryset=Quadrant.objects.all())
    geometry = PolygonField()

    class Meta:
        model = Block
        fields = ["quadrant", "code", "geometry"]
        validators: list[Any] = []


class SamplingPointCreateSerializer(OrgScopedModelSerializer):
    block = GeographyRelatedField(queryset=Block.objects.select_related("quadrant"))
    location = LocationField()

    class Meta:
        model = SamplingPoint
        fields = ["block", "code", "location"]
        validators: list[Any] = []


class PointResolutionSerializer(serializers.Serializer[Any]):
    point = serializers.UUIDField()
    decision = serializers.ChoiceField(choices=["keep", "move", "remove"])
    evidence = serializers.CharField(max_length=1000)
    location = LocationField(required=False)


class GeometryPublicationSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=0)
    geometry = PolygonField()


class QuadrantPublicationSerializer(GeometryPublicationSerializer):
    point_resolutions = PointResolutionSerializer(many=True, required=False, default=list)


class PointPublicationSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=1)
    location = LocationField()


class GeographyQuerySerializer(serializers.Serializer[Any]):
    captured_at = serializers.DateTimeField(required=False)


class QuadrantQuerySerializer(GeographyQuerySerializer):
    center = serializers.UUIDField(required=False)


class BlockQuerySerializer(GeographyQuerySerializer):
    quadrant = serializers.UUIDField(required=False)


class SamplingPointQuerySerializer(GeographyQuerySerializer):
    quadrant = serializers.UUIDField(required=False)
    block = serializers.UUIDField(required=False)


class SuggestionQuerySerializer(serializers.Serializer[Any]):
    quadrant = serializers.UUIDField()


class SpacingWarningSerializer(serializers.Serializer[Any]):
    code = serializers.CharField()
    point = serializers.UUIDField()
    distance_m = serializers.FloatField()
    minimum_m = serializers.FloatField()


class PointWriteSerializer(serializers.Serializer[Any]):
    point = SamplingPointSerializer()
    spacing_warnings = SpacingWarningSerializer(many=True)


class QuadrantWriteSerializer(serializers.Serializer[Any]):
    version = QuadrantVersionSerializer()
    spacing_warnings = SpacingWarningSerializer(many=True)


class BlockSuggestionSerializer(serializers.Serializer[Any]):
    quadrant = serializers.UUIDField()
    geometry = PolygonField()
    points = serializers.ListField(child=LocationField(), min_length=4, max_length=4)
    requires_review = serializers.BooleanField()
