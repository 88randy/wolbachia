"""Read-only scoped proposal listing. Decisions belong to B-33."""

from typing import Any, Literal

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.request import Request
from rest_framework.response import Response

from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from geography.decisions.serializers import (
    RelocationDecisionRequestSerializer,
    RelocationDecisionResultSerializer,
)
from geography.decisions.services import RelocationDecisionRequest, decide_relocation
from ovitraps.lifecycle.models import RelocationProposal, RemovalAttempt
from ovitraps.lifecycle.selectors import filter_relocations, relocation_proposals
from ovitraps.lifecycle.serializers import (
    RelocationQuerySerializer,
    RelocationSerializer,
    RemovalResolutionRequestSerializer,
    RemovalResolutionSerializer,
)
from ovitraps.lifecycle.services import RemovalResolutionRequest, resolve_removal
from ovitraps.permissions import OVITRAP_REMOVAL_RESOLVE, RELOCATION_DECIDE, RELOCATION_READ
from uploads.access import actor_from_request


class RelocationViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset: QuerySet[RelocationProposal] = RelocationProposal.objects.none()
    serializer_class = RelocationSerializer
    required_permissions = {
        "list": RELOCATION_READ,
        "approve": RELOCATION_DECIDE,
        "reject": RELOCATION_DECIDE,
    }
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = StandardPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "event__device_time", "ovitrap__sampling_point__code"]
    ordering = ["-created_at", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return RelocationProposal.objects.none()
        self.queryset = relocation_proposals(self.request.organization)  # type: ignore[attr-defined]
        visible = super().get_queryset()
        if self.action != "list":
            return visible
        query = RelocationQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return filter_relocations(visible, query.validated_data, self.request.membership)  # type: ignore[attr-defined]

    @extend_schema(parameters=[RelocationQuerySerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(
        request=RelocationDecisionRequestSerializer,
        responses={201: RelocationDecisionResultSerializer},
    )
    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        return self._decide(request, "approved")

    @extend_schema(
        request=RelocationDecisionRequestSerializer,
        responses={201: RelocationDecisionResultSerializer},
    )
    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk: str | None = None) -> Response:
        return self._decide(request, "rejected")

    def _decide(self, request: Request, decision: Literal["approved", "rejected"]) -> Response:
        proposal = self.get_object()
        payload = RelocationDecisionRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = decide_relocation(
            actor_from_request(request),
            proposal.pk,
            RelocationDecisionRequest(decision=decision, **payload.validated_data),
        )
        return Response(RelocationDecisionResultSerializer(result).data, status=201)


class RemovalViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = RemovalAttempt.objects.all()
    serializer_class = RemovalResolutionSerializer
    required_permissions = {"resolve": OVITRAP_REMOVAL_RESOLVE}
    http_method_names = ["post", "options"]

    @extend_schema(
        request=RemovalResolutionRequestSerializer, responses={201: RemovalResolutionSerializer}
    )
    @action(detail=True, methods=["post"])
    def resolve(self, request: Request, pk: str | None = None) -> Response:
        removal = self.get_object()
        payload = RemovalResolutionRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        resolution = resolve_removal(
            request.membership,  # type: ignore[attr-defined]
            removal.pk,
            RemovalResolutionRequest(**payload.validated_data),
        )
        return Response(self.get_serializer(resolution).data, status=201)
