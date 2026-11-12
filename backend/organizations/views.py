from typing import Any, cast

from django.db.models import Count, IntegerField, OuterRef, QuerySet, Subquery
from django.db.models.functions import Coalesce
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
from geography.models import Quadrant
from inventory.models import Location
from inventory.transfers.permissions import TRANSFER_CREATE
from organizations.center_closure import (
    closure_readiness,
    move_motorcycles,
    move_stock,
    pending_transfer_count,
)
from organizations.centers import (
    CENTER_CREATE,
    CENTER_DEACTIVATE,
    CENTER_UPDATE,
    CenterSpec,
    create_center,
    deactivate_center,
    reactivate_center,
    rename_center,
    require_all_centers_grant,
)
from organizations.logo import validate_logo
from organizations.models import Center, Membership, Organization, Profile
from organizations.selectors import get_me_context
from organizations.serializers import (
    CenterAdminSerializer,
    CenterCreateSerializer,
    CenterDeactivateSerializer,
    CenterListQuerySerializer,
    CenterMoveMotorcyclesSerializer,
    CenterMoveResponseSerializer,
    CenterMoveStockSerializer,
    CenterReadinessSerializer,
    CenterSerializer,
    CenterUpdateSerializer,
    LogoUploadSerializer,
    MembershipChangeSerializer,
    MembershipCreateSerializer,
    MembershipSerializer,
    MeSerializer,
    OrganizationSettingsSerializer,
    OrganizationUpdateSerializer,
    ProfileCopySerializer,
    ProfilePermissionSerializer,
    ProfileSerializer,
)
from organizations.services import (
    MembershipChange,
    OrganizationChange,
    ProfileChange,
    ProfileCopy,
    copy_profile,
    create_managed_membership,
    effective_scope,
    update_membership,
    update_organization,
    update_profile_permissions,
)
from shifts.models import Motorcycle
from shifts.permissions import MOTORCYCLE_MANAGE
from uploads.access import actor_from_request


class MeView(APIView):
    """Who am I: user, active organization, profiles, permissions and scope.

    Unlike scoped resources, several memberships without `X-Organization` is not an error here:
    it answers `organization: null` plus the `organizations` list to choose from.
    """

    uses_organization_header = True
    allows_pending_password_change = True

    @extend_schema(responses=MeSerializer)
    def get(self, request: Request) -> Response:
        context = get_me_context(cast(User, request.user), requested_organization_slug(request))  # type: ignore[arg-type]
        organization = context.organization
        remember_active_organization(request, organization.pk if organization else None)
        return Response(MeSerializer(context).data)


# Readers who also manage centers see who closed one, why, and what it holds.
CENTER_ADMIN_READ_CODES = frozenset({CENTER_UPDATE, CENTER_DEACTIVATE})


def _count(model: Any, field: str, **filters: Any) -> Coalesce:  # noqa: ANN401 -- any model
    """A correlated count of `model` rows whose `field` is the outer center."""
    rows = (
        model.objects.filter(**{field: OuterRef("pk")}, **filters)
        .order_by()
        .values(field)
        .annotate(total=Count("pk"))
        .values("total")
    )
    return Coalesce(Subquery(rows, output_field=IntegerField()), 0)


def _with_counts(queryset: QuerySet[Any]) -> QuerySet[Any]:
    return queryset.annotate(
        quadrant_count=_count(Quadrant, "center"),
        warehouse_count=_count(Location, "center"),
        motorcycle_count=_count(Motorcycle, "center", voided_at__isnull=True),
    )


