"""Thin versioned resources; services own state and authorization decisions."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.exceptions import FieldValidationError
from core.filters import CodeLookupFilter
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from inventory.access import scoped_inventory
from inventory.conditions import ConditionCapture, record_condition
from inventory.masters import (
    MasterChange,
    deactivate_supply_type,
    revise_location,
    revise_supply_type,
)
from inventory.models import ConditionReading, LocationVersion, LotVersion, SupplyTypeVersion
from inventory.schema import InventoryAutoSchema
from inventory.selectors import latest_versions, location_stock, lot_versions
from inventory.serializers import (
    ConditionSerializer,
    ConditionWriteSerializer,
    InventoryRevisionSerializer,
    LocationSerializer,
    LocationWriteSerializer,
    LotSerializer,
    LotWriteSerializer,
    StockSerializer,
    SupplySerializer,
    SupplyWriteSerializer,
)
from inventory.services import LotChange, revise_lot
from inventory.table_filters import (
    InventoryTableFilter,
    nested_order,
    nested_parameters,
    require_relation,
    validated_query,
)
from uploads.access import actor_from_request


class InventoryVersionViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset: QuerySet[Any] = SupplyTypeVersion.objects.none()
    schema = InventoryAutoSchema()
    required_permissions: dict[str, str] = {}
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_backends = [
        CodeLookupFilter,
        InventoryTableFilter,
        TableSearchFilter,
        TableOrderingFilter,
    ]
    parent_field = ""
    ordering = ["code"]
    ordering_fields = ["code", "created_at"]
    inventory_facets: dict[str, str] = {}

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        actor = actor_from_request(self.request)
        permission = self.required_permissions[self.action]
        if self.queryset.model is LotVersion:
            return lot_versions(actor, permission)
        return scoped_inventory(
            latest_versions(self.queryset.model, self.parent_field), actor, permission
        ).select_related(self.parent_field.removesuffix("_id"))

    def get_object(self) -> Any:  # noqa: ANN401 -- DRF's parent method returns a heterogeneous model
        try:
            identifier = UUID(self.kwargs["pk"])
        except ValueError as error:
            raise Http404 from error
        record = get_object_or_404(self.get_queryset(), **{self.parent_field: identifier})
        self.check_object_permissions(self.request, record)
        return record

    def _command(
        self,
        request: Request,
        serializer: type[serializers.Serializer[Any]],
        identifier: UUID | None = None,
    ) -> MasterChange:
        payload = serializer(data=request.data, partial=identifier is not None)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        if identifier is not None and "expected_revision" not in values:
            raise FieldValidationError("expected_revision", "required")
        expected = values.pop("expected_revision", 0)
        return MasterChange(actor_from_request(request), values, identifier, expected)


class SupplyTypeViewSet(InventoryVersionViewSet):
    queryset = SupplyTypeVersion.objects.all()
    serializer_class = SupplySerializer
    parent_field = "supply_type_id"
    required_permissions = {
        "list": "supply_type.read",
        "retrieve": "supply_type.read",
        "create": "supply_type.create",
        "partial_update": "supply_type.update",
        "deactivate": "supply_type.deactivate",
    }
    code_lookup_field = "supply_type__code"
    search_fields = ["supply_type__code", "label"]
    ordering_aliases = {"code": "supply_type__code"}
    inventory_facets = {
        "is_active": "is_active",
        "is_biological": "is_biological",
        "identity_kind": "identity_kind",
    }

    @extend_schema(request=SupplyWriteSerializer, responses={201: SupplySerializer})
    def create(self, request: Request) -> Response:
        version = revise_supply_type(self._command(request, SupplyWriteSerializer))
        return Response(
            SupplySerializer(version, context=self.get_serializer_context()).data, status=201
        )

    @extend_schema(request=SupplyWriteSerializer, responses=SupplySerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        version = revise_supply_type(
            self._command(request, SupplyWriteSerializer, current.supply_type_id)
        )
        return Response(SupplySerializer(version, context=self.get_serializer_context()).data)

    @extend_schema(request=InventoryRevisionSerializer, responses=SupplySerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        version = deactivate_supply_type(
            self._command(request, InventoryRevisionSerializer, current.supply_type_id)
        )
        return Response(SupplySerializer(version, context=self.get_serializer_context()).data)


class LocationViewSet(InventoryVersionViewSet):
    queryset = LocationVersion.objects.all()
    serializer_class = LocationSerializer
    parent_field = "location_id"
    required_permissions = {
        "list": "location.read",
        "retrieve": "location.read",
        "create": "location.create",
        "partial_update": "location.update",
        "stock": "location.read",
    }
    code_lookup_field = "location__code"
    search_fields = ["location__code", "name"]
    ordering_aliases = {"code": "location__code"}
    inventory_facets = {
        "center": "location__center_id",
        "kind": "kind",
        "is_insecticide_free": "is_insecticide_free",
    }

    @extend_schema(request=LocationWriteSerializer, responses={201: LocationSerializer})
    def create(self, request: Request) -> Response:
        version = revise_location(self._command(request, LocationWriteSerializer))
        return Response(
            LocationSerializer(version, context=self.get_serializer_context()).data, status=201
        )

    @extend_schema(request=LocationWriteSerializer, responses=LocationSerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        version = revise_location(
            self._command(request, LocationWriteSerializer, current.location_id)
        )
        return Response(LocationSerializer(version, context=self.get_serializer_context()).data)

    @extend_schema(
        parameters=nested_parameters(("lot", "supply")), responses=StockSerializer(many=True)
    )
    @action(detail=True, methods=["get"])
    def stock(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        actor = actor_from_request(request)
        query = location_stock(actor, current.location)
        for name, value in validated_query(request, ("lot", "supply")).items():
            require_relation(actor, (name, value), "lot.read" if name == "lot" else "location.read")
            query = query.filter(**{"lot_id" if name == "lot" else "lot__supply_id": value})
        order = nested_order(request, ("lot__code", "piece_id"), "lot__code")[:-1]
        query = query.order_by(*order, "lot_id", "piece_id")
        page = self.paginate_queryset(query)
        return self.get_paginated_response(StockSerializer(page, many=True).data)


class LotViewSet(InventoryVersionViewSet):
    queryset = LotVersion.objects.all()
    serializer_class = LotSerializer
    parent_field = "lot_id"
    required_permissions = {
        "list": "lot.read",
        "retrieve": "lot.read",
        "create": "lot.create",
        "partial_update": "lot.update",
        "conditions": "lot.read",
        "create_condition": "condition.create",
    }
    code_lookup_field = "lot__code"
    search_fields = ["lot__code", "provenance"]
    ordering_fields = ["code", "expiry", "created_at"]
    ordering_aliases = {"code": "lot__code", "expiry": "expires_at"}
    inventory_facets = {
        "supply": "lot__supply_id",
        "location": "initial_location_id",
        "center": "lot__center_id",
        "status": "computed_status",
        "expiry_from": "expires_at__gte",
        "expiry_before": "expires_at__lt",
    }

    @extend_schema(request=LotWriteSerializer, responses={201: LotSerializer})
    def create(self, request: Request) -> Response:
        command = self._command(request, LotWriteSerializer)
        version = revise_lot(
            LotChange(command.actor, command.values, command.identifier, command.expected_revision)
        )
        return Response(
            LotSerializer(version, context=self.get_serializer_context()).data, status=201
        )

    @extend_schema(request=LotWriteSerializer, responses=LotSerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        command = self._command(request, LotWriteSerializer, current.lot_id)
        version = revise_lot(
            LotChange(command.actor, command.values, command.identifier, command.expected_revision)
        )
        return Response(LotSerializer(version, context=self.get_serializer_context()).data)

    @extend_schema(
        parameters=nested_parameters(
            ("device_time_from", "device_time_before", "local_date", "evaluation")
        ),
        responses=ConditionSerializer(many=True),
    )
    @action(detail=True, methods=["get"])
    def conditions(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        query = ConditionReading.objects.filter(
            organization=current.organization, lot=current.lot
        ).select_related("lot", "protocol")
        lookups = {
            "device_time_from": "device_time__gte",
            "device_time_before": "device_time__lt",
            "local_date": "local_date",
            "evaluation": "evaluation",
        }
        values = validated_query(request, tuple(lookups))
        query = query.filter(**{lookups[name]: value for name, value in values.items()}).order_by(
            *nested_order(request, ("device_time",), "-device_time")
        )
        page = self.paginate_queryset(query)
        return self.get_paginated_response(
            ConditionSerializer(page, many=True, context=self.get_serializer_context()).data
        )

    @extend_schema(request=ConditionWriteSerializer, responses={201: ConditionSerializer})
    @conditions.mapping.post
    def create_condition(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        payload = ConditionWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        reading = record_condition(
            ConditionCapture(actor_from_request(request), current.lot_id, **payload.validated_data)
        )
        return Response(
            ConditionSerializer(reading, context=self.get_serializer_context()).data, status=201
        )
