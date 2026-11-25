"""Permission-scoped training dataset jobs; no mutable or destructive endpoints."""

from functools import cached_property
from typing import cast
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404, StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle

from accounts.models import DeviceSession, User
from accounts.request_context import requested_organization_slug
from core.pagination import StandardPagination
from core.session_identity import remember_active_organization
from core.views import OrgScopedViewSetMixin
from lab.annotation_export_serializers import (
    EggAnnotationExportCreateSerializer,
    EggAnnotationExportSerializer,
)
from lab.annotation_exports import (
    create_annotation_export,
    export_projection,
    export_rows,
    open_annotation_export,
    publish_export_totals,
    resolve_download_membership,
)
from lab.independent_qa.services import numeric_read_transaction
from lab.models import EggAnnotationExport
from lab.permissions import ANNOTATION_EXPORT
from organizations.exceptions import OrganizationHeaderRequiredError
from organizations.selectors import resolve_active_membership
from uploads.access import UploadActor, actor_from_request


class EggAnnotationExportViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[EggAnnotationExport],
):
    queryset = EggAnnotationExport.objects.none()
    serializer_class = EggAnnotationExportSerializer
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "options"]
    throttle_scope = "export"
    required_permissions = {
        action: ANNOTATION_EXPORT for action in ("list", "retrieve", "create", "download")
    }

    def get_throttles(self) -> list[BaseThrottle]:
        # Status polling must not spend the low hourly archive-generation allowance.
        if self.action in {"create", "download"}:
            self.throttle_scope = "export_download" if self.action == "download" else "export"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        if (
            self.action != "download"
            or not request.user.is_authenticated
            or isinstance(request.auth, DeviceSession)
            or requested_organization_slug(request) is not None
        ):
            super().initial(request, *args, **kwargs)
            return
        # Native cookie navigation cannot send headers; the object chooses only a current membership.
        user = cast(User, request.user)
        try:
            member = resolve_active_membership(user, None)
        except OrganizationHeaderRequiredError:
            member = resolve_download_membership(user, self.export_identifier)
        request.membership = member  # type: ignore[attr-defined]
        request.organization = member.organization  # type: ignore[attr-defined]
        remember_active_organization(request, member.organization_id)
        viewsets.GenericViewSet.initial(self, request, *args, **kwargs)

    @cached_property
    def export_actor(self) -> UploadActor:
        return actor_from_request(self.request)

    @cached_property
    def export_identifier(self) -> UUID:
        try:
            return UUID(str(self.kwargs["pk"]))
        except ValueError as error:
            raise Http404 from error

    def get_queryset(self) -> QuerySet[EggAnnotationExport]:
        if getattr(self, "swagger_fake_view", False):
            return EggAnnotationExport.objects.none()
        return export_rows(self.export_actor)

    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        actor = self.export_actor
        with numeric_read_transaction(actor):
            page = self.paginate_queryset(self.get_queryset()) or []
            publish_export_totals(actor, page)
            return self.get_paginated_response(
                self.get_serializer([export_projection(export) for export in page], many=True).data
            )

    def retrieve(self, request: Request, *args: object, **kwargs: object) -> Response:
        actor = self.export_actor
        with numeric_read_transaction(actor):
            export = self.get_object()
            publish_export_totals(actor, [export])
            return Response(self.get_serializer(export_projection(export)).data)

    @extend_schema(
        request=EggAnnotationExportCreateSerializer, responses={201: EggAnnotationExportSerializer}
    )
    def create(self, request: Request) -> Response:
        payload = EggAnnotationExportCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        actor = self.export_actor
        export = create_annotation_export(actor, payload.validated_data)
        return Response(self.get_serializer(export_projection(export)).data, status=201)

    @extend_schema(responses={(200, "application/zip"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk: str | None = None) -> StreamingHttpResponse:
        stream = open_annotation_export(self.export_actor, self.export_identifier)
        response = StreamingHttpResponse(stream, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="aedesvision-{pk}.zip"'
        response["Content-Length"] = str(stream.receipt.size_bytes)
        response["Cache-Control"] = "private, no-store"
        response["Pragma"] = "no-cache"
        response["X-Content-Type-Options"] = "nosniff"
        return response
