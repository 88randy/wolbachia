"""B02 personnel endpoints; actions remain thin and individually authorized."""

from collections.abc import Mapping
from typing import Any

from django.db.models import F, OuterRef, QuerySet, Subquery
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.debug import sensitive_variables
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle

from accounts.models import AccessLog, Personnel, User
from accounts.personnel_selectors import (
    filter_access_log,
    operational_projection,
    scoped_access_log,
    scoped_personnel,
)
from accounts.personnel_serializers import (
    AccessLogFilterSerializer,
    AccessLogSerializer,
    OperationalPersonnelSerializer,
    PersonnelDeactivateSerializer,
    PersonnelFilterSerializer,
    PersonnelSerializer,
    PersonnelWriteSerializer,
    RfcRevealSerializer,
    TemporaryPasswordSerializer,
)
from accounts.personnel_services import (
    create_personnel,
    deactivate_personnel,
    issue_temporary_password,
    reveal_personnel_rfc,
    update_personnel,
)
from core.pagination import StreamCursorPagination
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from privacy.names import person_name
from uploads.access import actor_from_request


@method_decorator(never_cache, name="dispatch")
class PersonnelViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = Personnel.objects.all()
    serializer_class = PersonnelSerializer
    lookup_field = "membership__user_id"
    lookup_url_kwarg = "pk"
    http_method_names = ["get", "head", "post", "patch", "options"]
    filter_backends = [TableSearchFilter, TableOrderingFilter]
    search_fields = ["display_name", "work_email", "work_phone"]
    ordering_fields = ["display_name", "created_at"]
    ordering = ["display_name"]
    throttle_scope: str | None = None
    required_permissions = {
        "list": "user.read",
        "retrieve": "user.read",
        "create": "user.create",
        "partial_update": "user.update",
        "deactivate": "user.deactivate",
        "reveal_rfc": "user.reveal_rfc",
        "temporary_password": "user.update",
        "operational": "user.operational_read",
    }

    def get_throttles(self) -> list[BaseThrottle]:
        """Share each protected-RFC budget by user while retaining global limits."""
        self.throttle_scope = None
        if self.action == "reveal_rfc":
            self.throttle_scope = "rfc_reveal"
        elif self.action == "temporary_password":
            self.throttle_scope = "temporary_password"  # noqa: S105 -- a throttle scope name
        elif (
            self.action in {"create", "partial_update"}
            and isinstance(self.request.data, Mapping)
            and "rfc" in self.request.data
        ):
            self.throttle_scope = "rfc_write"
        return [*super().get_throttles(), ScopedRateThrottle()]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Personnel.objects.none()
        rows = scoped_personnel(self.request.membership, self.required_permissions[self.action])  # type: ignore[attr-defined]
        if self.action in {"list", "operational"}:
            # QueryDict's HTML checkbox default would turn an absent flag into false.
            query = PersonnelFilterSerializer(data=self.request.query_params.dict())
            query.is_valid(raise_exception=True)
            for name in ("center", "quadrant"):
                if name in query.validated_data:
                    rows = rows.filter(**{f"{name}_id": query.validated_data[name]})
            if "is_active" in query.validated_data:
                rows = rows.filter(membership__is_active=query.validated_data["is_active"])
        latest_deactivation = AccessLog.objects.filter(
            target=OuterRef("pk"), action=AccessLog.Action.DEACTIVATE
        ).order_by("-created_at", "-id")
        return rows.annotate(
            last_deactivation_reason=Subquery(latest_deactivation.values("reason")[:1])
        )

    @extend_schema(parameters=[PersonnelFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(request=PersonnelWriteSerializer, responses={201: PersonnelSerializer})
    @sensitive_variables()
    def create(self, request: Request) -> Response:
        payload = PersonnelWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        person = create_personnel(actor_from_request(request), payload.validated_data)
        return Response(PersonnelSerializer(person).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=PersonnelWriteSerializer, responses=PersonnelSerializer)
    @sensitive_variables()
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        person = self.get_object()
        payload = PersonnelWriteSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        person = update_personnel(
            actor_from_request(request), person.membership.user_id, payload.validated_data
        )
        return Response(PersonnelSerializer(person).data)

    @extend_schema(request=PersonnelDeactivateSerializer, responses=PersonnelSerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, pk: str | None = None) -> Response:
        person = self.get_object()
        payload = PersonnelDeactivateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        person = deactivate_personnel(
            actor_from_request(request),
            person.membership.user_id,
            payload.validated_data["expected_revision"],
            payload.validated_data["reason"],
        )
        return Response(PersonnelSerializer(person).data)

    @extend_schema(request=None, responses=RfcRevealSerializer)
    @action(detail=True, methods=["post"], url_path="reveal-rfc")
    @sensitive_variables()
    def reveal_rfc(self, request: Request, pk: str | None = None) -> Response:
        person = self.get_object()
        rfc = reveal_personnel_rfc(actor_from_request(request), person.membership.user_id)
        return Response(
            RfcRevealSerializer({"rfc": rfc}).data, headers={"Cache-Control": "no-store"}
        )

    @extend_schema(request=None, responses=TemporaryPasswordSerializer)
    @action(detail=True, methods=["post"], url_path="temporary-password")
    @sensitive_variables()
    def temporary_password(self, request: Request, pk: str | None = None) -> Response:
        """Shown once; the user must replace it at the next sign in."""
        person = self.get_object()
        user_id = person.membership.user_id
        password = issue_temporary_password(actor_from_request(request), user_id)
        expires_at = User.objects.values_list("temporary_password_expires_at", flat=True).get(
            pk=user_id
        )
        return Response(
            TemporaryPasswordSerializer(
                {"temporary_password": password, "expires_at": expires_at}
            ).data,
            headers={"Cache-Control": "no-store"},
        )

    @extend_schema(
        parameters=[PersonnelFilterSerializer], responses=OperationalPersonnelSerializer(many=True)
    )
    @action(detail=False, methods=["get"])
    def operational(self, request: Request) -> Response:
        rows = self.get_queryset()
        page = self.paginate_queryset(rows)
        data = [
            operational_projection(person, request.membership)  # type: ignore[attr-defined]
            for person in (page if page is not None else rows)
        ]
        serialized = OperationalPersonnelSerializer(data, many=True).data
        return self.get_paginated_response(serialized) if page is not None else Response(serialized)


class AccessLogViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = AccessLog.objects.all()
    serializer_class = AccessLogSerializer
    pagination_class = StreamCursorPagination
    http_method_names = ["get", "head", "options"]
    required_permissions = {"list": "access_log.read"}

    def get_queryset(self) -> QuerySet[AccessLog]:
        if getattr(self, "swagger_fake_view", False):
            return AccessLog.objects.none()
        rows = scoped_access_log(self.request.membership)  # type: ignore[attr-defined]
        rows = filter_access_log(rows, self.request.query_params)
        return rows.annotate(
            actor_name=person_name("created_by_id"), target_name=F("target__display_name")
        )

    @extend_schema(parameters=[AccessLogFilterSerializer], responses=AccessLogSerializer(many=True))
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)
