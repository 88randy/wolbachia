"""Thin authenticated Lab commands and action-scoped read projections."""

from collections.abc import Callable, Sequence
from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.exceptions import FieldValidationError
from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from incidents.permissions import INCIDENT_MANAGE_TYPE
from lab import selectors
from lab.access import LabTarget
from lab.facade import run_command
from lab.incidents import policy_availability, write_reception_policy
from lab.methods import decide_method, write_method
from lab.models import EggCountAttempt, LabMethod, LabRejection, ReceptionIncidentPolicyVersion
from lab.permissions import (
    BAG_RECEIVE,
    COUNT_CREATE,
    COUNT_READ,
    COUNT_VOID,
    METHOD_MANAGE,
    METHOD_READ,
    METHOD_VERIFY,
)
from lab.queue import current_lab_queue, queue_candidate
from lab.reception import receipt_projection
from lab.serializers import (
    LabCountSerializer,
    LabDiscrepancySerializer,
    LabListQuerySerializer,
    LabMethodDecisionSerializer,
    LabMethodSerializer,
    LabMethodVerificationSerializer,
    LabMethodVersionSerializer,
    LabMethodWriteSerializer,
    LabQueueCandidateSerializer,
    LabQueueQuerySerializer,
    LabReceiptSerializer,
    LabReceptionQuerySerializer,
    LabRejectionSerializer,
    LabVoidContextSerializer,
    LabVoidOutcomeSerializer,
    LabVoidSerializer,
    ReceptionPolicyContextSerializer,
    ReceptionPolicySerializer,
    ReceptionPolicyWriteSerializer,
    RecountRequestSerializer,
)
from uploads.access import actor_from_request

UUID_ROUTE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
VERSION_PARAMETER = OpenApiParameter(
    "version", OpenApiTypes.UUID, OpenApiParameter.PATH, required=True
)


class LabReadViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet[Any]):
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = StandardPagination
    filter_backends: list[Any] = []
    lookup_value_regex = UUID_ROUTE
    query_serializer_class: type[serializers.Serializer[Any]] = LabListQuerySerializer

    def read_query(self) -> dict[str, Any]:
        query = self.query_serializer_class(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return dict(query.validated_data)

    def page_response(
        self,
        rows: QuerySet[Any],
        projection: Any,  # noqa: ANN401 -- closed resource projection
        before_projection: Callable[[list[Any]], None] | None = None,
    ) -> Response:
        """`before_projection` sees the whole page once, e.g. to publish it in constant queries."""
        page = self.paginate_queryset(rows)
        items = list(rows) if page is None else list(page)
        if before_projection is not None:
            before_projection(items)
        body = [projection(row) for row in items]
        return Response(body) if page is None else self.get_paginated_response(body)


class LabResultViewSet(LabReadViewSet):
    result_kind = "count"
    queryset = EggCountAttempt.objects.none()
    serializer_class: type[serializers.Serializer[Any]] = LabCountSerializer
    required_permissions = {
        "list": COUNT_READ,
        "retrieve": COUNT_READ,
        "queue": COUNT_CREATE,
        "void": COUNT_VOID,
        "void_context": COUNT_VOID,
    }

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        model = EggCountAttempt if self.result_kind == "count" else LabRejection
        query = self.read_query() if self.action == "list" else {"include_voided": True}
        return selectors.result_rows(actor_from_request(self.request), model, query)

    @extend_schema(parameters=[LabListQuerySerializer])
    def list(self, request: Request) -> Response:
        actor = actor_from_request(request)
        from lab.independent_qa.services import numeric_read_transaction

        with numeric_read_transaction(actor):
            return self.result_list_response(actor)

    def result_list_response(self, actor: Any) -> Response:  # noqa: ANN401 -- actual request UploadActor
        page_facts: list[selectors.BagLabFacts] = []

        def prepare(page: list[Any]) -> None:
            selectors.publish_result_page(actor, page)
            page_facts.append(selectors.result_page_facts(page))

        response = self.page_response(
            self.get_queryset(),
            lambda row: selectors.result_projection(row, page_facts[0]),
            prepare,
        )
        if self.result_kind == "count" and "qa_state" in self.request.query_params:
            from lab.independent_qa.services import publish_inferred_counts

            base = {key: value for key, value in self.read_query().items() if key != "qa_state"}
            publish_inferred_counts(
                actor, selectors.result_rows(actor, EggCountAttempt, base), COUNT_READ
            )
        return response

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        return Response(
            selectors.published_result_projection(
                actor_from_request(request), get_object_or_404(self.get_queryset(), pk=pk)
            )
        )

    @extend_schema(responses=LabVoidContextSerializer)
    @action(detail=True, methods=["get"], url_path="void-context")
    def void_context(self, request: Request, pk: str | None = None) -> Response:
        return Response(
            selectors.void_context(actor_from_request(request), (self.result_kind, UUID(str(pk))))
        )

    @extend_schema(request=LabVoidSerializer, responses=LabVoidOutcomeSerializer)
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str | None = None) -> Response:
        operation = "void_count" if self.result_kind == "count" else "void_rejection"
        return run_command(
            request, LabTarget(self.result_kind, UUID(str(pk))), (operation, LabVoidSerializer)
        )


