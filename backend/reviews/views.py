"""Administrative page-number queue and immutable review actions."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from reviews.actions import ReviewDecisionRequest, decide_review, visible_review_ids
from reviews.models import ReviewItem
from reviews.permissions import REVIEW_ITEM_DECIDE, REVIEW_ITEM_READ
from reviews.selectors import list_review_items
from reviews.serializers import (
    ReviewDecisionRequestSerializer,
    ReviewDecisionSerializer,
    ReviewItemDetailSerializer,
    ReviewItemFilterSerializer,
    ReviewItemSerializer,
    ReviewVoidRequestSerializer,
)
from uploads.access import actor_from_request


class ReviewItemViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = ReviewItem.objects.all()
    serializer_class = ReviewItemSerializer
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": REVIEW_ITEM_READ,
        "retrieve": REVIEW_ITEM_READ,
        "accept": REVIEW_ITEM_DECIDE,
        "void": REVIEW_ITEM_DECIDE,
        "open_incident": REVIEW_ITEM_DECIDE,
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["event_type", "code", "courier__email"]
    ordering_fields = ["created_at", "event_type", "kind", "code"]
    ordering = ["-created_at", "-id"]

    def get_serializer_class(self) -> type[ReviewItemSerializer]:
        return ReviewItemDetailSerializer if self.action == "retrieve" else ReviewItemSerializer

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return ReviewItem.objects.none()
        query = ReviewItemFilterSerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        rows = list_review_items(
            actor_from_request(self.request).organization, **query.validated_data
        )
        actor = actor_from_request(self.request)
        if self.action == "retrieve":  # only the requested item needs the visibility check
            try:
                rows = rows.filter(pk=UUID(str(self.kwargs.get("pk"))))
            except ValueError:
                return rows.none()
        candidates = rows.select_related(
            "field_event__organization", "field_event__device", "field_event__created_by"
        )
        return rows.filter(pk__in=visible_review_ids(actor, candidates, REVIEW_ITEM_READ))

    @extend_schema(parameters=[ReviewItemFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    def _decide(self, request: Request, pk: str | None, kind: str) -> Response:
        from reviews.contracts import SafetyDispositionRequest

        try:
            identifier = UUID(str(pk))
        except ValueError:
            raise Http404 from None
        serializer = (
            ReviewVoidRequestSerializer if kind == "void" else ReviewDecisionRequestSerializer
        )
        body = serializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        if "safety_disposition" in data:
            data["safety_disposition"] = SafetyDispositionRequest(**data["safety_disposition"])
        decision = decide_review(
            actor_from_request(request),
            identifier,
            ReviewDecisionRequest(kind=kind, **data),
        )
        return Response(ReviewDecisionSerializer(decision).data, status=201)

    @extend_schema(
        request=ReviewDecisionRequestSerializer, responses={201: ReviewDecisionSerializer}
    )
    @action(detail=True, methods=["post"])
    def accept(self, request: Request, pk: str | None = None) -> Response:
        return self._decide(request, pk, "accept")

    @extend_schema(request=ReviewVoidRequestSerializer, responses={201: ReviewDecisionSerializer})
    @action(detail=True, methods=["post"])
    def void(self, request: Request, pk: str | None = None) -> Response:
        return self._decide(request, pk, "void")

    @extend_schema(
        request=ReviewDecisionRequestSerializer, responses={201: ReviewDecisionSerializer}
    )
    @action(detail=True, methods=["post"], url_path="open-incident")
    def open_incident(self, request: Request, pk: str | None = None) -> Response:
        return self._decide(request, pk, "open_incident")
