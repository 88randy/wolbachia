"""Regulatory endpoints (W57-W59) and the public portal (W69-W71). Thin: services do the work."""

from datetime import timedelta
from typing import Any

from django.http import Http404, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from core.exceptions import FieldValidationError
from core.pagination import StreamCursorPagination
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from organizations.models import Membership, Organization
from privacy import portal
from privacy.exports import build_export, to_csv, to_xlsx
from privacy.models import ArcoRequest, DataTransferAuthorization, PortalSettings
from privacy.permissions import (
    ARCO_MANAGE,
    ARCO_READ,
    EXPORT_RUN,
    PORTAL_MANAGE,
    TRANSFER_AUTHORIZATION_MANAGE,
    TRANSFER_AUTHORIZATION_READ,
)
from privacy.serializers import (
    ArcoCreateSerializer,
    ArcoRequestSerializer,
    ArcoResolveSerializer,
    ArcoUpdateSerializer,
    ExportQuerySerializer,
    PortalSettingsSerializer,
    TransferAuthorizationCreateSerializer,
    TransferAuthorizationSerializer,
    TransferRevocationSerializer,
)
from privacy.services import (
    TransferAuthorizationInput,
    create_transfer_authorization,
    revoke_transfer_authorization,
)
from uploads.access import actor_from_request

# [ASSUMPTION] legal response window; configurable per deployment until the client confirms.
ARCO_DUE_DAYS = 20


@method_decorator(never_cache, name="dispatch")
class TransferAuthorizationViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """W59: authorizations for personal data leaving the platform; revoke, never edit."""

    queryset = DataTransferAuthorization.objects.select_related("revocation").order_by(
        "-created_at", "-id"
    )
    serializer_class = TransferAuthorizationSerializer
    pagination_class = StreamCursorPagination
    http_method_names = ["get", "head", "post", "options"]
    required_permissions = {
        "list": TRANSFER_AUTHORIZATION_READ,
        "retrieve": TRANSFER_AUTHORIZATION_READ,
        "create": TRANSFER_AUTHORIZATION_MANAGE,
        "revoke": TRANSFER_AUTHORIZATION_MANAGE,
    }

    @extend_schema(
        request=TransferAuthorizationCreateSerializer,
        responses={201: TransferAuthorizationSerializer},
    )
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = TransferAuthorizationCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        created = create_transfer_authorization(
            actor_from_request(request),
            TransferAuthorizationInput(
                recipient_institution=data["recipient_institution"],
                center_id=data["center_id"],
                quadrant_id=data["quadrant_id"],
                valid_from=data["valid_from"],
                valid_until=data["valid_until"],
                reference=data["reference"],
                fields=tuple(data["fields"]),
            ),
        )
        created = self.get_queryset().get(pk=created.pk)
        return Response(TransferAuthorizationSerializer(created).data, status=201)

    @extend_schema(request=TransferRevocationSerializer, responses=TransferAuthorizationSerializer)
    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str | None = None) -> Response:
        payload = TransferRevocationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        authorization = self.get_object()
        revoke_transfer_authorization(
            actor_from_request(request), authorization.pk, payload.validated_data["reason"]
        )
        return Response(TransferAuthorizationSerializer(self.get_queryset().get(pk=pk)).data)


class ExportViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """W57: official export; personal columns come out empty without an authorization."""

    queryset = DataTransferAuthorization.objects.none()
    serializer_class = ExportQuerySerializer
    required_permissions = {"list": EXPORT_RUN}
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "export"
    pagination_class = None

    @extend_schema(
        parameters=[ExportQuerySerializer],
        responses={200: OpenApiResponse(description="CSV or XLSX file.")},
    )
    def list(self, request: Request, *args: object, **kwargs: object) -> HttpResponse:
        query = ExportQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data
        header, table = build_export(
            actor_from_request(request),
            data["dataset"],
            data["date_from"],
            data["date_to"],
            data.get("recipient_institution", ""),
        )
        name = f"{data['dataset']}_{data['date_from']}_{data['date_to']}"
        if data["file_format"] == "xlsx":
            content = to_xlsx(header, table)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            content = to_csv(header, table)
            content_type = "text/csv; charset=utf-8"
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{name}.{data["file_format"]}"'
        response["Cache-Control"] = "no-store"
        return response


