"""One incident facade; unqualified legacy GET remains a fleet list."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, PolymorphicProxySerializer, extend_schema
from rest_framework import filters, mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogs.models import CatalogItem
from core.filters import CodeLookupFilter
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from fleet.serializers import FleetIncidentFilterSerializer
from fleet.serializers import IncidentSerializer as FleetIncidentSerializer
from fleet.views import IncidentViewSet as FleetIncidentViewSet
from incidents.configuration import write_type
from incidents.configuration_permissions import IncidentTypePermission
from incidents.models import Incident, IncidentTypeVersion
from incidents.option_selectors import configuration_owner_options, context_options, owner_options
from incidents.payloads import IncidentReportPayload
from incidents.permissions import (
    INCIDENT_CLOSE,
    INCIDENT_CREATE,
    INCIDENT_MANAGE_TYPE,
    INCIDENT_READ,
    INCIDENT_REASSIGN,
)
from incidents.selectors import (
    latest_types,
    projected_incidents,
    scoped_incidents,
    type_versions,
    unconfigured_type_items,
)
from incidents.serializers import (
    CloseSerializer,
    CommentSerializer,
    CreateIncidentTypeSerializer,
    IncidentConflictResponseSerializer,
    IncidentContextOptionSerializer,
    IncidentContextQuerySerializer,
    IncidentEventSerializer,
    IncidentFilterSerializer,
    IncidentOptionQuerySerializer,
    IncidentOwnerOptionSerializer,
    IncidentTypeConfigurationOwnerOptionSerializer,
    IncidentTypeConfigurationOwnerQuerySerializer,
    IncidentTypeHistorySerializer,
    IncidentTypeQuerySerializer,
    IncidentTypeSerializer,
    IncidentTypeUnconfiguredItemSerializer,
    IncidentTypeUnconfiguredQuerySerializer,
    IncidentVoidSerializer,
    ReassignSerializer,
    ReportedIncidentSerializer,
    SeveritySerializer,
    TypeConfigurationSerializer,
)
from incidents.services import Decision, decide, report
from incidents.workspace_queries import IncidentOrderingFilter, reported_workspace
from uploads.access import actor_from_request


class IncidentViewSet(FleetIncidentViewSet, mixins.RetrieveModelMixin, mixins.CreateModelMixin):
    required_permissions = {
        "list": INCIDENT_READ,
        "retrieve": INCIDENT_READ,
        "create": INCIDENT_CREATE,
        "comments": INCIDENT_CREATE,
        "reassign": INCIDENT_REASSIGN,
        "change_severity": INCIDENT_REASSIGN,
        "close": INCIDENT_CLOSE,
        "void": INCIDENT_CLOSE,
        "context_options": INCIDENT_READ,
        "owner_options": INCIDENT_READ,
    }
    filter_backends = [CodeLookupFilter, IncidentOrderingFilter]

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.required_permissions = {
            **type(self).required_permissions,
            "list": "motorcycle.read"
            if request.query_params.get("kind", "fleet") == "fleet"
            else INCIDENT_READ,
        }
        if self.action == "context_options":
            self.required_permissions["context_options"] = (
                INCIDENT_CREATE if request.query_params.get("action") == "create" else INCIDENT_READ
            )
        super().initial(request, *args, **kwargs)

    def _fleet_list(self) -> bool:
        return self.action == "list" and self.request.query_params.get("kind", "fleet") == "fleet"

    def get_serializer_class(self) -> type[serializers.Serializer[Any]]:
        return FleetIncidentSerializer if self._fleet_list() else ReportedIncidentSerializer

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Incident.objects.none()
        if self._fleet_list():
            return super().get_queryset()
        member = self.request.membership  # type: ignore[attr-defined]
        if self.action != "list":
            if self.action == "retrieve":
                return reported_workspace(member, {}, server_now())
            return (
                scoped_incidents(member, self.required_permissions[self.action])
                .select_related("type_version")
                .prefetch_related("events")
            )
        # Reported collection predicates never alter detail or mutation visibility.
        query = IncidentFilterSerializer(
            data={
                key: value
                for key, value in self.request.query_params.items()
                if key in IncidentFilterSerializer().fields
            }
        )
        query.is_valid(raise_exception=True)
        return reported_workspace(member, query.validated_data, server_now())

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "kind",
                str,
                enum=["fleet", "reported"],
                description="Explicit representation selector. Default fleet preserves the legacy Incident component.",
            ),
            IncidentFilterSerializer,
            FleetIncidentFilterSerializer,
            OpenApiParameter(
                "ordering",
                str,
                description="Reported only: comma-separated code,created_at,deadline,severity with optional -. Critical rows always first; default deadline ascending/null last, created_at,id. Fleet preserves its existing created_at order.",
            ),
        ],
        responses=PolymorphicProxySerializer(
            component_name="IncidentListItem",
            serializers=[FleetIncidentSerializer, ReportedIncidentSerializer],
            resource_type_field_name=None,
            many=True,
        ),
    )
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        query = IncidentFilterSerializer(data={"kind": request.query_params.get("kind", "fleet")})
        query.is_valid(raise_exception=True)
        return super().list(request, *args, **kwargs)

    @extend_schema(
        request=IncidentReportPayload,
        responses={201: ReportedIncidentSerializer, 409: IncidentConflictResponseSerializer},
    )
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = IncidentReportPayload(data=request.data)
        payload.is_valid(raise_exception=True)
        incident = report(actor_from_request(request), payload.validated_data)
        return Response(
            ReportedIncidentSerializer(
                projected_incidents(incident.organization).get(pk=incident.pk),
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        parameters=[IncidentContextQuerySerializer],
        responses=IncidentContextOptionSerializer(many=True),
        filters=False,
    )
    @action(detail=False, methods=["get"], url_path="context-options")
    def context_options(self, request: Request) -> Response:
        query = IncidentContextQuerySerializer(
            data={key: value for key, value in request.query_params.items() if key != "format"}
        )
        query.is_valid(raise_exception=True)
        rows = context_options(actor_from_request(request), query.validated_data)
        return self.get_paginated_response(
            IncidentContextOptionSerializer(self.paginate_queryset(rows), many=True).data
        )

    @extend_schema(
        parameters=[IncidentOptionQuerySerializer],
        responses=IncidentOwnerOptionSerializer(many=True),
        filters=False,
    )
    @action(detail=True, methods=["get"], url_path="owner-options")
    def owner_options(self, request: Request, pk: str) -> Response:
        incident = self.get_object()
        query = IncidentOptionQuerySerializer(
            data={key: value for key, value in request.query_params.items() if key != "format"}
        )
        query.is_valid(raise_exception=True)
        rows = owner_options(
            actor_from_request(request), incident, query.validated_data.get("search", "")
        )
        return self.get_paginated_response(
            IncidentOwnerOptionSerializer(self.paginate_queryset(rows), many=True).data
        )

    def _decide(
        self, request: Request, pk: str, serializer_class: type[serializers.Serializer[Any]]
    ) -> Response:
        self.get_object()  # Scoped visibility before identity/domain contention.
        payload = serializer_class(data=request.data)
        payload.is_valid(raise_exception=True)
        data = dict(payload.validated_data)
        if "reason" in data:
            data["text"] = data.pop("reason")
        event = decide(
            actor_from_request(request),
            UUID(pk),
            Decision(
                self.action.removesuffix("s") if self.action == "comments" else self.action, **data
            ),
        )
        return Response(IncidentEventSerializer(event).data)

    @extend_schema(
        request=CommentSerializer,
        responses={200: IncidentEventSerializer, 409: IncidentConflictResponseSerializer},
    )
    @action(detail=True, methods=["post"])
    def comments(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, CommentSerializer)

    @extend_schema(
        request=ReassignSerializer,
        responses={200: IncidentEventSerializer, 409: IncidentConflictResponseSerializer},
    )
    @action(detail=True, methods=["post"])
    def reassign(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, ReassignSerializer)

    @extend_schema(
        request=SeveritySerializer,
        responses={200: IncidentEventSerializer, 409: IncidentConflictResponseSerializer},
    )
    @action(detail=True, methods=["post"], url_path="change-severity")
    def change_severity(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, SeveritySerializer)

    @extend_schema(
        request=CloseSerializer,
        responses={200: IncidentEventSerializer, 409: IncidentConflictResponseSerializer},
    )
    @action(detail=True, methods=["post"])
    def close(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, CloseSerializer)

    @extend_schema(
        request=IncidentVoidSerializer,
        responses={200: IncidentEventSerializer, 409: IncidentConflictResponseSerializer},
    )
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str) -> Response:
        return self._decide(request, pk, IncidentVoidSerializer)


class IncidentTypeOrderingFilter(filters.OrderingFilter):
    def filter_queryset(  # noqa: PLR0913 -- DRF backend's request/queryset/view signature
        self, request: Request, queryset: QuerySet[Any], view: APIView
    ) -> QuerySet[Any]:
        ordering = self.get_ordering(request, queryset, view) or []
        return queryset.order_by("is_other", *ordering, "pk")


class IncidentTypeViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = IncidentTypeVersion.objects.all()
    serializer_class = IncidentTypeSerializer
    permission_classes = [IsAuthenticated, IncidentTypePermission]
    required_permissions = {
        "list": INCIDENT_READ,
        "create": INCIDENT_MANAGE_TYPE,
        "partial_update": INCIDENT_MANAGE_TYPE,
        "owner_options": INCIDENT_MANAGE_TYPE,
        "versions": INCIDENT_MANAGE_TYPE,
        "unconfigured_items": INCIDENT_MANAGE_TYPE,
    }
    filter_backends = [CodeLookupFilter, IncidentTypeOrderingFilter]
    code_lookup_field = "code"
    ordering_fields = ["code", "created_at"]
    ordering = ["code", "id"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self) -> QuerySet[IncidentTypeVersion]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        rows = latest_types(self.request.organization)  # type: ignore[attr-defined]
        if self.action == "list":
            query = IncidentTypeQuerySerializer(
                data={
                    key: value
                    for key, value in self.request.query_params.items()
                    if key in IncidentTypeQuerySerializer().fields
                }
            )
            query.is_valid(raise_exception=True)
            if query.validated_data.get("reportable") == "true":
                rows = rows.filter(is_active=True, item__is_active=True)
        return rows

    @extend_schema(parameters=[IncidentTypeQuerySerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(
        parameters=[IncidentTypeConfigurationOwnerQuerySerializer],
        responses=IncidentTypeConfigurationOwnerOptionSerializer(many=True),
        filters=False,
    )
    @action(detail=False, methods=["get"], url_path="owner-options")
    def owner_options(self, request: Request) -> Response:
        query = IncidentTypeConfigurationOwnerQuerySerializer(
            data={key: value for key, value in request.query_params.items() if key != "format"}
        )
        query.is_valid(raise_exception=True)
        rows = configuration_owner_options(actor_from_request(request), query.validated_data)
        return self.get_paginated_response(
            IncidentTypeConfigurationOwnerOptionSerializer(
                self.paginate_queryset(rows), many=True
            ).data
        )

    @extend_schema(
        parameters=[IncidentTypeUnconfiguredQuerySerializer],
        responses=IncidentTypeUnconfiguredItemSerializer(many=True),
        filters=False,
    )
    @action(detail=False, methods=["get"], url_path="unconfigured-items")
    def unconfigured_items(self, request: Request) -> Response:
        query = IncidentTypeUnconfiguredQuerySerializer(
            data={key: value for key, value in request.query_params.items() if key != "format"}
        )
        query.is_valid(raise_exception=True)
        rows = unconfigured_type_items(request.organization, query.validated_data.get("code"))  # type: ignore[attr-defined]
        return self.get_paginated_response(
            IncidentTypeUnconfiguredItemSerializer(self.paginate_queryset(rows), many=True).data
        )

    @extend_schema(
        responses=IncidentTypeHistorySerializer(many=True),
        filters=False,
    )
    @action(detail=True, methods=["get"])
    def versions(self, request: Request, pk: str) -> Response:
        try:
            identifier = UUID(pk)
        except ValueError:
            raise Http404 from None
        rows = type_versions(request.organization, identifier)  # type: ignore[attr-defined]
        return self.get_paginated_response(
            IncidentTypeHistorySerializer(
                self.paginate_queryset(rows), many=True, context=self.get_serializer_context()
            ).data
        )

    @extend_schema(
        request=CreateIncidentTypeSerializer,
        responses={201: IncidentTypeSerializer, 409: IncidentConflictResponseSerializer},
    )
    def create(self, request: Request) -> Response:
        payload = CreateIncidentTypeSerializer(data=request.data, context={"create": True})
        payload.is_valid(raise_exception=True)
        result = write_type(actor_from_request(request), payload.validated_data)
        return Response(
            IncidentTypeSerializer(result, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=TypeConfigurationSerializer,
        responses={200: IncidentTypeSerializer, 409: IncidentConflictResponseSerializer},
    )
    def partial_update(self, request: Request, pk: str) -> Response:
        get_object_or_404(
            CatalogItem.objects.filter(
                organization=request.organization,  # type: ignore[attr-defined]
                catalog__slug="incident-type",  # type: ignore[attr-defined]
            ),
            pk=pk,
        )  # type: ignore[attr-defined]
        payload = TypeConfigurationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = write_type(actor_from_request(request), payload.validated_data, UUID(pk))
        return Response(IncidentTypeSerializer(result, context=self.get_serializer_context()).data)
