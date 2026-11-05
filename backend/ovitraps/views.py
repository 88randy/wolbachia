"""Read-only default-deny resources; session cookie/CSRF and pinned bearer are inherited."""

from typing import Any, cast

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, serializers, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from core.filters import CodeLookupFilter
from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from ovitraps.models import Bag, Ovitrap, OvitrapReading
from ovitraps.permissions import OVITRAP_READ, READING_READ
from ovitraps.selectors import filter_records
from ovitraps.serializers import (
    BagSerializer,
    IdentityQuerySerializer,
    OvitrapSerializer,
    ReadingSerializer,
    RecordQuerySerializer,
)


class RecordViewSet(
    OrgScopedViewSetMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    http_method_names = ["get", "head", "options"]
    pagination_class = StandardPagination
    filter_backends = [SearchFilter, OrderingFilter]
    required_permissions: dict[str, str] = {}
    query_serializer_class: type[serializers.Serializer[Any]] = IdentityQuerySerializer
    ordering_fields = ["created_at"]
    ordering = ["-created_at", "id"]
    search_fields: list[str] = []
    lookup_value_regex = (
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return cast("QuerySet[Any]", self.__class__.queryset).none()
        queryset = super().get_queryset()
        query = self.query_serializer_class(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        if self.query_serializer_class is IdentityQuerySerializer and (
            code := query.validated_data.get("code")
        ):
            queryset = queryset.filter(**{self.lookup_field: code})
        if self.action != "list":
            query.validated_data.setdefault("status", "all")
        return filter_records(
            queryset,
            query.validated_data,
            self.request.membership,  # type: ignore[attr-defined]
            self.required_permissions[self.action],
        )  # type: ignore[attr-defined]

    @extend_schema(parameters=[IdentityQuerySerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)


class OvitrapViewSet(RecordViewSet):
    lookup_field = "client_uuid"
    lookup_url_kwarg = "id"
    queryset = Ovitrap.objects.select_related(
        "event", "placement", "sampling_point__block__quadrant", "point_version"
    )
    serializer_class = OvitrapSerializer
    required_permissions = {"list": OVITRAP_READ, "retrieve": OVITRAP_READ}


class ReadingViewSet(RecordViewSet):
    queryset = OvitrapReading.objects.select_related(
        "event", "ovitrap__sampling_point__block__quadrant", "bag"
    )
    serializer_class = ReadingSerializer
    required_permissions = {"list": READING_READ, "retrieve": READING_READ}


@extend_schema_view(list=extend_schema(parameters=[RecordQuerySerializer]))
class BagViewSet(RecordViewSet):
    queryset = Bag.objects.select_related(
        "event", "reading__ovitrap__sampling_point__block__quadrant"
    )
    serializer_class = BagSerializer
    required_permissions = {"list": READING_READ, "retrieve": READING_READ}
    query_serializer_class = RecordQuerySerializer
    code_lookup_field = "code"
    filter_backends = [CodeLookupFilter, SearchFilter, OrderingFilter]
    search_fields = ["code"]
    ordering_fields = ["code", "created_at"]
