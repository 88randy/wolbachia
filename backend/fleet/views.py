"""Scoped, page-number fleet administration. All mutations delegate to domain services."""

from typing import Any, cast

from django.db.models import DateTimeField, Exists, OuterRef, QuerySet, Subquery
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.models import User
from core.filters import CodeLookupFilter
from core.views import OrgScopedViewSetMixin
from core.void_reason import VoidSerializer
from fleet.models import FuelLoad, InspectionClearance, ResponsibilityLetter, ServiceRecord
from fleet.permissions import MOTORCYCLE_SERVICE_CLEAR
from fleet.serializers import (
    ClearanceSerializer,
    FuelFilterSerializer,
    FuelLoadSerializer,
    IncidentSerializer,
    LetterWriteSerializer,
    ResponsibilityLetterSerializer,
    ServiceRecordSerializer,
    ServiceWriteSerializer,
)
from fleet.services import (
    ClearanceRequest,
    append_letter,
    append_service,
    clear_fault,
    void_history,
)
from organizations.selectors import filter_by_effective_scope
from shifts.models import Motorcycle, MotorcycleBlockEvent
from shifts.motorcycle_serializers import MotorcycleSerializer
from shifts.permissions import MOTORCYCLE_MANAGE, MOTORCYCLE_READ


class HistoryViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": MOTORCYCLE_READ,
        "create": MOTORCYCLE_MANAGE,
        "void": MOTORCYCLE_MANAGE,
    }
    filter_backends = [CodeLookupFilter, filters.OrderingFilter]
    ordering_fields = ["created_at"]

    def parent_motorcycle(self) -> Motorcycle:
        required = self.required_permissions[self.action]
        scoped = filter_by_effective_scope(
            Motorcycle.objects.filter(organization=self.request.organization),  # type: ignore[attr-defined]
            self.request.membership,  # type: ignore[attr-defined]
            required,
        )  # type: ignore[attr-defined]
        return get_object_or_404(scoped, pk=self.kwargs["motorcycle_id"])

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return super().get_queryset().none()
        parent = self.parent_motorcycle()
        return super().get_queryset().filter(motorcycle=parent)

    @extend_schema(request=VoidSerializer, responses=None)
    @action(detail=True, methods=["post"])
    def void(self, request: Request, **kwargs: object) -> Response:
        record = self.get_object()
        payload = VoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = void_history(record, cast(User, request.user), payload.validated_data)
        return Response(self.get_serializer(result).data)


@extend_schema_view(void=extend_schema(responses={200: ServiceRecordSerializer}))
class ServiceViewSet(HistoryViewSet):
    queryset = ServiceRecord.objects.all()
    serializer_class = ServiceRecordSerializer
    ordering_fields = ["performed_at", "odometer_km", "created_at"]

    @extend_schema(request=ServiceWriteSerializer, responses={201: ServiceRecordSerializer})
    def create(self, request: Request, **kwargs: object) -> Response:
        parent = self.parent_motorcycle()
        payload = ServiceWriteSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        result = append_service(parent, cast(User, request.user), payload.validated_data)
        return Response(
            self.get_serializer(result).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(void=extend_schema(responses={200: ResponsibilityLetterSerializer}))
class LetterViewSet(HistoryViewSet):
    queryset = ResponsibilityLetter.objects.all()
    serializer_class = ResponsibilityLetterSerializer
    ordering_fields = ["issued_at", "created_at"]

    @extend_schema(request=LetterWriteSerializer, responses={201: ResponsibilityLetterSerializer})
    def create(self, request: Request, **kwargs: object) -> Response:
        parent = self.parent_motorcycle()
        payload = LetterWriteSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        result = append_letter(parent, cast(User, request.user), payload.validated_data)
        return Response(
            self.get_serializer(result).data,
            status=status.HTTP_201_CREATED,
        )


class ClearanceViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = Motorcycle.objects.all()
    serializer_class = MotorcycleSerializer
    required_permissions = {"create": MOTORCYCLE_SERVICE_CLEAR}

    @extend_schema(request=ClearanceSerializer, responses={200: MotorcycleSerializer})
    def create(self, request: Request, pk: str) -> Response:
        motorcycle = self.get_object()
        payload = ClearanceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = clear_fault(
            motorcycle, cast(User, request.user), ClearanceRequest(**payload.validated_data)
        )
        return Response(self.get_serializer(result).data)


class FuelLoadViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = FuelLoad.objects.all()
    serializer_class = FuelLoadSerializer
    required_permissions = {"list": MOTORCYCLE_READ}
    filter_backends = [CodeLookupFilter, filters.OrderingFilter]
    ordering_fields = ["event__device_time", "odometer_km", "efficiency_km_l", "created_at"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return super().get_queryset().none()
        query = FuelFilterSerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        lookups = {
            "motorcycle": "motorcycle_id",
            "courier": "shift__courier_id",
            "efficiency_status": "efficiency_status",
            "date_from": "event__device_time__gte",
            "date_before": "event__device_time__lt",
        }
        return (
            super()
            .get_queryset()
            .select_related("event", "shift")
            .filter(**{lookups[key]: value for key, value in query.validated_data.items()})
        )

    @extend_schema(parameters=[FuelFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)


class IncidentViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = MotorcycleBlockEvent.objects.all()
    serializer_class = IncidentSerializer
    required_permissions = {"list": MOTORCYCLE_READ}
    filter_backends = [CodeLookupFilter, filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["-created_at", "-id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return super().get_queryset().none()
        # BlockEvent predates fleet and has no center attribute: scope through Motorcycle explicitly.
        motorcycles = filter_by_effective_scope(
            Motorcycle.objects.filter(organization=self.request.organization),  # type: ignore[attr-defined]
            self.request.membership,  # type: ignore[attr-defined]
            MOTORCYCLE_READ,
        )  # type: ignore[attr-defined]
        clearances = InspectionClearance.objects.filter(fault=OuterRef("pk"))
        return (
            super()
            .get_queryset()
            .filter(motorcycle__in=motorcycles, action="block", blocked_reason="severe_check")
            .annotate(
                is_cleared=Exists(clearances),
                cleared_at=Subquery(
                    clearances.values("created_at")[:1], output_field=DateTimeField()
                ),
            )
        )