class EggCountViewSet(LabResultViewSet):
    @extend_schema(
        parameters=[LabQueueQuerySerializer], responses=LabQueueCandidateSerializer(many=True)
    )
    @action(detail=False, methods=["get"])
    def queue(self, request: Request) -> Response:
        # Pagination is a transport concern, not part of the persisted queue context.
        supplied = {
            key: value
            for key, value in request.query_params.items()
            if key not in {"page", "page_size", "format"}
        }
        query = LabQueueQuerySerializer(data=supplied)
        query.is_valid(raise_exception=True)
        return self.page_response(
            current_lab_queue(actor_from_request(request), query.validated_data), queue_candidate
        )


class LabRejectionViewSet(LabResultViewSet):
    result_kind = "rejection"
    queryset = LabRejection.objects.none()
    serializer_class = LabRejectionSerializer
    required_permissions = {
        "list": COUNT_READ,
        "retrieve": COUNT_READ,
        "void": COUNT_VOID,
        "void_context": COUNT_VOID,
    }


class LabReceptionViewSet(LabReadViewSet):
    serializer_class = LabReceiptSerializer
    query_serializer_class = LabReceptionQuerySerializer
    required_permissions = {"list": BAG_RECEIVE}

    @extend_schema(parameters=[LabReceptionQuerySerializer])
    def list(self, request: Request) -> Response:
        return self.page_response(
            selectors.reception_rows(actor_from_request(request), self.read_query()),
            receipt_projection,
        )


