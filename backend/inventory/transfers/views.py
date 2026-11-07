"""Thin custody facade: default-deny action, whole vector, then validation/locked writer."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.filters import CodeLookupFilter
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from inventory.transfers.commands import (
    DispatchTransferCommand,
    PrepareTransferCommand,
    ReceiveTransferCommand,
    ResolutionCommand,
)
from inventory.transfers.models import Discrepancy, Transfer
from inventory.transfers.selectors import TransferTableFilter, discrepancy_rows, transfer_rows
from inventory.transfers.serializers import (
    CloseDiscrepancySerializer,
    DiscrepancySerializer,
    DispatchTransferSerializer,
    PrepareTransferSerializer,
    ReceiveTransferSerializer,
    TransferEventSerializer,
    TransferSerializer,
)
from inventory.transfers.services import (
    dispatch_transfer,
    prepare_transfer,
    receive_transfer,
    resolve_discrepancy,
)
from uploads.access import actor_from_request


class TransferViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[Transfer],
):
    queryset = Transfer.objects.none()
    serializer_class = TransferSerializer
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": "transfer.read",
        "retrieve": "transfer.read",
        "create": "transfer.create",
        "dispatch_custody": "transfer.dispatch",
        "receive": "transfer.receive",
    }
    filter_backends = [
        CodeLookupFilter,
        TransferTableFilter,
        TableSearchFilter,
        TableOrderingFilter,
    ]
    code_lookup_field = "code"
    search_fields = ["code"]
    ordering_fields = ["code", "created_at"]
    ordering = ["-created_at"]
    transfer_facets = {
        "origin": "origin_id",
        "destination": "destination_id",
        "lot": "lines__lot_id",
        "state": "current_state",
        "created_at_from": "created_at__gte",
        "created_at_before": "created_at__lt",
    }

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return transfer_rows(
            actor_from_request(self.request), self.required_permissions[self.action]
        )

    @extend_schema(
        request=PrepareTransferSerializer,
        responses={201: TransferEventSerializer, 200: TransferEventSerializer},
    )
    def create(self, request: Request) -> Response:
        body = PrepareTransferSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = prepare_transfer(
            PrepareTransferCommand(actor_from_request(request), dict(body.validated_data))
        )
        return Response(
            TransferEventSerializer(result.event).data, status=200 if result.is_replay else 201
        )

    @extend_schema(
        request=DispatchTransferSerializer,
        responses={201: TransferEventSerializer, 200: TransferEventSerializer},
    )
    @action(detail=True, methods=["post"], url_path="dispatch", url_name="dispatch")
    def dispatch_custody(self, request: Request, pk: str | None = None) -> Response:
        parent = self.get_object()
        body = DispatchTransferSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = dispatch_transfer(
            DispatchTransferCommand(
                actor_from_request(request), parent.pk, dict(body.validated_data)
            )
        )
        return Response(
            TransferEventSerializer(result.event).data, status=200 if result.is_replay else 201
        )

    @extend_schema(
        request=ReceiveTransferSerializer,
        responses={201: TransferEventSerializer, 200: TransferEventSerializer},
    )
    @action(detail=True, methods=["post"])
    def receive(self, request: Request, pk: str | None = None) -> Response:
        parent = self.get_object()
        body = ReceiveTransferSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = receive_transfer(
            ReceiveTransferCommand(
                actor_from_request(request), parent.pk, dict(body.validated_data)
            )
        )
        return Response(
            TransferEventSerializer(result.event).data, status=200 if result.is_replay else 201
        )


class DiscrepancyViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[Discrepancy],
):
    queryset = Discrepancy.objects.none()
    serializer_class = DiscrepancySerializer
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": "discrepancy.read",
        "retrieve": "discrepancy.read",
        "close": "discrepancy.close",
    }
    filter_backends = [
        CodeLookupFilter,
        TransferTableFilter,
        TableSearchFilter,
        TableOrderingFilter,
    ]
    code_lookup_field = "code"
    search_fields = ["code"]
    ordering_fields = ["code", "created_at"]
    ordering = ["-created_at"]
    transfer_facets = {
        "status": "current_status",
        "transfer": "transfer_id",
        "lot": "transfer__lines__lot_id",
        "created_at_from": "created_at__gte",
        "created_at_before": "created_at__lt",
    }

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        return discrepancy_rows(
            actor_from_request(self.request), self.required_permissions[self.action]
        )

    @extend_schema(
        request=CloseDiscrepancySerializer,
        responses={201: TransferEventSerializer, 200: TransferEventSerializer},
    )
    @action(detail=True, methods=["post"])
    def close(self, request: Request, pk: str | None = None) -> Response:
        parent = self.get_object()
        body = CloseDiscrepancySerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = resolve_discrepancy(
            ResolutionCommand(actor_from_request(request), parent.pk, dict(body.validated_data))
        )
        return Response(
            TransferEventSerializer(result.event).data, status=200 if result.is_replay else 201
        )
