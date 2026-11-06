"""Scoped editor endpoints. Session cookie/CSRF and pinned bearer auth are inherited."""

from typing import Any, cast

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from core.filters import CodeLookupFilter
from core.pagination import StandardPagination
from core.views import OrgScopedViewSet
from geography.decisions.closure import close_quadrant, readiness
from geography.decisions.serializers import (
    QuadrantClosureSerializer,
    QuadrantReadinessSerializer,
    RevisionRequestSerializer,
)
from geography.history import (
    PointHistoryQuerySerializer,
    RevisionHistoryQuerySerializer,
    VersionHistoryQuerySerializer,
    filter_version_history,
)
from geography.models import Block, Quadrant, SamplingPoint
from geography.permissions import (
    QUADRANT_CLOSE,
    QUADRANT_PUBLISH,
    QUADRANT_READ,
    SAMPLING_POINT_CREATE,
)
from geography.selectors import block_suggestion, get_quadrant
from geography.serializers import (
    BlockCreateSerializer,
    BlockQuerySerializer,
    BlockSerializer,
    BlockSuggestionSerializer,
    BlockVersionSerializer,
    GeographyQuerySerializer,
    GeometryPublicationSerializer,
    PointPublicationSerializer,
    PointVersionSerializer,
    PointWriteSerializer,
    QuadrantCreateSerializer,
    QuadrantPublicationSerializer,
    QuadrantQuerySerializer,
    QuadrantSerializer,
    QuadrantVersionSerializer,
    QuadrantWriteSerializer,
    SamplingPointCreateSerializer,
    SamplingPointQuerySerializer,
    SamplingPointSerializer,
    SuggestionQuerySerializer,
)
from geography.services import (
    BlockCreation,
    BlockPublication,
    PointChange,
    PointCreation,
    PointResolution,
    QuadrantCreation,
    QuadrantPublication,
    create_block,
    create_quadrant,
    create_sampling_point,
    publish_block,
    publish_point,
    publish_quadrant,
)
from organizations.models import Center, Membership
from organizations.selectors import filter_by_effective_scope
from uploads.access import actor_from_request


