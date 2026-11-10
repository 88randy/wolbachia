"""`/api/v1/platform/`: the ONLY cross-organization surface of the API.

Every endpoint requires a signed-in web session (no device tokens) whose user holds an active
platform role (`403 permission_denied` otherwise) and is rate limited per user. Organizations are
addressed by slug. Nothing here returns organization business data.
"""

from typing import Any, cast

from django.db.models import QuerySet
from django.http import HttpResponse
from django.utils.cache import patch_vary_headers
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle
from rest_framework.views import APIView

from accounts.models import User
from accounts.request_context import requested_organization_slug
from core.authentication import ApiSessionAuthentication
from core.exceptions import DomainError
from core.session_identity import remember_active_organization
from organizations.logo import validate_logo
from organizations.models import Organization
from organizations.selectors import resolve_active_membership
from organizations.services import OrganizationSpec
from platform_admin import selectors, services
from platform_admin.permissions import IsPlatformAdmin, PlatformReadThrottle, PlatformWriteThrottle
from platform_admin.serializers import (
    AdminInputSerializer,
    AvailabilityQuerySerializer,
    AvailabilitySerializer,
    CenterInputSerializer,
    CreatedAdminSerializer,
    DefaultsResultSerializer,
    LogoInputSerializer,
    PlatformCenterSerializer,
    PlatformOrganizationDetailSerializer,
    PlatformOrganizationQuerySerializer,
    PlatformOrganizationSerializer,
    ProvisionResponseSerializer,
    ProvisionSerializer,
    ReasonSerializer,
)

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


class PlatformViewMixin:
    """Per-user read/write throttles and the identity attestation of platform views."""

    def get_throttles(self) -> list[BaseThrottle]:
        request = cast(Request, getattr(self, "request", None))
        if request is not None and request.method not in SAFE_METHODS:
            return [PlatformReadThrottle(), PlatformWriteThrottle()]
        return [PlatformReadThrottle()]

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        # Attestation only (X-Session-Identity must match `/me/`); the membership is never used
        # to read or authorize anything here.
        organization_id = None
        if request.user.is_authenticated:
            try:
                membership = resolve_active_membership(
                    request.user,  # type: ignore[arg-type]
                    requested_organization_slug(request),
                )
                organization_id = membership.organization_id
            except DomainError:
                organization_id = None
        remember_active_organization(request, organization_id)
        super().initial(request, *args, **kwargs)  # type: ignore[misc]


def _actor(request: Request) -> User:
    return cast(User, request.user)


def _detail(organization: Organization) -> dict[str, Any]:
    return {
        "slug": organization.slug,
        "name": organization.name,
        "country": organization.country,
        "timezone": organization.timezone,
        "languages": list(organization.languages),
        "epi_week": organization.epi_week,
        "is_active": organization.is_active,
        "has_logo": bool(organization.logo_content),
        "created_at": organization.created_at,
        "centers": selectors.organization_centers(organization),
        "admins": selectors.organization_admins(organization),
        "history": selectors.organization_history(organization),
    }


def _admin_spec(values: dict[str, Any]) -> services.FirstAdminSpec:
    return services.FirstAdminSpec(
        username=values["admin_username"],
        email=values["admin_email"],
        first_name=values["admin_first_name"],
        last_name=values["admin_last_name"],
        delivery=values["admin_delivery"],
    )


