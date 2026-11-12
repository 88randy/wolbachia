from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.views import OrgScopedViewSetMixin
from reviews.serializers import ShiftDecisionRequestSerializer, ShiftDecisionSerializer
from shifts.models import Shift
from shifts.permissions import SHIFT_READ, SHIFT_VALIDATE
from shifts.selectors import list_shifts
from shifts.serializers import ShiftDetailSerializer, ShiftFilterSerializer, ShiftSerializer
from shifts.validation import ShiftDecisionRequest, decide_shift, readable_shifts
from uploads.access import actor_from_request


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
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": SHIFT_READ,
        "retrieve": SHIFT_READ,
        "approve": SHIFT_VALIDATE,
        "observe": SHIFT_VALIDATE,
    }
    code_lookup_field = "code"

    def get_serializer_class(self) -> type[ShiftSerializer]:
        return ShiftDetailSerializer if self.action == "retrieve" else ShiftSerializer

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Shift.objects.none()
        scoped = super().get_queryset()
        actor = actor_from_request(self.request)
        if self.action == "list":
            organization = self.request.organization  # type: ignore[attr-defined]
            query = ShiftFilterSerializer(
                data=self.request.query_params, context={"timezone": organization.timezone}
            )
            query.is_valid(raise_exception=True)
            # Narrow by the requested filters first, so the per-row scope check below only
            # runs on the rows that could be returned (same rows, far fewer scope lookups).
            scoped = list_shifts(scoped, query.to_filters())
        elif self.action == "retrieve":
            try:
                scoped = scoped.filter(pk=UUID(str(self.kwargs.get("pk"))))
            except ValueError:
                raise Http404 from None
        scoped = readable_shifts(actor, scoped, SHIFT_READ)
        if self.action != "list":
            return scoped.select_related("motorcycle").prefetch_related("checks__item")
        return scoped

    @extend_schema(parameters=[ShiftFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    def _validate_shift(self, request: Request, pk: str | None, kind: str) -> Response:
        try:
            identifier = UUID(str(pk))
        except ValueError:
            raise Http404 from None
        body = ShiftDecisionRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        decision = decide_shift(
            actor_from_request(request),
            identifier,
            ShiftDecisionRequest(kind=kind, **body.validated_data),
        )
        return Response(ShiftDecisionSerializer(decision).data, status=201)

    @extend_schema(request=ShiftDecisionRequestSerializer, responses={201: ShiftDecisionSerializer})
    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk: str | None = None) -> Response:
        return self._validate_shift(request, pk, "approve")

    @extend_schema(request=ShiftDecisionRequestSerializer, responses={201: ShiftDecisionSerializer})
    @action(detail=True, methods=["post"])
    def observe(self, request: Request, pk: str | None = None) -> Response:
        return self._validate_shift(request, pk, "observe")