@method_decorator(never_cache, name="dispatch")
class ArcoRequestViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """W58: register, track and resolve ARCO requests."""

    queryset = ArcoRequest.objects.all()
    serializer_class = ArcoRequestSerializer
    pagination_class = StreamCursorPagination
    http_method_names = ["get", "head", "post", "patch", "options"]
    required_permissions = {
        "list": ARCO_READ,
        "retrieve": ARCO_READ,
        "create": ARCO_MANAGE,
        "partial_update": ARCO_MANAGE,
        "resolve": ARCO_MANAGE,
    }

    def get_queryset(self) -> Any:  # noqa: ANN401
        rows = super().get_queryset().order_by("-received_on", "-id")
        params = self.request.query_params
        if params.get("status") in ArcoRequest.Status.values:
            rows = rows.filter(status=params["status"])
        if params.get("request_type") in ArcoRequest.Kind.values:
            rows = rows.filter(request_type=params["request_type"])
        return rows

    def _owner(self, owner_id: Any) -> User | None:  # noqa: ANN401
        if owner_id is None:
            return None
        membership = (
            Membership.objects.filter(organization=self.request.organization, user_id=owner_id)  # type: ignore[attr-defined]
            .select_related("user")
            .first()
        )
        if membership is None:
            raise FieldValidationError("owner_id", "invalid")
        return membership.user

    @extend_schema(request=ArcoCreateSerializer, responses={201: ArcoRequestSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = ArcoCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        received = data.get("received_on") or server_now().date()
        created = ArcoRequest.objects.create(
            organization=request.organization,  # type: ignore[attr-defined]
            created_by=request.user,
            request_type=data["request_type"],
            requester_reference=data["requester_reference"].strip(),
            received_on=received,
            due_on=received + timedelta(days=ARCO_DUE_DAYS),
            owner=self._owner(data["owner_id"]),
        )
        return Response(ArcoRequestSerializer(created).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=ArcoUpdateSerializer, responses=ArcoRequestSerializer)
    def partial_update(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = ArcoUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        item = self.get_object()
        if item.status in {ArcoRequest.Status.RESOLVED, ArcoRequest.Status.REJECTED}:
            raise FieldValidationError("status", "already_closed")
        data = payload.validated_data
        if "owner_id" in data:
            item.owner = self._owner(data["owner_id"])
        if "status" in data:
            item.status = data["status"]
        item.save()
        return Response(ArcoRequestSerializer(item).data)

    @extend_schema(request=ArcoResolveSerializer, responses=ArcoRequestSerializer)
    @action(detail=True, methods=["post"])
    def resolve(self, request: Request, pk: str | None = None) -> Response:
        payload = ArcoResolveSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        item = self.get_object()
        if item.status in {ArcoRequest.Status.RESOLVED, ArcoRequest.Status.REJECTED}:
            raise FieldValidationError("status", "already_closed")
        item.status = payload.validated_data["outcome"]
        item.resolution_note = payload.validated_data["resolution_note"].strip()
        item.resolved_at = server_now()
        item.save()
        return Response(ArcoRequestSerializer(item).data)


class PortalSettingsViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """Admin switch of the public portal: enabled or not, and which indicators."""

    queryset = PortalSettings.objects.all()
    serializer_class = PortalSettingsSerializer
    pagination_class = None
    http_method_names = ["get", "head", "put", "options"]
    required_permissions = {"list": PORTAL_MANAGE, "replace": PORTAL_MANAGE}

    @extend_schema(responses=PortalSettingsSerializer)
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        row = self.get_queryset().first()
        if row is None:
            return Response({"enabled": False, "indicators": [], "updated_at": None})
        return Response(PortalSettingsSerializer(row).data)

    @extend_schema(request=PortalSettingsSerializer, responses=PortalSettingsSerializer)
    @action(detail=False, methods=["put"], url_path="update")
    def replace(self, request: Request) -> Response:
        payload = PortalSettingsSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        row, _created = PortalSettings.objects.update_or_create(
            organization=request.organization,  # type: ignore[attr-defined]
            defaults={
                "enabled": payload.validated_data["enabled"],
                "indicators": sorted(set(payload.validated_data["indicators"])),
            },
        )
        return Response(PortalSettingsSerializer(row).data)


class PortalView(APIView):
    """Public, read-only, aggregates only. 404 when the organization has the portal off."""

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "portal"

    def _context(self, org_slug: str) -> tuple[Organization, list[str]]:
        organization = Organization.objects.filter(slug=org_slug).first()
        settings = portal.portal_settings(organization) if organization else None
        if organization is None or settings is None:
            raise Http404
        return organization, list(settings.indicators)

    def _respond(self, payload: dict[str, Any]) -> Response:
        return Response(payload, headers={"Cache-Control": "public, max-age=300"})


class PortalHomeView(PortalView):
    @extend_schema(responses={200: dict[str, Any]})
    def get(self, request: Request, org_slug: str) -> Response:
        organization, enabled = self._context(org_slug)
        summary = [code for code in enabled if code in portal.SUMMARY_INDICATORS]
        return self._respond(
            {
                "organization": {"name": organization.name, "slug": organization.slug},
                "enabled_indicators": enabled,
                "indicators": portal.indicators(organization, summary),
            }
        )


class PortalReleasesByWeekView(PortalView):
    @extend_schema(responses={200: dict[str, Any]})
    def get(self, request: Request, org_slug: str) -> Response:
        organization, enabled = self._context(org_slug)
        if "releases_by_week" not in enabled:
            raise Http404
        return self._respond(portal.releases_by_week(organization))


class PortalCoverageView(PortalView):
    @extend_schema(responses={200: dict[str, Any]})
    def get(self, request: Request, org_slug: str) -> Response:
        organization, enabled = self._context(org_slug)
        if "coverage" not in enabled:
            raise Http404
        return self._respond(portal.coverage(organization))
