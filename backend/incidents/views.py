"""One incident facade; unqualified legacy GET remains a fleet list."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, PolymorphicProxySerializer, extend_schema
from rest_framework import filters, mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from catalogs.models import CatalogItem
from core.filters import CodeLookupFilter
from core.views import OrgScopedViewSetMixin
from fleet.serializers import FleetIncidentFilterSerializer
from fleet.serializers import IncidentSerializer as FleetIncidentSerializer
from fleet.views import IncidentViewSet as FleetIncidentViewSet
from incidents.configuration import write_type
from incidents.models import Incident, IncidentTypeVersion
from incidents.payloads import IncidentReportPayload
from incidents.permissions import (
    INCIDENT_CLOSE,
    INCIDENT_CREATE,
    INCIDENT_MANAGE_TYPE,
    INCIDENT_READ,
    INCIDENT_REASSIGN,
)
from incidents.selectors import latest_types, projected_incidents, scoped_incidents
from incidents.serializers import (
    CloseSerializer,
    CommentSerializer,
    CreateIncidentTypeSerializer,
    IncidentConflictResponseSerializer,
    IncidentEventSerializer,
    IncidentFilterSerializer,
    IncidentTypeSerializer,
    IncidentVoidSerializer,
    ReassignSerializer,
    ReportedIncidentSerializer,
    SeveritySerializer,
    TypeConfigurationSerializer,
)
from incidents.services import Decision, decide, report
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
    }

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.required_permissions = {
            **type(self).required_permissions,
            "list": "motorcycle.read"
            if request.query_params.get("kind", "fleet") == "fleet"
            else INCIDENT_READ,
        }
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
        # Query protocol fields are handled by DRF pagination/ordering, not payload strictness.
        query = IncidentFilterSerializer(
            data={
                key: value
                for key, value in self.request.query_params.items()
                if key in IncidentFilterSerializer().fields
            }
        )
        query.is_valid(raise_exception=True)
        lookups = {
            "state": "state",
            "severity": "severity",
            "owner": "owner_id",
            "type_id": "type_version_id",
            "center": "center_id",
            "quadrant": "quadrant_id",
            "code": "code",
        }
        member = self.request.membership  # type: ignore[attr-defined]
        queryset = scoped_incidents(
            member, self.required_permissions[self.action]
        ).prefetch_related("events")  # type: ignore[attr-defined]
        return queryset.filter(
            **{lookups[key]: value for key, value in query.validated_data.items() if key in lookups}
        )

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
                projected_incidents(incident.organization).get(pk=incident.pk)
            ).data,
            status=status.HTTP_201_CREATED,
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


class IncidentTypeViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = IncidentTypeVersion.objects.all()
    serializer_class = IncidentTypeSerializer
    required_permissions = {
        "list": INCIDENT_READ,
        "create": INCIDENT_MANAGE_TYPE,
        "partial_update": INCIDENT_MANAGE_TYPE,
    }
    filter_backends = [CodeLookupFilter, filters.OrderingFilter]
    code_lookup_field = "code"
    ordering_fields = ["code", "created_at"]
    ordering = ["code", "id"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self) -> QuerySet[IncidentTypeVersion]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return latest_types(self.request.organization)  # type: ignore[attr-defined]

    @extend_schema(
        request=CreateIncidentTypeSerializer,
        responses={201: IncidentTypeSerializer, 409: IncidentConflictResponseSerializer},
    )
    def create(self, request: Request) -> Response:
        payload = CreateIncidentTypeSerializer(data=request.data, context={"create": True})
        payload.is_valid(raise_exception=True)
        result = write_type(actor_from_request(request), payload.validated_data)
        return Response(IncidentTypeSerializer(result).data, status=status.HTTP_201_CREATED)

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
        return Response(IncidentTypeSerializer(result).data)
