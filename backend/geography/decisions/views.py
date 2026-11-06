"""Thin endpoints over the same domain services used by non-HTTP callers."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.filters import OrderingFilter
from rest_framework.request import Request
from rest_framework.response import Response

from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from geography.decisions.interventions import (
    InterventionRequest,
    create_intervention,
    visible_interventions,
)
from geography.decisions.models import ThirdPartyIntervention
from geography.decisions.serializers import (
    InterventionQuerySerializer,
    InterventionRequestSerializer,
    InterventionSerializer,
)
from geography.permissions import INTERVENTION_CREATE, INTERVENTION_READ
from uploads.access import actor_from_request


class InterventionViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = ThirdPartyIntervention.objects.none()
    serializer_class = InterventionSerializer
    required_permissions = {"list": INTERVENTION_READ, "create": INTERVENTION_CREATE}
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = StandardPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "date_from", "date_to"]
    ordering = ["-created_at", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        actor = actor_from_request(self.request)
        rows = visible_interventions(actor)
        query = InterventionQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        for field, lookup in (
            ("type", "type_id"),
            ("block", "blocks__block_id"),
            ("date_from", "date_to__gte"),
            ("date_to", "date_from__lte"),
        ):
            if value := query.validated_data.get(field):
                rows = rows.filter(**{lookup: value})
        return rows

    @extend_schema(parameters=[InterventionQuerySerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(request=InterventionRequestSerializer, responses={201: InterventionSerializer})
    def create(self, request: Request) -> Response:
        payload = InterventionRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        row = create_intervention(
            actor_from_request(request), InterventionRequest(**payload.validated_data)
        )
        return Response(InterventionSerializer(row).data, status=201)
