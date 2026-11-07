"""One aggregate read/write surface; organization and all authority are server-owned."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from community.models import CommunityActivity
from community.policy import CREATE, READ, VOID
from community.selectors import active_totals, filter_activities, scoped_activities, zone_options
from community.serializers import (
    CommunityActivityPageSerializer,
    CommunityActivitySerializer,
    CommunityFilterSerializer,
    CommunityReceiptSerializer,
    CommunityZoneOptionSerializer,
    CommunityZoneOptionsFilterSerializer,
    CommunityZoneOptionsPageSerializer,
    CreateCommunityActivitySerializer,
    VoidCommunityActivitySerializer,
)
from community.services import ActivityCommand, create_activity, void_activity
from core.table_filters import TableOrderingFilter
from core.views import OrgScopedViewSetMixin
from uploads.access import actor_from_request


class CommunityActivityViewSet(
    OrgScopedViewSetMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet[CommunityActivity]
):
    serializer_class = CommunityActivitySerializer
    required_permissions = {
        "list": READ,
        "retrieve": READ,
        "create": CREATE,
        "void": VOID,
        "zone_options": READ,
    }
    filter_backends = [TableOrderingFilter]
    ordering = ["-activity_date", "-created_at", "id"]
    ordering_fields = ["activity_date", "created_at", "code", "attendance", "id"]

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        if self.action == "zone_options":
            permission = {"read": READ, "create": CREATE}.get(
                request.query_params.get("action", ""), READ
            )
            self.required_permissions = {
                **type(self).required_permissions,
                "zone_options": permission,
            }
        super().initial(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return CommunityActivity.objects.none()
        return scoped_activities(
            actor_from_request(self.request), self.required_permissions[self.action]
        )

    @extend_schema(
        parameters=[
            CommunityFilterSerializer,
            OpenApiParameter("page", int),
            OpenApiParameter("page_size", int),
        ],
        responses=CommunityActivityPageSerializer,
    )
    def list(self, request: Request) -> Response:
        query = CommunityFilterSerializer(
            data={
                key: value
                for key, value in request.query_params.items()
                if key in CommunityFilterSerializer().fields
            }
        )
        query.is_valid(raise_exception=True)
        selected = filter_activities(self.get_queryset(), query.validated_data)
        totals = active_totals(selected)
        if not query.validated_data["include_voided"]:
            selected = selected.filter(is_voided=False)
        page = self.paginate_queryset(self.filter_queryset(selected))
        answer = self.get_paginated_response(self.get_serializer(page, many=True).data)
        answer.data["totals"] = totals
        return answer

    @extend_schema(
        request=CreateCommunityActivitySerializer, responses={201: CommunityReceiptSerializer}
    )
    def create(self, request: Request) -> Response:
        body = CreateCommunityActivitySerializer(data=request.data)
        body.is_valid(raise_exception=True)
        values = dict(body.validated_data)
        identifier = values.pop("command_id")
        receipt = create_activity(ActivityCommand(actor_from_request(request), identifier, values))
        return Response(CommunityReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=VoidCommunityActivitySerializer, responses=CommunityReceiptSerializer)
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str | None = None) -> Response:
        body = VoidCommunityActivitySerializer(data=request.data)
        body.is_valid(raise_exception=True)
        activity = self.get_object()
        values = dict(body.validated_data)
        identifier = values.pop("command_id")
        receipt = void_activity(
            ActivityCommand(actor_from_request(request), identifier, values), activity.pk
        )
        return Response(CommunityReceiptSerializer(receipt).data)

    @extend_schema(
        parameters=[
            CommunityZoneOptionsFilterSerializer,
            OpenApiParameter("page", int),
            OpenApiParameter("page_size", int),
        ],
        responses=CommunityZoneOptionsPageSerializer,
    )
    @action(detail=False, methods=["get"], url_path="zone-options", filter_backends=[])
    def zone_options(self, request: Request) -> Response:
        query = CommunityZoneOptionsFilterSerializer(
            data={
                key: value
                for key, value in request.query_params.items()
                if key in CommunityZoneOptionsFilterSerializer().fields
            }
        )
        query.is_valid(raise_exception=True)
        permission = {"read": READ, "create": CREATE}[query.validated_data["action"]]
        rows = zone_options(actor_from_request(request), permission)
        for key in ("center", "quadrant"):
            if key in query.validated_data:
                field = "quadrant__center_id" if key == "center" else "quadrant_id"
                rows = rows.filter(**{field: query.validated_data[key]})
        if query.validated_data.get("search"):
            rows = rows.filter(code__icontains=query.validated_data["search"])
        return self.get_paginated_response(
            CommunityZoneOptionSerializer(self.paginate_queryset(rows), many=True).data
        )
