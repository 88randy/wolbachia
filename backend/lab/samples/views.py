"""Thin authenticated sample commands with current paired scope on every read."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.filters import CodeLookupFilter
from core.pagination import StandardPagination
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from lab.samples.models import WolbachiaSample
from lab.samples.payloads import SampleCommandSerializer, SampleResultSerializer
from lab.samples.selectors import filter_samples, sample_snapshot, scoped_samples
from lab.samples.serializers import (
    SampleCommandOutcomeSerializer,
    SampleQuerySerializer,
    SampleSnapshotSerializer,
)
from lab.samples.services import SampleCommand, execute_sample_command
from uploads.access import actor_from_request


class SampleViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[Any],
):
    queryset = WolbachiaSample.objects.none()
    serializer_class = SampleSnapshotSerializer
    pagination_class = StandardPagination
    required_permissions = {
        "list": "sample.read",
        "retrieve": "sample.read",
        "receive": "sample.receive",
        "results": "sample.result_create",
    }
    http_method_names = ["get", "post", "head", "options"]
    filter_backends = [CodeLookupFilter, TableSearchFilter, TableOrderingFilter]
    code_lookup_field = "code"
    search_fields = ["code"]
    ordering_fields = ["code", "created_at", "device_time", "id"]
    ordering = ["-created_at"]
    lookup_value_regex = (
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )

    def get_queryset(self) -> QuerySet[WolbachiaSample]:
        if getattr(self, "swagger_fake_view", False):
            return WolbachiaSample.objects.none()
        rows = scoped_samples(
            actor_from_request(self.request), self.required_permissions[self.action]
        )
        if self.action != "list":
            return rows
        query = SampleQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return filter_samples(rows, query.validated_data)

    @extend_schema(parameters=[SampleQuerySerializer])
    def list(self, request: Request) -> Response:
        rows = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(rows)
        if page is None:
            return Response([sample_snapshot(row) for row in rows])
        return self.get_paginated_response([sample_snapshot(row) for row in page])

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        return Response(sample_snapshot(self.get_object()))

    @extend_schema(request=SampleCommandSerializer, responses=SampleCommandOutcomeSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def receive(self, request: Request, pk: str | None = None) -> Response:
        body = SampleCommandSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        command = SampleCommand(
            action="receive", command_id=body.validated_data["command_id"], values={}
        )
        return Response(
            execute_sample_command(actor_from_request(request), self.get_object().pk, command)
        )

    @extend_schema(request=SampleResultSerializer, responses=SampleCommandOutcomeSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def results(self, request: Request, pk: str | None = None) -> Response:
        body = SampleResultSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        values = dict(body.validated_data)
        command = SampleCommand(
            action="results", command_id=values.pop("command_id"), values=values
        )
        return Response(
            execute_sample_command(actor_from_request(request), self.get_object().pk, command)
        )
