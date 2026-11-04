from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from core.views import OrgScopedViewSetMixin
from shifts.models import Shift
from shifts.permissions import SHIFT_READ
from shifts.selectors import list_shifts
from shifts.serializers import ShiftFilterSerializer, ShiftSerializer


class ShiftViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Shifts of the organization (W28 and W29 read them). Read-only: shifts are written by the
    `shift.open` and `shift.close` sync events; a supervisor's correction is #34."""

    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    http_method_names = ["get", "head", "options"]
    required_permissions = {"list": SHIFT_READ, "retrieve": SHIFT_READ}

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Shift.objects.none()
        scoped = super().get_queryset()
        if self.action != "list":
            return scoped.select_related("motorcycle").prefetch_related("checks__item")
        organization = self.request.organization  # type: ignore[attr-defined]
        query = ShiftFilterSerializer(
            data=self.request.query_params, context={"timezone": organization.timezone}
        )
        query.is_valid(raise_exception=True)
        return list_shifts(scoped, query.to_filters())

    @extend_schema(parameters=[ShiftFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)
