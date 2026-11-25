"""Permission-scoped training dataset jobs; no mutable or destructive endpoints."""

from uuid import UUID

from django.db.models import QuerySet
from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle

from core.pagination import StandardPagination
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
)
from lab.independent_qa.services import numeric_read_transaction
from lab.models import EggAnnotationExport
from lab.permissions import ANNOTATION_EXPORT
from uploads.access import actor_from_request


class EggAnnotationExportViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[EggAnnotationExport],
):
    queryset = EggAnnotationExport.objects.none()
    serializer_class = EggAnnotationExportSerializer
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "post", "options"]
    throttle_scope = "export"
    required_permissions = {
        action: ANNOTATION_EXPORT for action in ("list", "retrieve", "create", "download")
    }

    def get_throttles(self) -> list[BaseThrottle]:
        # Status polling must not spend the low hourly archive-generation allowance.
        return [ScopedRateThrottle()] if self.action == "create" else super().get_throttles()

    def get_queryset(self) -> QuerySet[EggAnnotationExport]:
        if getattr(self, "swagger_fake_view", False):
            return EggAnnotationExport.objects.none()
        return export_rows(actor_from_request(self.request))

    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        actor = actor_from_request(request)
        with numeric_read_transaction(actor):
            page = self.paginate_queryset(self.get_queryset()) or []
            publish_export_totals(actor, page)
            return self.get_paginated_response(
                self.get_serializer([export_projection(export) for export in page], many=True).data
            )

    def retrieve(self, request: Request, *args: object, **kwargs: object) -> Response:
        with numeric_read_transaction(actor_from_request(request)):
            export = self.get_object()
            publish_export_totals(actor_from_request(request), [export])
            return Response(self.get_serializer(export_projection(export)).data)

    @extend_schema(
        request=EggAnnotationExportCreateSerializer, responses={201: EggAnnotationExportSerializer}
    )
    def create(self, request: Request) -> Response:
        payload = EggAnnotationExportCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        export = create_annotation_export(actor_from_request(request), payload.validated_data)
        with numeric_read_transaction(actor_from_request(request)):
            publish_export_totals(actor_from_request(request), [export])
            return Response(self.get_serializer(export_projection(export)).data, status=201)

    @extend_schema(responses={(200, "application/zip"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk: str | None = None) -> FileResponse:
        # Resolve through the same tenant/snapshot queryset before opening any private bytes.
        export = self.get_object()
        archive = open_annotation_export(actor_from_request(request), UUID(str(export.pk)))
        response = FileResponse(
            archive,
            as_attachment=True,
            filename=f"aedesvision-{export.pk}.zip",
            content_type="application/zip",
        )
        response["Cache-Control"] = "private, no-store"
        response["Pragma"] = "no-cache"
        response["X-Content-Type-Options"] = "nosniff"
        return response
