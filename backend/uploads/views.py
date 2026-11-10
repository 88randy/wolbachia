"""Private local PUTs and protected bytes; no storage work is wrapped in a view transaction."""

from typing import BinaryIO, cast
from uuid import UUID

from django.http import Http404, HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.authentication import DeviceBearerAuthentication
from core.authentication import ApiSessionAuthentication
from core.exceptions import FieldValidationError
from core.views import OrgScopedViewSetMixin
from uploads.access import actor_from_request
from uploads.limits import FIELD_UPLOAD, PDF_CONTENT_TYPE
from uploads.models import Upload
from uploads.serializers import (
    EvidenceUploadRequestSerializer,
    UploadAuthorizationSerializer,
    UploadFinalizeSerializer,
    UploadRenewalSerializer,
    UploadStatusSerializer,
)
from uploads.services import (
    LEASE_HEADER,
    UploadBody,
    UploadRequest,
    authorize_upload,
    download_attachment,
    finalize_upload,
    receive_upload,
    renew_upload,
)
from uploads.targets import AttachmentTarget


def _context(values: dict[str, object]) -> AttachmentTarget | None:
    target = values.get("context")
    if not isinstance(target, dict):
        return None
    return AttachmentTarget(target["kind"], target["id"])


def _identifier(value: str | None) -> UUID:
    try:
        return UUID(str(value))
    except ValueError:
        raise Http404 from None


class UploadViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = Upload.objects.none()
    serializer_class = UploadStatusSerializer
    authentication_classes = [DeviceBearerAuthentication, ApiSessionAuthentication]
    required_permissions = {
        "create": FIELD_UPLOAD,
        "renew": FIELD_UPLOAD,
        "finalize": FIELD_UPLOAD,
        "content": FIELD_UPLOAD,
    }
    http_method_names = ["post", "put", "options"]

    @extend_schema(
        request=EvidenceUploadRequestSerializer, responses={201: UploadAuthorizationSerializer}
    )
    def create(self, request: Request) -> Response:
        payload = EvidenceUploadRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        command = UploadRequest(
            values["content_type"],
            values["size_bytes"],
            values["sha256"],
            values.get("client_id"),
            _context(values),
        )
        return Response(authorize_upload(actor_from_request(request), command), status=201)

    @extend_schema(request=None, responses={200: UploadRenewalSerializer})
    @action(detail=True, methods=["post"])
    def renew(self, request: Request, pk: str | None = None) -> Response:
        return Response(renew_upload(actor_from_request(request), _identifier(pk)))

    @extend_schema(request=UploadFinalizeSerializer, responses={200: UploadStatusSerializer})
    @action(detail=True, methods=["post"])
    def finalize(self, request: Request, pk: str | None = None) -> Response:
        payload = UploadFinalizeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return Response(
            finalize_upload(
                actor_from_request(request), _identifier(pk), _context(payload.validated_data)
            )
        )

    @extend_schema(
        request={
            "image/jpeg": OpenApiTypes.BINARY,
            "image/png": OpenApiTypes.BINARY,
            "application/pdf": OpenApiTypes.BINARY,
        },
        parameters=[
            OpenApiParameter(LEASE_HEADER, OpenApiTypes.STR, OpenApiParameter.HEADER, required=True)
        ],
        responses={204: None},
    )
    @action(detail=True, methods=["put"])
    def content(self, request: Request, pk: str | None = None) -> Response:
        if request.stream is None:
            raise FieldValidationError("file", "upload_incomplete")
        body = UploadBody(
            _identifier(pk), request.headers.get(LEASE_HEADER, ""), cast(BinaryIO, request.stream)
        )
        receive_upload(actor_from_request(request), body)
        return Response(status=204)


class AttachmentViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = Upload.objects.none()
    serializer_class = UploadStatusSerializer
    authentication_classes = [DeviceBearerAuthentication, ApiSessionAuthentication]
    http_method_names = ["get", "head", "options"]

    def get_permissions(self) -> list[BasePermission]:
        if self.action == "download":
            # The closed registry checks the parent's current read action and paired scope.
            return [IsAuthenticated()]
        return cast(list[BasePermission], super().get_permissions())

    @extend_schema(
        responses={
            (200, "image/jpeg"): OpenApiTypes.BINARY,
            (200, "image/png"): OpenApiTypes.BINARY,
            (200, "application/pdf"): OpenApiTypes.BINARY,
        }
    )
    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk: str | None = None) -> HttpResponse:
        content, content_type = download_attachment(actor_from_request(request), _identifier(pk))
        response = HttpResponse(content, content_type=content_type)
        response["Cache-Control"] = "private, no-store"
        response["Pragma"] = "no-cache"
        response["X-Content-Type-Options"] = "nosniff"
        # PDFs may carry active content: never render them inline.
        disposition = "attachment" if content_type == PDF_CONTENT_TYPE else "inline"
        response["Content-Disposition"] = disposition
        return response
