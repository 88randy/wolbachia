"""Default-deny, paired-scope API; writes delegate to regulatory services."""

from functools import cached_property
from typing import Any

from django.db.models import QuerySet
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.author_names import (
    _CACHE_KEY as AUTHOR_NAMES_CACHE_KEY,  # noqa: PLC2701 -- one shared cache
)
from core.author_names import resolve_author_names
from core.filters import CodeLookupFilter
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from releases.documents import permit_document_response
from releases.models import Permit, PermitType, Release, ReleaseDevice
from releases.permissions import PERMIT_MANAGE, PERMIT_SUSPEND, RELEASE_READ
from releases.selectors import (
    CURRENT_VERSIONS_ATTR,
    filter_context,
    scoped_devices,
    scoped_permits,
    scoped_releases,
    with_current_device_status,
    with_current_permit_version,
)
from releases.serializers import (
    PermitSerializer,
    PermitSuspensionSerializer,
    PermitSuspensionWriteSerializer,
    PermitTypeSerializer,
    PermitTypeWriteSerializer,
    PermitVersionAppendSerializer,
    PermitVersionSerializer,
    PermitWriteSerializer,
    ReleaseContextFilterSerializer,
    ReleaseDeviceSerializer,
    ReleaseDeviceStatusSerializer,
    ReleaseDeviceStatusWriteSerializer,
    ReleaseDeviceWriteSerializer,
    ReleaseScheduleSerializer,
    ReleaseScheduleWriteSerializer,
    ReleaseSerializer,
)
from releases.services import (
    append_permit_version,
    change_release_device_status,
    create_permit,
    create_permit_type,
    create_release_device,
    suspend_permit,
)
from uploads.access import actor_from_request


class ReleaseReadViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [CodeLookupFilter, TableSearchFilter, TableOrderingFilter]
    ordering = ["-created_at"]
    ordering_fields = ["created_at", "id"]
    search_fields: list[str] = []

    @extend_schema(parameters=[ReleaseContextFilterSerializer])
    def list(self, request: Request) -> Response:
        query = ReleaseContextFilterSerializer(
            data={
                key: value
                for key, value in request.query_params.items()
                if key in {"center", "quadrant"}
            }
        )
        query.is_valid(raise_exception=True)
        rows = self.filter_queryset(filter_context(self.get_queryset(), query.validated_data))
        return self.get_paginated_response(
            self.get_serializer(self.paginate_queryset(rows), many=True).data
        )


class PermitTypeViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = PermitType.objects.all().order_by("code", "id")
    serializer_class = PermitTypeSerializer
    required_permissions = {"list": PERMIT_MANAGE, "create": PERMIT_MANAGE}
    http_method_names = ["get", "post", "head", "options"]
    code_lookup_field = "code"
    filter_backends = [CodeLookupFilter, TableSearchFilter, TableOrderingFilter]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at", "id"]
    ordering = ["code"]

    @extend_schema(request=PermitTypeWriteSerializer, responses={201: PermitTypeSerializer})
    def create(self, request: Request) -> Response:
        body = PermitTypeWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = create_permit_type(actor_from_request(request), body.validated_data)
        return Response(PermitTypeSerializer(row).data, status=status.HTTP_201_CREATED)


