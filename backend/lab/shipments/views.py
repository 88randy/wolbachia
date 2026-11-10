"""Thin session/CSRF and pinned bearer facades; B25 alone renders documents."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from lab.shipments import selectors, services
from lab.shipments.models import MaterialRequest, UiebShipment
from lab.shipments.serializers import (
    DeliveryReceiptSerializer,
    DeliveryWriteSerializer,
    MaterialRequestProjectionSerializer,
    MaterialRequestWriteSerializer,
    NotificationWriteSerializer,
    ShipmentProjectionSerializer,
    ShipmentQuerySerializer,
    ShipmentVoidSerializer,
    ShipmentWriteSerializer,
)
from uploads.access import actor_from_request


class ShipmentReadViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[Any],
):
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = StandardPagination
    code_lookup_field = "code"

    def filter_queryset(self, queryset: QuerySet[Any]) -> QuerySet[Any]:
        rows = super().filter_queryset(queryset)
        if self.action != "list":
            return rows
        query = ShipmentQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        prefix = "sources__" if rows.model is UiebShipment else "location__"
        for dimension in ("center", "quadrant"):
            if dimension in values:
                rows = rows.filter(**{prefix + dimension + "_id": values[dimension]})
        if not values["include_voided"]:
            rows = rows.filter(void__isnull=True)
        return rows.order_by(values["ordering"], "pk").distinct()

    def projection(self, instance: Any) -> dict[str, Any]:  # noqa: ANN401 -- concrete resource variants
        if isinstance(instance, UiebShipment):
            return selectors.shipment_projection(actor_from_request(self.request), instance)
        return selectors.request_projection(instance)

    @extend_schema(parameters=[ShipmentQuerySerializer])
    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401 -- DRF protocol
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        response = self.get_paginated_response(
            self.get_serializer([self.projection(row) for row in page or []], many=True).data
        )
        response["Cache-Control"] = "private, no-store"
        return response

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401 -- DRF protocol
        return Response(
            self.get_serializer(self.projection(self.get_object())).data,
            headers={"Cache-Control": "private, no-store"},
        )


class UiebShipmentViewSet(ShipmentReadViewSet):
    queryset = UiebShipment.objects.none()
    serializer_class = ShipmentProjectionSerializer
    required_permissions = {
        "list": "shipment.read",
        "retrieve": "shipment.read",
        "create": "shipment.create",
        "void": "shipment.void",
    }

    def get_queryset(self) -> QuerySet[UiebShipment]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return selectors.shipment_rows(
            actor_from_request(self.request), self.required_permissions[self.action]
        )

    @extend_schema(request=ShipmentWriteSerializer, responses={201: ShipmentProjectionSerializer})
    def create(self, request: Request) -> Response:
        payload = ShipmentWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        shipment = services.create_shipment(actor_from_request(request), payload.validated_data)
        return Response(
            self.get_serializer(self.projection(shipment)).data,
            status=201,
            headers={"Cache-Control": "private, no-store"},
        )

    @extend_schema(request=ShipmentVoidSerializer, responses={204: None})
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str | None = None) -> Response:
        target = self.get_object()
        payload = ShipmentVoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.void_shipment(
            actor_from_request(request), target.pk, payload.validated_data["reason"]
        )
        return Response(status=204)


class MaterialRequestViewSet(ShipmentReadViewSet):
    queryset = MaterialRequest.objects.none()
    serializer_class = MaterialRequestProjectionSerializer
    required_permissions = {
        "list": "material_request.read",
        "retrieve": "material_request.read",
        "create": "material_request.create",
        "cenaprece_notification": "material_request.notify",
        "deliver": "material_request.deliver",
        "void": "material_request.void",
    }

    def get_queryset(self) -> QuerySet[MaterialRequest]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return selectors.request_rows(
            actor_from_request(self.request), self.required_permissions[self.action]
        )

    @extend_schema(
        request=MaterialRequestWriteSerializer, responses={201: MaterialRequestProjectionSerializer}
    )
    def create(self, request: Request) -> Response:
        payload = MaterialRequestWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = services.create_request(actor_from_request(request), payload.validated_data)
        return Response(self.get_serializer(self.projection(target)).data, status=201)

    @extend_schema(
        request=NotificationWriteSerializer, responses=MaterialRequestProjectionSerializer
    )
    @action(detail=True, methods=["post"], url_path="cenaprece-notification")
    def cenaprece_notification(self, request: Request, pk: str | None = None) -> Response:
        target = self.get_object()
        payload = NotificationWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = services.record_notification(
            actor_from_request(request), target.pk, payload.validated_data
        )
        return Response(self.get_serializer(self.projection(target)).data)

    @extend_schema(request=DeliveryWriteSerializer, responses=DeliveryReceiptSerializer)
    @action(detail=True, methods=["post"])
    def deliver(self, request: Request, pk: str | None = None) -> Response:
        target = self.get_object()
        payload = DeliveryWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        receipt = services.deliver_material(
            actor_from_request(request), target.pk, payload.validated_data
        )
        return Response(DeliveryReceiptSerializer(receipt).data)

    @extend_schema(request=ShipmentVoidSerializer, responses={204: None})
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str | None = None) -> Response:
        target = self.get_object()
        payload = ShipmentVoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.void_request(
            actor_from_request(request), target.pk, payload.validated_data["reason"]
        )
        return Response(status=204)
