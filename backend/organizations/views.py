from typing import Any, cast

from django.db.models import QuerySet
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.cache import patch_vary_headers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.request_context import requested_organization_slug
from core.filters import CodeLookupFilter
from core.session_identity import remember_active_organization
from core.views import OrgScopedViewSetMixin
from organizations.logo import validate_logo
from organizations.models import Center, Membership, Organization, Profile
from organizations.selectors import get_me_context
from organizations.serializers import (
    CenterSerializer,
    LogoUploadSerializer,
    MembershipChangeSerializer,
    MembershipCreateSerializer,
    MembershipSerializer,
    MeSerializer,
    OrganizationSettingsSerializer,
    OrganizationUpdateSerializer,
    ProfilePermissionSerializer,
    ProfileSerializer,
)
from organizations.services import (
    MembershipChange,
    OrganizationChange,
    ProfileChange,
    create_managed_membership,
    update_membership,
    update_organization,
    update_profile_permissions,
)


class MeView(APIView):
    """Who am I: user, active organization, profiles, permissions and scope.

    Unlike scoped resources, several memberships without `X-Organization` is not an error here:
    it answers `organization: null` plus the `organizations` list to choose from.
    """

    uses_organization_header = True

    @extend_schema(responses=MeSerializer)
    def get(self, request: Request) -> Response:
        context = get_me_context(cast(User, request.user), requested_organization_slug(request))  # type: ignore[arg-type]
        organization = context.organization
        remember_active_organization(request, organization.pk if organization else None)
        return Response(MeSerializer(context).data)


class CenterViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = Center.objects.all()
    serializer_class = CenterSerializer
    required_permissions = {"list": "center.read", "retrieve": "center.read"}
    code_lookup_field = "code"
    filter_backends = [CodeLookupFilter, SearchFilter, OrderingFilter]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name"]
    ordering = ["code", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Center.objects.none()
        queryset = super().get_queryset()
        return queryset.filter(is_active=True) if self.action == "list" else queryset


class OrganizationViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = Organization.objects.none()
    serializer_class = OrganizationSettingsSerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    required_permissions = {
        "retrieve": "organization.read",
        "partial_update": "organization.update",
        "logo": "organization.read",
        "upload_logo": "organization.update",
    }

    @extend_schema(responses=OrganizationSettingsSerializer)
    def retrieve(self, request: Request) -> Response:
        return Response(
            OrganizationSettingsSerializer(
                cast(Organization, getattr(request, "organization", None))
            ).data
        )

    @extend_schema(request=OrganizationUpdateSerializer, responses=OrganizationSettingsSerializer)
    def partial_update(self, request: Request) -> Response:
        payload = OrganizationUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        expected = values.pop("expected_revision")
        changed = update_organization(
            cast(Organization, getattr(request, "organization", None)),
            OrganizationChange(cast(User, request.user), expected, values),
        )  # type: ignore[attr-defined,arg-type]
        return Response(OrganizationSettingsSerializer(changed).data)

    @extend_schema(responses={(200, "image/png"): OpenApiTypes.BINARY})
    def logo(self, request: Request) -> HttpResponse:
        organization = cast(Organization, getattr(request, "organization", None))  # type: ignore[attr-defined]
        if not organization.logo_content:
            from rest_framework.exceptions import NotFound

            raise NotFound
        response = HttpResponse(bytes(organization.logo_content), content_type="image/png")
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        response["Content-Disposition"] = 'inline; filename="organization-logo.png"'
        patch_vary_headers(response, ["Cookie", "Authorization", "X-Organization"])
        return response

    @extend_schema(request=LogoUploadSerializer, responses=OrganizationSettingsSerializer)
    def upload_logo(self, request: Request) -> Response:
        payload = LogoUploadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        content = validate_logo(payload.validated_data["logo"])
        changed = update_organization(
            cast(Organization, getattr(request, "organization", None)),
            OrganizationChange(
                cast(User, request.user), payload.validated_data["expected_revision"], {}, content
            ),
        )  # type: ignore[attr-defined,arg-type]
        return Response(OrganizationSettingsSerializer(changed).data)


class ProfileViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = Profile.objects.all().order_by("slug", "id")
    serializer_class = ProfileSerializer
    required_permissions = {
        "list": "role.read",
        "retrieve": "role.read",
        "permissions": "role.update",
    }
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["slug", "label_es", "label_en"]
    ordering_fields = ["slug", "label_es", "label_en"]
    ordering = ["slug", "id"]

    @extend_schema(request=ProfilePermissionSerializer, responses=ProfileSerializer)
    @action(detail=True, methods=["put"])
    def permissions(self, request: Request, pk: str | None = None) -> Response:
        profile = self.get_object()
        payload = ProfilePermissionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        changed = update_profile_permissions(
            profile, ProfileChange(actor=cast(User, request.user), **payload.validated_data)
        )  # type: ignore[arg-type]
        return Response(ProfileSerializer(changed).data)


class MembershipQuerySerializer(serializers.Serializer[Any]):
    user = serializers.UUIDField(required=False)
    profiles = serializers.UUIDField(required=False)
    is_active = serializers.BooleanField(required=False)


@extend_schema_view(list=extend_schema(parameters=[MembershipQuerySerializer]))
class MembershipViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = (
        Membership.objects.all()
        .select_related("user")
        .prefetch_related("profiles")
        .order_by("created_at", "id")
    )
    serializer_class = MembershipSerializer
    required_permissions = {
        "list": "role.read",
        "retrieve": "role.read",
        "create": "role.update",
        "change_scope": "role.update",
    }
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "is_active"]
    ordering = ["created_at", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Membership.objects.none()
        queryset = super().get_queryset()
        if self.action == "list":
            query = MembershipQuerySerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            queryset = queryset.filter(**query.validated_data)
        return queryset

    def _profiles(self, identifiers: list[object]) -> list[Profile]:
        profiles = list(
            Profile.objects.filter(
                organization=cast(Organization, getattr(self.request, "organization", None)),
                pk__in=identifiers,  # type: ignore[misc]
                is_active=True,
            )
        )  # type: ignore[attr-defined]
        if len(profiles) != len(identifiers):
            from rest_framework.exceptions import NotFound

            raise NotFound
        return profiles

    @extend_schema(request=MembershipCreateSerializer, responses={201: MembershipSerializer})
    def create(self, request: Request) -> Response:
        payload = MembershipCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        user = get_object_or_404(User, pk=values["user"], is_active=True)
        change = MembershipChange(
            cast(User, request.user), 1, self._profiles(values["profiles"]), values["scope"]
        )  # type: ignore[arg-type]
        member = create_managed_membership(
            user, cast(Organization, getattr(request, "organization", None)), change
        )  # type: ignore[attr-defined]
        return Response(MembershipSerializer(member).data, status=201)

    @extend_schema(request=MembershipChangeSerializer, responses=MembershipSerializer)
    @action(detail=True, methods=["post"], url_path="change-scope")
    def change_scope(self, request: Request, pk: str | None = None) -> Response:
        member = self.get_object()
        payload = MembershipChangeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        profiles = (
            self._profiles(values.pop("profiles"))
            if "profiles" in values
            else list(member.profiles.all())
        )
        change = MembershipChange(
            actor=cast(User, request.user),
            profiles=profiles,
            is_active=values.pop("is_active", member.is_active),
            **values,
        )  # type: ignore[arg-type]
        return Response(MembershipSerializer(update_membership(member, change)).data)