class LabDiscrepancyViewSet(LabReadViewSet):
    serializer_class = LabDiscrepancySerializer
    required_permissions = {"list": BAG_RECEIVE, "retrieve": BAG_RECEIVE}

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            from lab.models import ReceptionDiscrepancy

            return ReceptionDiscrepancy.objects.none()
        return selectors.discrepancy_rows(actor_from_request(self.request), self.read_query())

    @extend_schema(parameters=[LabListQuerySerializer])
    def list(self, request: Request) -> Response:
        actor = actor_from_request(request)
        return self.page_response(
            self.get_queryset(), lambda row: selectors.discrepancy_projection(actor, row)
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        return Response(
            selectors.discrepancy_projection(
                actor_from_request(request), get_object_or_404(self.get_queryset(), pk=pk)
            )
        )


class RecountRequestViewSet(LabReadViewSet):
    serializer_class = RecountRequestSerializer
    required_permissions = {"list": COUNT_READ}

    @extend_schema(parameters=[LabListQuerySerializer])
    def list(self, request: Request) -> Response:
        actor = actor_from_request(request)
        from lab.independent_qa.services import numeric_read_transaction

        with numeric_read_transaction(actor):
            return self.page_response(
                selectors.recount_rows(actor, self.read_query()),
                lambda row: dict(RecountRequestSerializer(row).data),
                lambda page: self.publish_page(actor, page),
            )

    def publish_page(self, actor: Any, page: Sequence[Any]) -> None:  # noqa: ANN401 -- actual request UploadActor
        from lab.independent_qa.services import NumericPublication, publish_numeric_access_batch

        publish_numeric_access_batch(
            actor, [row.count for row in page], NumericPublication(COUNT_READ, "request")
        )


class LabMethodViewSet(LabReadViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin):
    queryset = LabMethod.objects.order_by("code", "id")
    serializer_class = LabMethodSerializer
    required_permissions = {
        "list": METHOD_READ,
        "retrieve": METHOD_READ,
        "create": METHOD_MANAGE,
        "versions": METHOD_READ,
        "publish_version": METHOD_MANAGE,
        "verify": METHOD_VERIFY,
        "withdraw": METHOD_VERIFY,
    }

    @extend_schema(request=LabMethodWriteSerializer, responses={201: LabMethodVersionSerializer})
    def create(self, request: Request) -> Response:
        payload = LabMethodWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        if not payload.validated_data.get("code"):
            raise FieldValidationError("code", "required")
        return Response(
            LabMethodVersionSerializer(
                write_method(actor_from_request(request), payload.validated_data)
            ).data,
            status=201,
        )

    @extend_schema(responses=LabMethodVersionSerializer(many=True))
    @action(detail=True, methods=["get"])
    def versions(self, request: Request, pk: str | None = None) -> Response:
        method = get_object_or_404(self.get_queryset(), pk=pk)
        return self.page_response(
            method.versions.all(), lambda row: LabMethodVersionSerializer(row).data
        )

    @extend_schema(request=LabMethodWriteSerializer, responses={201: LabMethodVersionSerializer})
    @versions.mapping.post
    def publish_version(self, request: Request, pk: str | None = None) -> Response:
        method = get_object_or_404(self.get_queryset(), pk=pk)
        payload = LabMethodWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        if "code" in payload.validated_data:
            raise FieldValidationError("code", "unknown_field")
        return Response(
            LabMethodVersionSerializer(
                write_method(actor_from_request(request), payload.validated_data, method.pk)
            ).data,
            status=201,
        )

    def verification_response(
        self, request: Request, identity: tuple[str | None, str | None], decision: str
    ) -> Response:
        method_id, version_id = identity
        method = get_object_or_404(self.get_queryset(), pk=method_id)
        version = get_object_or_404(method.versions.all(), pk=version_id)
        payload = LabMethodDecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = decide_method(
            actor_from_request(request),
            version.pk,
            {**payload.validated_data, "decision": decision},
        )
        return Response(LabMethodVerificationSerializer(result).data, status=201)

    @extend_schema(
        request=LabMethodDecisionSerializer,
        responses={201: LabMethodVerificationSerializer},
        parameters=[VERSION_PARAMETER],
    )
    @action(
        detail=True, methods=["post"], url_path="versions/(?P<version>" + UUID_ROUTE + ")/verify"
    )
    def verify(
        self, request: Request, pk: str | None = None, version: str | None = None
    ) -> Response:
        return self.verification_response(request, (pk, version), "verify")

    @extend_schema(
        request=LabMethodDecisionSerializer,
        responses={201: LabMethodVerificationSerializer},
        parameters=[VERSION_PARAMETER],
    )
    @action(
        detail=True, methods=["post"], url_path="versions/(?P<version>" + UUID_ROUTE + ")/withdraw"
    )
    def withdraw(
        self, request: Request, pk: str | None = None, version: str | None = None
    ) -> Response:
        return self.verification_response(request, (pk, version), "withdraw")


class ReceptionPolicyViewSet(LabReadViewSet):
    serializer_class = ReceptionPolicyContextSerializer
    required_permissions = {"list": INCIDENT_MANAGE_TYPE, "versions": INCIDENT_MANAGE_TYPE}

    def list(self, request: Request) -> Response:
        current = ReceptionIncidentPolicyVersion.objects.filter(
            organization=actor_from_request(request).organization
        ).first()
        return Response(
            {
                "revision": 0 if current is None else current.revision,
                "policy": None if current is None else ReceptionPolicySerializer(current).data,
                "availability": policy_availability(current),
            }
        )

    @extend_schema(
        request=ReceptionPolicyWriteSerializer, responses={201: ReceptionPolicySerializer}
    )
    @action(detail=False, methods=["post"])
    def versions(self, request: Request) -> Response:
        payload = ReceptionPolicyWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = write_reception_policy(actor_from_request(request), payload.validated_data)
        return Response(ReceptionPolicySerializer(result).data, status=201)