class GeographyViewSet(OrgScopedViewSet):
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = StandardPagination
    code_lookup_field = "code"
    filter_backends = [CodeLookupFilter, SearchFilter, OrderingFilter]
    ordering_fields = ["code", "created_at"]
    ordering = ["code", "id"]
    search_fields = ["code"]
    query_serializer_class = GeographyQuerySerializer
    history_query_serializer_class: type[VersionHistoryQuerySerializer] = (
        RevisionHistoryQuerySerializer
    )

    @property
    def membership(self) -> Membership:
        return cast(Membership, self.request.membership)  # type: ignore[attr-defined]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return cast("QuerySet[Any]", self.__class__.queryset).none()
        return super().get_queryset()

    def get_serializer_context(self) -> dict[str, Any]:
        context = dict(super().get_serializer_context())
        if not getattr(self, "swagger_fake_view", False):
            query = self.query_serializer_class(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            context["captured_at"] = query.validated_data.get("captured_at")
        return context

    def _query(self) -> dict[str, Any]:
        query = self.query_serializer_class(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return dict(query.validated_data)

    def _history(self, versions: QuerySet[Any], serializer: type[Any]) -> Response:
        query = self.history_query_serializer_class(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        filtered = filter_version_history(versions, query.validated_data)
        page = self.paginate_queryset(filtered)
        return self.get_paginated_response(serializer(page, many=True).data)

    @extend_schema(parameters=[GeographyQuerySerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(parameters=[GeographyQuerySerializer])
    def retrieve(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().retrieve(request, *args, **kwargs)


@extend_schema_view(list=extend_schema(parameters=[QuadrantQuerySerializer]))
class QuadrantViewSet(GeographyViewSet):
    query_serializer_class = QuadrantQuerySerializer
    queryset = Quadrant.objects.select_related("center").all()
    serializer_class = QuadrantSerializer
    required_permissions = {
        "list": QUADRANT_READ,
        "retrieve": QUADRANT_READ,
        "create": QUADRANT_PUBLISH,
        "versions": QUADRANT_READ,
        "publish_version": QUADRANT_PUBLISH,
        "closure": QUADRANT_CLOSE,
        "close": QUADRANT_CLOSE,
    }

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset
        if center := self._query().get("center"):
            visible = filter_by_effective_scope(
                Center.objects.filter(organization=self.membership.organization),
                self.membership,
                self.required_permissions[self.action],
            )
            get_object_or_404(visible, pk=center)
            queryset = queryset.filter(center_id=center)
        return queryset

    @extend_schema(responses=QuadrantReadinessSerializer, filters=False)
    @action(detail=True, methods=["get"])
    def closure(self, request: Request, pk: str | None = None) -> Response:
        return Response(
            QuadrantReadinessSerializer(
                readiness(actor_from_request(request), self.get_object())
            ).data
        )

    @extend_schema(request=RevisionRequestSerializer, responses={201: QuadrantClosureSerializer})
    @action(detail=True, methods=["post"])
    def close(self, request: Request, pk: str | None = None) -> Response:
        quadrant = self.get_object()
        payload = RevisionRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        row = close_quadrant(
            actor_from_request(request), quadrant.pk, payload.validated_data["expected_revision"]
        )
        return Response(QuadrantClosureSerializer(row).data, status=201)

    @extend_schema(request=QuadrantCreateSerializer, responses={201: QuadrantSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = QuadrantCreateSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        quadrant, version = create_quadrant(
            fields["center"],
            QuadrantCreation(self.membership, fields["code"], fields["geometry"]),
        )
        return Response(
            QuadrantSerializer(quadrant, context={"written_version": version}).data, status=201
        )

    @extend_schema(
        parameters=[RevisionHistoryQuerySerializer],
        responses=QuadrantVersionSerializer(many=True),
        filters=False,
    )
    @action(detail=True, methods=["get"])
    def versions(self, request: Request, pk: str | None = None) -> Response:
        quadrant = self.get_object()
        return self._history(quadrant.versions.order_by("-revision"), QuadrantVersionSerializer)

    @extend_schema(request=QuadrantPublicationSerializer, responses={201: QuadrantWriteSerializer})
    @versions.mapping.post
    def publish_version(self, request: Request, pk: str | None = None) -> Response:
        quadrant = self.get_object()
        payload = QuadrantPublicationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        resolutions = tuple(
            PointResolution(**resolution) for resolution in fields["point_resolutions"]
        )
        version = publish_quadrant(
            quadrant,
            QuadrantPublication(
                self.membership, fields["expected_revision"], fields["geometry"], resolutions
            ),
        )
        return Response(
            QuadrantWriteSerializer(
                {"version": version, "spacing_warnings": version.spacing_warnings}
            ).data,
            status=201,
        )


@extend_schema_view(list=extend_schema(parameters=[BlockQuerySerializer]))
class BlockViewSet(GeographyViewSet):
    query_serializer_class = BlockQuerySerializer
    queryset = Block.objects.select_related("quadrant__center").all()
    serializer_class = BlockSerializer
    required_permissions = {
        "list": QUADRANT_READ,
        "retrieve": QUADRANT_READ,
        "create": QUADRANT_PUBLISH,
        "versions": QUADRANT_READ,
        "publish_version": QUADRANT_PUBLISH,
        "suggestion": QUADRANT_READ,
    }

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        if not getattr(self, "swagger_fake_view", False) and (
            quadrant := self._query().get("quadrant")
        ):
            parent = get_quadrant(self.membership, quadrant, self.required_permissions[self.action])
            queryset = queryset.filter(quadrant=parent)
        return queryset

    @extend_schema(request=BlockCreateSerializer, responses={201: BlockSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = BlockCreateSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        block, version = create_block(
            fields["quadrant"],
            BlockCreation(self.membership, fields["code"], fields["geometry"]),
        )
        return Response(
            BlockSerializer(block, context={"written_version": version}).data, status=201
        )

    @extend_schema(
        parameters=[RevisionHistoryQuerySerializer],
        responses=BlockVersionSerializer(many=True),
        filters=False,
    )
    @action(detail=True, methods=["get"])
    def versions(self, request: Request, pk: str | None = None) -> Response:
        return self._history(
            self.get_object().versions.order_by("-revision"), BlockVersionSerializer
        )

    @extend_schema(request=GeometryPublicationSerializer, responses={201: BlockVersionSerializer})
    @versions.mapping.post
    def publish_version(self, request: Request, pk: str | None = None) -> Response:
        block = self.get_object()
        payload = GeometryPublicationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        version = publish_block(
            block,
            BlockPublication(self.membership, fields["expected_revision"], fields["geometry"]),
        )
        return Response(BlockVersionSerializer(version).data, status=201)

    @extend_schema(
        parameters=[SuggestionQuerySerializer],
        responses=BlockSuggestionSerializer(many=True),
        filters=False,
    )
    @action(detail=False, methods=["get"], pagination_class=None)
    def suggestion(self, request: Request) -> Response:
        query = SuggestionQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        quadrant = get_quadrant(self.membership, query.validated_data["quadrant"], QUADRANT_READ)
        return Response(BlockSuggestionSerializer(block_suggestion(quadrant), many=True).data)


@extend_schema_view(list=extend_schema(parameters=[SamplingPointQuerySerializer]))
class SamplingPointViewSet(GeographyViewSet):
    query_serializer_class = SamplingPointQuerySerializer
    history_query_serializer_class = PointHistoryQuerySerializer
    queryset = SamplingPoint.objects.select_related("block__quadrant__center").all()
    serializer_class = SamplingPointSerializer
    required_permissions = {
        "list": QUADRANT_READ,
        "retrieve": QUADRANT_READ,
        "create": SAMPLING_POINT_CREATE,
        "versions": QUADRANT_READ,
        "publish_version": SAMPLING_POINT_CREATE,
    }

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset
        query = self._query()
        if quadrant := query.get("quadrant"):
            parent = get_quadrant(self.membership, quadrant, self.required_permissions[self.action])
            queryset = queryset.filter(block__quadrant=parent)
        if block := query.get("block"):
            allowed = filter_by_effective_scope(
                Block.objects.filter(organization=self.membership.organization),
                self.membership,
                self.required_permissions[self.action],
            )
            queryset = queryset.filter(block=get_object_or_404(allowed, pk=block))
        return queryset

    @extend_schema(request=SamplingPointCreateSerializer, responses={201: PointWriteSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = SamplingPointCreateSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        point, version, warnings = create_sampling_point(
            fields["block"], PointCreation(self.membership, fields["code"], fields["location"])
        )
        return Response(
            PointWriteSerializer(
                {"point": point, "spacing_warnings": warnings}, context={"written_version": version}
            ).data,
            status=201,
        )

    @extend_schema(
        parameters=[PointHistoryQuerySerializer],
        responses=PointVersionSerializer(many=True),
        filters=False,
    )
    @action(detail=True, methods=["get"])
    def versions(self, request: Request, pk: str | None = None) -> Response:
        return self._history(
            self.get_object().versions.order_by("-version"), PointVersionSerializer
        )

    @extend_schema(request=PointPublicationSerializer, responses={201: PointWriteSerializer})
    @versions.mapping.post
    def publish_version(self, request: Request, pk: str | None = None) -> Response:
        point = self.get_object()
        payload = PointPublicationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        fields = payload.validated_data
        version, warnings = publish_point(
            point, PointChange(self.membership, fields["expected_revision"], fields["location"])
        )
        return Response(
            PointWriteSerializer(
                {"point": version.point, "spacing_warnings": warnings},
                context={"written_version": version},
            ).data,
            status=201,
        )
