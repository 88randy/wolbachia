from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from core.pagination import StreamCursorPagination
from core.views import OrgScopedViewSetMixin
from reviews.models import ReviewItem
from reviews.permissions import REVIEW_ITEM_READ
from reviews.selectors import list_review_items
from reviews.serializers import ReviewItemFilterSerializer, ReviewItemSerializer


class ReviewItemPagination(StreamCursorPagination):
    """Newest first; the id breaks ties between items created in the same instant."""

    ordering = ("-created_at", "-id")  # type: ignore[assignment]


class ReviewItemViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Events the server rejected or flagged for review (W30). Read-only: review items are created
    with their event, and decisions (accept, void, open an incident) arrive with #22."""

    queryset = ReviewItem.objects.all()
    serializer_class = ReviewItemSerializer
    pagination_class = ReviewItemPagination
    http_method_names = ["get", "head", "options"]
    required_permissions = {"list": REVIEW_ITEM_READ}

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return ReviewItem.objects.none()
        query = ReviewItemFilterSerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return list_review_items(
            self.request.organization,  # type: ignore[attr-defined]
            kind=query.validated_data.get("kind"),
            code=query.validated_data.get("code"),
        )

    @extend_schema(parameters=[ReviewItemFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)