@extend_schema_view(list=extend_schema(parameters=[CenterListQuerySerializer]))
class CenterViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Centers of the organization. Nothing is deleted: a center is deactivated with a reason.

    Every action is scoped to the centers the caller's grant covers; creating needs `center.create`
    over all centers, because a center outside a limited scope would be invisible to its creator.
    """

    queryset = Center.objects.all()
    serializer_class = CenterAdminSerializer
    required_permissions = {
        "list": "center.read",
        "retrieve": "center.read",
        "create": CENTER_CREATE,
        "partial_update": CENTER_UPDATE,
        "deactivate": CENTER_DEACTIVATE,
        "reactivate": CENTER_DEACTIVATE,
        "readiness": CENTER_DEACTIVATE,
        "move_motorcycles": MOTORCYCLE_MANAGE,
        "move_stock": TRANSFER_CREATE,
    }
    http_method_names = ["get", "post", "patch", "head", "options"]
    code_lookup_field = "code"
    filter_backends = [CodeLookupFilter, SearchFilter, OrderingFilter]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "updated_at"]
    ordering = ["code", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Center.objects.none()
        queryset = super().get_queryset()
        if self.action not in ("list", "retrieve"):
            return queryset
        if self._is_center_admin():
            queryset = _with_counts(queryset)
        if self.action == "list":
            query = CenterListQuerySerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            if not query.validated_data["include_inactive"]:
                queryset = queryset.filter(is_active=True)
        return queryset

    def _is_center_admin(self) -> bool:
        permissions = effective_scope(self.request.membership).permissions  # type: ignore[attr-defined]
        return bool(CENTER_ADMIN_READ_CODES & permissions)

    def get_serializer_class(self) -> type[Any]:
        """Who closed a center, why, and what it holds are for the center admins only."""
        if getattr(self, "swagger_fake_view", False) or self._is_center_admin():
            return CenterAdminSerializer
        return CenterSerializer

    def _actor(self) -> User:
        return cast(User, self.request.user)

    def _respond(self, center: Center, status: int = 200) -> Response:
        return Response(
            CenterAdminSerializer(_with_counts(Center.objects.filter(pk=center.pk)).get()).data,
            status=status,
        )

    @extend_schema(request=CenterCreateSerializer, responses={201: CenterAdminSerializer})
    def create(self, request: Request) -> Response:
        require_all_centers_grant(request.membership)  # type: ignore[attr-defined]
        payload = CenterCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        center = create_center(
            cast(Organization, getattr(request, "organization", None)),
            CenterSpec(**payload.validated_data),
            self._actor(),
        )
        return self._respond(center, 201)

    @extend_schema(request=CenterUpdateSerializer, responses=CenterAdminSerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        payload = CenterUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._respond(
            rename_center(self.get_object(), payload.validated_data["name"], self._actor())
        )

    @extend_schema(request=CenterDeactivateSerializer, responses=CenterAdminSerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, pk: str | None = None) -> Response:
        payload = CenterDeactivateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._respond(
            deactivate_center(self.get_object(), payload.validated_data["reason"], self._actor())
        )

    @extend_schema(request=None, responses=CenterAdminSerializer)
    @action(detail=True, methods=["post"])
    def reactivate(self, request: Request, pk: str | None = None) -> Response:
        return self._respond(reactivate_center(self.get_object(), self._actor()))

    @extend_schema(responses=CenterReadinessSerializer)
    @action(detail=True, methods=["get"])
    def readiness(self, request: Request, pk: str | None = None) -> Response:
        center = self.get_object()
        body = {
            "rows": [vars(row) for row in closure_readiness(center)],
            "prepared_transfer_count": pending_transfer_count(center),
        }
        return Response(CenterReadinessSerializer(body).data)

    @extend_schema(request=CenterMoveMotorcyclesSerializer, responses=CenterMoveResponseSerializer)
    @action(detail=True, methods=["post"], url_path="move-motorcycles")
    def move_motorcycles(self, request: Request, pk: str | None = None) -> Response:
        center = self.get_object()
        payload = CenterMoveMotorcyclesSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        destination = get_object_or_404(
            self.get_queryset().filter(is_active=True).exclude(pk=center.pk),
            pk=payload.validated_data["destination_center"],
        )
        results = move_motorcycles(center, destination, self._actor())
        return Response(CenterMoveResponseSerializer({"results": results}).data)

    @extend_schema(request=CenterMoveStockSerializer, responses=CenterMoveResponseSerializer)
    @action(detail=True, methods=["post"], url_path="move-stock")
    def move_stock(self, request: Request, pk: str | None = None) -> Response:
        center = self.get_object()
        payload = CenterMoveStockSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        destination = get_object_or_404(
            Location.objects.filter(
                organization_id=center.organization_id, center__is_active=True
            ).exclude(center=center),
            pk=payload.validated_data["destination_location"],
        )
        results = move_stock(center, destination, actor_from_request(request))
        return Response(CenterMoveResponseSerializer({"results": results}).data)


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
        "create": "role.update",
        "permissions": "role.update",
    }
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["slug", "label_es", "label_en"]
    ordering_fields = ["slug", "label_es", "label_en"]
    ordering = ["slug", "id"]

    @extend_schema(request=ProfileCopySerializer, responses={201: ProfileSerializer})
    def create(self, request: Request) -> Response:
        """A custom profile always starts as a copy of an existing one."""
        payload = ProfileCopySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        source = get_object_or_404(
            Profile.objects.filter(organization=request.organization),  # type: ignore[attr-defined]
            pk=payload.validated_data["copy_from"],
        )
        created = copy_profile(
            ProfileCopy(
                actor=cast(User, request.user),
                source=source,
                label_es=payload.validated_data["label_es"],
                label_en=payload.validated_data["label_en"],
            )
        )
        return Response(ProfileSerializer(created).data, status=201)

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
            # A plain dict: a QueryDict makes an omitted BooleanField read as False, which
            # silently filtered the list to inactive memberships only.
            query = MembershipQuerySerializer(data=self.request.query_params.dict())
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
