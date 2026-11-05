"""Shared views: health check and the base classes for organization-scoped resources."""

from typing import Any, cast

from django.db import transaction
from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.request_context import requested_organization_slug
from core.models import OrgScopedQuerySet, VoidableMixin, VoidableQuerySet
from core.permissions import HasPermissionCode
from core.services import lock_record_for_update, void_record
from core.session_identity import remember_active_organization
from core.void_reason import VoidSerializer
from organizations.selectors import resolve_active_membership

INCLUDE_VOIDED_PARAM = "include_voided"


class HealthSerializer(serializers.Serializer[Any]):
    status = serializers.CharField()


class HealthView(APIView):
    """Liveness probe: no authentication, no organization, no throttling."""

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes: list[Any] = []

    @extend_schema(responses=HealthSerializer, auth=[])
    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})


class OrgScopedViewSetMixin(GenericAPIView[Any]):
    """Resolves the active organization of the request and scopes every query to it.

    Resolution lives here (not in middleware) so token auth (#4) and Channels (#19) reuse
    `resolve_active_membership`. The organization comes from the user's membership, never from
    the body: `organization_id` in a payload is ignored.

    ViewSets only: authorization and the 405 check rely on the `action` attribute, which plain
    `APIView`s do not have.
    """

    uses_organization_header = True
    # Fails closed: a viewset must declare `required_permissions` per action to be reachable.
    permission_classes = [IsAuthenticated, HasPermissionCode]

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        # A method with no route (e.g. DELETE) has no action to authorize: answer 405, not 403.
        if getattr(self, "action", None) is None:
            raise MethodNotAllowed(request.method or "")
        if request.user.is_authenticated:
            membership = resolve_active_membership(
                request.user, requested_organization_slug(request)
            )
            request.membership = membership  # type: ignore[attr-defined]
            request.organization = membership.organization  # type: ignore[attr-defined]
            remember_active_organization(request, membership.organization_id)
        super().initial(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[Any]:
        scoped = cast("OrgScopedQuerySet", super().get_queryset())
        queryset = scoped.for_org(self.request.organization)  # type: ignore[attr-defined]
        if self._should_hide_voided(queryset):
            queryset = cast("VoidableQuerySet", queryset).not_voided()
        return queryset

    def _should_hide_voided(self, queryset: QuerySet[Any]) -> bool:
        include_voided = self.request.query_params.get(INCLUDE_VOIDED_PARAM, "").lower() == "true"
        is_list = getattr(self, "action", None) == "list"
        return is_list and not include_voided and issubclass(queryset.model, VoidableMixin)

    def perform_create(self, serializer: serializers.BaseSerializer[Any]) -> None:
        serializer.save(
            organization=self.request.organization,  # type: ignore[attr-defined]
            created_by=self.request.user,
        )

    def perform_update(self, serializer: serializers.BaseSerializer[Any]) -> None:
        with transaction.atomic():
            serializer.instance = lock_record_for_update(serializer.instance)  # type: ignore[arg-type,type-var]
            serializer.save(organization=self.request.organization)  # type: ignore[attr-defined]


class OrgScopedViewSet(
    OrgScopedViewSetMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """List, retrieve, create and update; there is deliberately no destroy."""

    http_method_names = ["get", "post", "put", "patch", "head", "options"]


class VoidActionMixin:
    """Adds `POST .../{id}/void/` with `{reason_code, reason?}` for resources that use `VoidableMixin`."""

    @extend_schema(request=VoidSerializer, responses=None)
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str | None = None) -> Response:
        instance = self.get_object()  # type: ignore[attr-defined]
        payload = VoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        voided = void_record(instance, request.user, **payload.validated_data)  # type: ignore[arg-type]
        serializer = self.get_serializer(voided)  # type: ignore[attr-defined]
        return Response(serializer.data, status=status.HTTP_200_OK)