class PermitViewSet(ReleaseReadViewSet):
    @cached_property
    def author_cache(self) -> dict[str, str]:
        return {}

    def get_serializer_context(self) -> dict[str, Any]:
        return {**super().get_serializer_context(), AUTHOR_NAMES_CACHE_KEY: self.author_cache}

    def paginate_queryset(self, queryset: Any) -> list[Any] | None:  # noqa: ANN401 -- DRF hook
        """Resolve the authors of the permits, their suspensions and their current versions in one
        go, so the nested serializers read names from the shared cache instead of querying."""
        page = super().paginate_queryset(queryset)
        if page and self.action == "list":
            authors: set[object] = set()
            for permit in page:
                authors.add(permit.created_by_id)
                suspension = getattr(permit, "suspension", None)
                authors.add(None if suspension is None else suspension.created_by_id)
                for version in getattr(permit, CURRENT_VERSIONS_ATTR, ()):
                    authors.add(version.created_by_id)
            known = resolve_author_names(page[0].organization_id, authors)
            for author in authors:
                if author:
                    self.author_cache[str(author)] = known.get(str(author), "")
        return page

    queryset = Permit.objects.none()
    serializer_class = PermitSerializer
    required_permissions = {
        "list": PERMIT_MANAGE,
        "retrieve": PERMIT_MANAGE,
        "create": PERMIT_MANAGE,
        "versions": PERMIT_MANAGE,
        "document": PERMIT_MANAGE,
        "suspend": PERMIT_SUSPEND,
        "schedule": "schedule.manage",
    }
    code_lookup_field = "code"
    search_fields = ["code"]
    ordering_fields = ["code", "created_at", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Permit.objects.none()
        rows = scoped_permits(
            actor_from_request(self.request), self.required_permissions[self.action]
        )
        if self.action in {"list", "retrieve"}:
            rows = with_current_permit_version(rows)
        return rows

    @extend_schema(request=PermitWriteSerializer, responses={201: PermitSerializer})
    def create(self, request: Request) -> Response:
        body = PermitWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = create_permit(actor_from_request(request), body.validated_data)
        return Response(PermitSerializer(row).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=PermitVersionAppendSerializer, responses={201: PermitVersionSerializer})
    @action(detail=True, methods=["post"], filter_backends=[])
    def versions(self, request: Request, pk: str | None = None) -> Response:
        body = PermitVersionAppendSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = append_permit_version(
            actor_from_request(request), self.get_object().pk, body.validated_data
        )
        return Response(PermitVersionSerializer(row).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        responses={
            (200, "image/jpeg"): OpenApiTypes.BINARY,
            (200, "image/png"): OpenApiTypes.BINARY,
            (200, "application/pdf"): OpenApiTypes.BINARY,
        }
    )
    @action(
        detail=True,
        methods=["get"],
        url_path=r"versions/(?P<revision>[0-9]+)/document",
        filter_backends=[],
    )
    def document(
        self, request: Request, pk: str | None = None, revision: str = "1"
    ) -> HttpResponse:
        permit = self.get_object()
        return permit_document_response(actor_from_request(request), permit.pk, int(revision))

    @extend_schema(request=PermitSuspensionWriteSerializer, responses=PermitSuspensionSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def suspend(self, request: Request, pk: str | None = None) -> Response:
        body = PermitSuspensionWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = suspend_permit(actor_from_request(request), self.get_object().pk, body.validated_data)
        return Response(PermitSuspensionSerializer(row).data)

    @extend_schema(
        request=ReleaseScheduleWriteSerializer, responses={201: ReleaseScheduleSerializer}
    )
    @action(detail=True, methods=["post"], filter_backends=[])
    def schedule(self, request: Request, pk: str | None = None) -> Response:
        from releases.planning import schedule_release

        body = ReleaseScheduleWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = schedule_release(
            actor_from_request(request), self.get_object().pk, body.validated_data
        )
        return Response(ReleaseScheduleSerializer(row).data, status=status.HTTP_201_CREATED)


class ReleaseDeviceViewSet(ReleaseReadViewSet):
    queryset = ReleaseDevice.objects.none()
    serializer_class = ReleaseDeviceSerializer
    required_permissions = {
        "list": RELEASE_READ,
        "retrieve": RELEASE_READ,
        "create": PERMIT_MANAGE,
        "change_status": PERMIT_MANAGE,
    }
    code_lookup_field = "code"
    search_fields = ["code"]
    ordering_fields = ["code", "created_at", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return ReleaseDevice.objects.none()
        rows = scoped_devices(
            actor_from_request(self.request), self.required_permissions[self.action]
        )
        if self.action in {"list", "retrieve"}:
            rows = with_current_device_status(rows)
        return rows

    @extend_schema(request=ReleaseDeviceWriteSerializer, responses={201: ReleaseDeviceSerializer})
    def create(self, request: Request) -> Response:
        body = ReleaseDeviceWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = create_release_device(actor_from_request(request), body.validated_data)
        return Response(ReleaseDeviceSerializer(row).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request=ReleaseDeviceStatusWriteSerializer, responses=ReleaseDeviceStatusSerializer
    )
    @action(detail=True, methods=["post"], url_path="status", filter_backends=[])
    def change_status(self, request: Request, pk: str | None = None) -> Response:
        body = ReleaseDeviceStatusWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row = change_release_device_status(
            actor_from_request(request), self.get_object().pk, body.validated_data
        )
        return Response(ReleaseDeviceStatusSerializer(row).data)


class ReleaseViewSet(ReleaseReadViewSet):
    queryset = Release.objects.none()
    serializer_class = ReleaseSerializer
    required_permissions = {"list": RELEASE_READ, "retrieve": RELEASE_READ}
    code_lookup_field = "code"

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Release.objects.none()
        return scoped_releases(actor_from_request(self.request))