@extend_schema_view(list=extend_schema(parameters=[PlatformOrganizationQuerySerializer]))
@method_decorator(never_cache, name="dispatch")
class PlatformOrganizationViewSet(
    PlatformViewMixin, mixins.ListModelMixin, viewsets.GenericViewSet[Organization]
):
    authentication_classes = [ApiSessionAuthentication]
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = PlatformOrganizationSerializer
    lookup_field = "slug"
    lookup_value_regex = "[a-z0-9-]+"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "slug"]
    ordering_fields = ["name", "slug", "created_at", "users_count", "is_active"]
    ordering = ["name", "slug"]

    def get_queryset(self) -> QuerySet[Organization]:
        queryset = selectors.list_organizations()
        if self.action == "list":
            query = PlatformOrganizationQuerySerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            state = query.validated_data.get("status")
            if state:
                queryset = queryset.filter(is_active=state == "active")
        return queryset

    def _organization(self) -> Organization:
        slug = self.kwargs.get("slug", "")
        organization = Organization.objects.filter(slug=slug).first()
        if organization is None:
            raise NotFound
        return organization

    @extend_schema(responses=PlatformOrganizationDetailSerializer)
    def retrieve(self, request: Request, slug: str | None = None) -> Response:
        return Response(PlatformOrganizationDetailSerializer(_detail(self._organization())).data)

    @extend_schema(request=ProvisionSerializer, responses={201: ProvisionResponseSerializer})
    def create(self, request: Request) -> Response:
        payload = ProvisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        result = services.provision_organization(
            _actor(request),
            services.ProvisionRequest(
                organization=OrganizationSpec(
                    name=values["name"],
                    slug=values["slug"],
                    country=values["country"],
                    timezone=values["timezone"],
                    languages=tuple(values["languages"]),
                    epi_week=values["epi_week"],
                ),
                centers=[services.CenterSpec(**center) for center in values["centers"]],
                admin=_admin_spec(values),
            ),
        )
        body = {
            "organization": _detail(result.organization),
            "admin": {
                "username": result.admin.user.username,
                "delivery": values["admin_delivery"],
                "temporary_password": result.admin.temporary_password,
            },
        }
        return Response(ProvisionResponseSerializer(body).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=CenterInputSerializer, responses={201: PlatformCenterSerializer})
    @action(detail=True, methods=["post"])
    def centers(self, request: Request, slug: str | None = None) -> Response:
        payload = CenterInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        center = services.add_center(
            _actor(request), self._organization(), services.CenterSpec(**payload.validated_data)
        )
        return Response(PlatformCenterSerializer(center).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=AdminInputSerializer, responses={201: CreatedAdminSerializer})
    @action(detail=True, methods=["post"])
    def admins(self, request: Request, slug: str | None = None) -> Response:
        payload = AdminInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        result = services.add_admin(_actor(request), self._organization(), _admin_spec(values))
        body = {
            "username": result.user.username,
            "delivery": values["admin_delivery"],
            "temporary_password": result.temporary_password,
        }
        return Response(CreatedAdminSerializer(body).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=DefaultsResultSerializer)
    @action(detail=True, methods=["post"], url_path="apply-defaults")
    def apply_defaults(self, request: Request, slug: str | None = None) -> Response:
        plan = services.apply_defaults(_actor(request), self._organization())
        return Response(
            DefaultsResultSerializer(
                {
                    "profiles": len(plan.missing_profiles),
                    "catalogs": len(plan.missing_catalogs),
                    "parameters": len(plan.missing_parameters),
                }
            ).data
        )

    @extend_schema(request=ReasonSerializer, responses=PlatformOrganizationDetailSerializer)
    @action(detail=True, methods=["post"])
    def suspend(self, request: Request, slug: str | None = None) -> Response:
        payload = ReasonSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        organization = services.set_organization_active(
            _actor(request),
            self._organization(),
            active=False,
            reason=payload.validated_data["reason"],
        )
        return Response(PlatformOrganizationDetailSerializer(_detail(organization)).data)

    @extend_schema(request=ReasonSerializer, responses=PlatformOrganizationDetailSerializer)
    @action(detail=True, methods=["post"])
    def reactivate(self, request: Request, slug: str | None = None) -> Response:
        payload = ReasonSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        organization = services.set_organization_active(
            _actor(request),
            self._organization(),
            active=True,
            reason=payload.validated_data["reason"],
        )
        return Response(PlatformOrganizationDetailSerializer(_detail(organization)).data)

    @extend_schema(
        methods=["GET"], request=None, responses={(200, "image/png"): OpenApiTypes.BINARY}
    )
    @extend_schema(
        methods=["POST"],
        request=LogoInputSerializer,
        responses=PlatformOrganizationDetailSerializer,
    )
    @action(detail=True, methods=["get", "post"])
    def logo(self, request: Request, slug: str | None = None) -> HttpResponse | Response:
        organization = self._organization()
        if request.method == "GET":
            if not organization.logo_content:
                raise NotFound
            response = HttpResponse(bytes(organization.logo_content), content_type="image/png")
            response["X-Content-Type-Options"] = "nosniff"
            response["Cache-Control"] = "private, no-store"
            response["Content-Disposition"] = 'inline; filename="organization-logo.png"'
            patch_vary_headers(response, ["Cookie"])
            return response
        payload = LogoInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        content = validate_logo(payload.validated_data["logo"])
        changed = services.upload_logo(_actor(request), organization, content)
        return Response(PlatformOrganizationDetailSerializer(_detail(changed)).data)


@method_decorator(never_cache, name="dispatch")
class PlatformAvailabilityView(PlatformViewMixin, APIView):
    """`GET /platform/availability/?slug=&username=`: whether a new slug/username is free."""

    authentication_classes = [ApiSessionAuthentication]
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(parameters=[AvailabilityQuerySerializer], responses=AvailabilitySerializer)
    def get(self, request: Request) -> Response:
        query = AvailabilityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        result = selectors.availability(
            query.validated_data.get("slug"), query.validated_data.get("username")
        )
        return Response(AvailabilitySerializer(result).data)
