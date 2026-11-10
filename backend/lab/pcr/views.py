"""Thin PCR endpoints: validate the edges, call services, answer with selector snapshots."""

import hashlib
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404, HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.filters import CodeLookupFilter
from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from lab.pcr import services
from lab.pcr.csv_import import preview_csv, template_csv
from lab.pcr.models import STATUSES, ExternalLab, PcrBatch, PcrBatchEvent, PcrReport
from lab.pcr.permissions import PCR_MANAGE, PCR_READ
from lab.pcr.selectors import (
    batch_detail,
    batch_row,
    batch_summary,
    batches,
    eligible_sample_row,
    eligible_samples,
    search_batches,
)
from lab.pcr.serializers import (
    EligibleSampleQuerySerializer,
    ExternalLabQuerySerializer,
    ExternalLabSerializer,
    ExternalLabUpdateSerializer,
    PcrBatchCreateSerializer,
    PcrBatchDetailSerializer,
    PcrBatchQuerySerializer,
    PcrBatchRowSerializer,
    PcrEligibleFacetsSerializer,
    PcrPreviewSerializer,
    PcrReasonSerializer,
    PcrReportSerializer,
    PcrResultsPreviewSerializer,
    PcrResultsSerializer,
    PcrSampleEntrySerializer,
    PcrShipSerializer,
    PcrStepSerializer,
    PcrSummarySerializer,
)
from uploads.access import actor_from_request
from uploads.exceptions import UploadStorageError
from uploads.models import UploadVerification
from uploads.storage import read_object


class PcrPagination(StandardPagination):
    """Standard page plus the per-status counts of the filtered batches (status tabs)."""

    def get_paginated_response_schema(self, schema: dict[str, Any]) -> dict[str, Any]:
        paged = super().get_paginated_response_schema(schema)
        paged["properties"]["status_counts"] = {
            "type": "object",
            "additionalProperties": {"type": "integer"},
        }
        return paged


def _lab_snapshot(lab: ExternalLab) -> dict[str, Any]:
    return {
        "id": str(lab.pk),
        "name": lab.name,
        "contact": lab.contact,
        "address": lab.address,
        "is_active": lab.is_active,
    }


class ExternalLabViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[Any],
):
    queryset = ExternalLab.objects.none()
    serializer_class = ExternalLabSerializer
    pagination_class = StandardPagination
    filter_backends: list[Any] = []
    required_permissions = {
        "list": PCR_READ,
        "retrieve": PCR_READ,
        "create": PCR_MANAGE,
        "partial_update": PCR_MANAGE,
    }
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self) -> QuerySet[ExternalLab]:
        if getattr(self, "swagger_fake_view", False):
            return ExternalLab.objects.none()
        return ExternalLab.objects.filter(organization=self.request.organization).order_by("name")  # type: ignore[attr-defined]

    @extend_schema(parameters=[ExternalLabQuerySerializer])
    def list(self, request: Request) -> Response:
        query = ExternalLabQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        rows = self.get_queryset()
        if query.validated_data["active"] is not None:
            rows = rows.filter(is_active=query.validated_data["active"])
        page = self.paginate_queryset(rows)
        return self.get_paginated_response([_lab_snapshot(row) for row in page or []])

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        return Response(_lab_snapshot(self.get_object()))

    @extend_schema(request=ExternalLabSerializer, responses={201: ExternalLabSerializer})
    def create(self, request: Request) -> Response:
        body = ExternalLabSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        lab = services.create_external_lab(actor_from_request(request), body.validated_data)
        return Response(_lab_snapshot(lab), status=status.HTTP_201_CREATED)

    @extend_schema(request=ExternalLabUpdateSerializer, responses=ExternalLabSerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        body = ExternalLabUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        lab = services.update_external_lab(
            actor_from_request(request), self.get_object().pk, body.validated_data
        )
        return Response(_lab_snapshot(lab))


def _file_response(document: UploadVerification, name: str) -> HttpResponse:
    content = read_object(document.object_key)
    if (
        len(content) != document.size_bytes
        or hashlib.sha256(content).hexdigest() != document.sha256
    ):
        raise UploadStorageError
    response = HttpResponse(content, content_type=document.content_type)
    response["Cache-Control"] = "private, no-store"
    response["Pragma"] = "no-cache"
    response["X-Content-Type-Options"] = "nosniff"
    extension = {"application/pdf": "pdf", "image/png": "png"}.get(document.content_type, "jpg")
    response["Content-Disposition"] = f'attachment; filename="{name}.{extension}"'
    return response


class PcrBatchViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet[Any],
):
    queryset = PcrBatch.objects.none()
    serializer_class = PcrBatchDetailSerializer
    pagination_class = PcrPagination
    filter_backends = [CodeLookupFilter]
    code_lookup_field = "code"
    required_permissions = {
        "list": PCR_READ,
        "retrieve": PCR_READ,
        "summary": PCR_READ,
        "eligible_samples": PCR_MANAGE,
        "eligible_facets": PCR_MANAGE,
        "create": PCR_MANAGE,
        "ready": PCR_MANAGE,
        "ship": PCR_MANAGE,
        "receive": PCR_MANAGE,
        "close": PCR_MANAGE,
        "undo": PCR_MANAGE,
        "void": PCR_MANAGE,
        "results": PCR_MANAGE,
        "results_preview": PCR_MANAGE,
        "results_template": PCR_MANAGE,
        "void_result": PCR_MANAGE,
        "reports": PCR_MANAGE,
        "report_file": PCR_READ,
        "evidence": PCR_READ,
    }
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self) -> QuerySet[PcrBatch]:
        if getattr(self, "swagger_fake_view", False):
            return PcrBatch.objects.none()
        return batches(self.request.organization)  # type: ignore[attr-defined]

    def _detail(self, batch: PcrBatch) -> Response:
        return Response(batch_detail(self.get_queryset().get(pk=batch.pk)))

    @extend_schema(parameters=[PcrBatchQuerySerializer], responses=PcrBatchRowSerializer(many=True))
    def list(self, request: Request) -> Response:
        query = PcrBatchQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        rows = self.filter_queryset(self.get_queryset())
        rows = search_batches(rows, values.get("search", ""))
        if "external_lab" in values:
            rows = rows.filter(external_lab_id=values["external_lab"])
        snapshots = [batch_row(batch) for batch in rows.order_by("-created_at")]
        if "shipped_from" in values:
            start = values["shipped_from"].isoformat()
            snapshots = [row for row in snapshots if (row["shipped_at"] or "")[:10] >= start]
        if "shipped_to" in values:
            end = values["shipped_to"].isoformat()
            snapshots = [
                row for row in snapshots if row["shipped_at"] and row["shipped_at"][:10] <= end
            ]
        counts = {name: 0 for name in STATUSES}
        for row in snapshots:
            counts[row["status"]] += 1
        if "status" in values:
            snapshots = [row for row in snapshots if row["status"] == values["status"]]
        elif not values["include_voided"]:
            snapshots = [row for row in snapshots if row["status"] != "voided"]
        page = self.paginate_queryset(snapshots)  # type: ignore[arg-type]
        response = self.get_paginated_response(page or [])
        response.data["status_counts"] = counts
        return response

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        return Response(batch_detail(self.get_object()))

    @extend_schema(responses=PcrSummarySerializer)
    @action(detail=False, methods=["get"], filter_backends=[])
    def summary(self, request: Request) -> Response:
        return Response(batch_summary(request.organization))  # type: ignore[attr-defined]

    @extend_schema(
        parameters=[EligibleSampleQuerySerializer],
        responses=PcrSampleEntrySerializer(many=True),
    )
    @action(detail=False, methods=["get"], url_path="eligible-samples", filter_backends=[])
    def eligible_samples(self, request: Request) -> Response:
        query = EligibleSampleQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        rows = eligible_samples(actor_from_request(request)).select_related(
            "quadrant", "center", "reading"
        )
        if "quadrant" in values:
            rows = rows.filter(quadrant_id=values["quadrant"])
        if values.get("epi_week"):
            rows = rows.filter(reading__epi_week=values["epi_week"])
        if values.get("search"):
            rows = rows.filter(code__icontains=values["search"])
        page = self.paginate_queryset(rows.order_by("-device_time", "code"))
        return self.get_paginated_response([eligible_sample_row(row) for row in page or []])

    @extend_schema(responses=PcrEligibleFacetsSerializer)
    @action(detail=False, methods=["get"], url_path="eligible-samples/facets", filter_backends=[])
    def eligible_facets(self, request: Request) -> Response:
        rows = eligible_samples(actor_from_request(request))
        quadrants = (
            rows.filter(quadrant__isnull=False)
            .values("quadrant_id", "quadrant__code", "quadrant__name")
            .distinct()
            .order_by("quadrant__code")
        )
        weeks = (
            rows.filter(reading__isnull=False)
            .values_list("reading__epi_week", flat=True)
            .distinct()
            .order_by("-reading__epi_week")
        )
        return Response(
            {
                "quadrants": [
                    {
                        "id": str(row["quadrant_id"]),
                        "code": row["quadrant__code"],
                        "name": row["quadrant__name"],
                    }
                    for row in quadrants
                ],
                "weeks": list(weeks),
            }
        )

    @extend_schema(request=PcrBatchCreateSerializer, responses={201: PcrBatchDetailSerializer})
    def create(self, request: Request) -> Response:
        body = PcrBatchCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        batch = services.create_batch(actor_from_request(request), body.validated_data)
        response = self._detail(batch)
        response.status_code = status.HTTP_201_CREATED
        return response

    def _step(self, request: Request, kind: str, serializer: type[PcrStepSerializer]) -> Response:
        body = serializer(data=request.data)
        body.is_valid(raise_exception=True)
        batch = services.transition_batch(
            actor_from_request(request), self.get_object().pk, kind, body.validated_data
        )
        return self._detail(batch)

    @extend_schema(request=PcrStepSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def ready(self, request: Request, pk: str | None = None) -> Response:
        return self._step(request, "ready", PcrStepSerializer)

    @extend_schema(request=PcrShipSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def ship(self, request: Request, pk: str | None = None) -> Response:
        return self._step(request, "ship", PcrShipSerializer)

    @extend_schema(request=PcrStepSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def receive(self, request: Request, pk: str | None = None) -> Response:
        return self._step(request, "receive", PcrStepSerializer)

    @extend_schema(request=PcrStepSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def close(self, request: Request, pk: str | None = None) -> Response:
        return self._step(request, "close", PcrStepSerializer)

    @extend_schema(request=PcrReasonSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def undo(self, request: Request, pk: str | None = None) -> Response:
        body = PcrReasonSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        batch = services.undo_last_step(
            actor_from_request(request), self.get_object().pk, body.validated_data["reason"]
        )
        return self._detail(batch)

    @extend_schema(request=PcrReasonSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def void(self, request: Request, pk: str | None = None) -> Response:
        body = PcrReasonSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        batch = services.void_batch(
            actor_from_request(request), self.get_object().pk, body.validated_data["reason"]
        )
        return self._detail(batch)

    @extend_schema(request=PcrResultsSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def results(self, request: Request, pk: str | None = None) -> Response:
        body = PcrResultsSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        rows = [
            services.ResultRow(
                sample_id=row["sample_id"],
                target=row["target"],
                outcome=row["outcome"],
                serotype=row["serotype"],
                ct_value=None if row["ct_value"] is None else Decimal(row["ct_value"]),
            )
            for row in body.validated_data["rows"]
        ]
        batch = services.apply_results(actor_from_request(request), self.get_object().pk, rows)
        return self._detail(batch)

    @extend_schema(request=PcrResultsPreviewSerializer, responses=PcrPreviewSerializer)
    @action(detail=True, methods=["post"], url_path="results-preview", filter_backends=[])
    def results_preview(self, request: Request, pk: str | None = None) -> Response:
        body = PcrResultsPreviewSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(
            preview_csv(
                actor_from_request(request), self.get_object(), body.validated_data["content"]
            )
        )

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.STR})
    @action(detail=True, methods=["get"], url_path="results-template", filter_backends=[])
    def results_template(self, request: Request, pk: str | None = None) -> HttpResponse:
        batch = self.get_object()
        response = HttpResponse("﻿" + template_csv(batch), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{batch.code}-resultados.csv"'
        response["Cache-Control"] = "private, no-store"
        return response

    @extend_schema(request=PcrReasonSerializer, responses=PcrBatchDetailSerializer)
    @action(
        detail=True,
        methods=["post"],
        url_path=r"results/(?P<result_id>[0-9a-fA-F-]{36})/void",
        filter_backends=[],
    )
    def void_result(self, request: Request, pk: str | None = None, result_id: str = "") -> Response:
        body = PcrReasonSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        batch = services.void_result(
            actor_from_request(request),
            self.get_object().pk,
            UUID(result_id),
            body.validated_data["reason"],
        )
        return self._detail(batch)

    @extend_schema(request=PcrReportSerializer, responses=PcrBatchDetailSerializer)
    @action(detail=True, methods=["post"], filter_backends=[])
    def reports(self, request: Request, pk: str | None = None) -> Response:
        body = PcrReportSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        batch = services.attach_report(
            actor_from_request(request), self.get_object().pk, body.validated_data["upload_id"]
        )
        return self._detail(batch)

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(
        detail=True,
        methods=["get"],
        url_path=r"reports/(?P<report_id>[0-9a-fA-F-]{36})/file",
        filter_backends=[],
    )
    def report_file(
        self, request: Request, pk: str | None = None, report_id: str = ""
    ) -> HttpResponse:
        batch = self.get_object()
        report = (
            PcrReport.objects.filter(batch=batch, pk=UUID(report_id))
            .select_related("document")
            .first()
        )
        if report is None:
            raise Http404
        return _file_response(report.document, f"{batch.code}-informe")

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(
        detail=True,
        methods=["get"],
        url_path=r"events/(?P<event_id>[0-9a-fA-F-]{36})/evidence",
        filter_backends=[],
    )
    def evidence(self, request: Request, pk: str | None = None, event_id: str = "") -> HttpResponse:
        batch = self.get_object()
        event = (
            PcrBatchEvent.objects.filter(batch=batch, pk=UUID(event_id), evidence__isnull=False)
            .select_related("evidence")
            .first()
        )
        if event is None or event.evidence is None:
            raise Http404
        return _file_response(event.evidence, f"{batch.code}-envio")
