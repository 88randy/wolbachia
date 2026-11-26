"""Planned release points for the web map editor (list, create, move)."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema, extend_schema_field, extend_schema_view
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.serializers import OrgScopedModelSerializer
from geography.models import Quadrant, ReleasePoint, ReleasePointVersion
from geography.permissions import QUADRANT_PUBLISH, QUADRANT_READ
from geography.release_points import (
    ReleasePointChange,
    ReleasePointCreation,
    create_release_point,
    move_release_point,
)
from geography.selectors import get_quadrant
from geography.serializers import (
    GeographyQuerySerializer,
    GeographyRelatedField,
    LocationField,
    PointPublicationSerializer,
)
from geography.views import GeographyViewSet


class ReleasePointVersionSerializer(OrgScopedModelSerializer):
    location = LocationField(read_only=True)

    class Meta:
        model = ReleasePointVersion
        fields = ["id", "point", "location", "version", "effective_from", "created_by"]
        read_only_fields = fields


class ReleasePointSerializer(OrgScopedModelSerializer):
    current_version = serializers.SerializerMethodField()

    @extend_schema_field(ReleasePointVersionSerializer(allow_null=True))
    def get_current_version(self, point: ReleasePoint) -> dict[str, Any] | None:
        if written_version := self.context.get("written_version"):
            return dict(ReleasePointVersionSerializer(written_version).data)
        version = point.versions.order_by("-version").first()
        return dict(ReleasePointVersionSerializer(version).data) if version else None

    class Meta:
        model = ReleasePoint
        fields = ["id", "code", "quadrant", "current_version", "created_by", "created_at"]
        read_only_fields = fields


class ReleasePointCreateSerializer(OrgScopedModelSerializer):
    quadrant = GeographyRelatedField(queryset=Quadrant.objects.all())
    location = LocationField()

    class Meta:
        model = ReleasePoint
        fields = ["quadrant", "code", "location"]
        validators: list[Any] = []


class ReleasePointQuerySerializer(GeographyQuerySerializer):
    quadrant = serializers.UUIDField(required=False)


@extend_schema_view(list=extend_schema(parameters=[ReleasePointQuerySerializer]))
class ReleasePointViewSet(GeographyViewSet):
    query_serializer_class = ReleasePointQuerySerializer
    queryset = ReleasePoint.objects.select_related("quadrant__center").all()
    serializer_class = ReleasePointSerializer
    required_permissions = {
        "list": QUADRANT_READ,
        "retrieve": QUADRANT_READ,
        "create": QUADRANT_PUBLISH,
        "move": QUADRANT_PUBLISH,
    }

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        if not getattr(self, "swagger_fake_view", False) and (
            quadrant := self._query().get("quadrant")
        ):
            parent = get_quadrant(self.membership, quadrant, self.required_permissions[self.action])
            queryset = queryset.filter(quadrant=parent)
        return queryset

    @extend_schema(request=ReleasePointCreateSerializer, responses={201: ReleasePointSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = ReleasePointCreateSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        point, version = create_release_point(
            fields["quadrant"],
            ReleasePointCreation(self.membership, fields["code"], fields["location"]),
        )
        return Response(
            ReleasePointSerializer(point, context={"written_version": version}).data, status=201
        )

    @extend_schema(request=PointPublicationSerializer, responses={201: ReleasePointSerializer})
    @action(detail=True, methods=["post"])
    def move(self, request: Request, pk: str | None = None) -> Response:
        point = self.get_object()
        payload = PointPublicationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        version = move_release_point(
            point,
            ReleasePointChange(self.membership, fields["expected_revision"], fields["location"]),
        )
        return Response(
            ReleasePointSerializer(point, context={"written_version": version}).data, status=201
        )
