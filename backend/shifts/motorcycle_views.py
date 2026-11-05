"""Fleet management and the offline motorcycle snapshot (#72)."""

from typing import Any, cast

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.models import User
from core.views import OrgScopedViewSetMixin
from core.void_reason import UnblockSerializer, VoidSerializer
from shifts.models import Motorcycle
from shifts.motorcycle_serializers import (
    MotorcycleFilterSerializer,
    MotorcycleSerializer,
    MotorcycleUpdateSerializer,
    MotorcycleWriteSerializer,
)
from shifts.permissions import MOTORCYCLE_MANAGE, MOTORCYCLE_READ, MOTORCYCLE_UNBLOCK
from shifts.services import (
    create_motorcycle,
    unblock_motorcycle,
    update_motorcycle,
    void_motorcycle,
)


class MotorcycleViewSet(
    OrgScopedViewSetMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Motorcycle.objects.all()
    serializer_class = MotorcycleSerializer
    code_lookup_field = "code"
    http_method_names = ["get", "post", "patch", "head", "options"]
    required_permissions = {
        "list": MOTORCYCLE_READ,
        "retrieve": MOTORCYCLE_READ,
        "create": MOTORCYCLE_MANAGE,
        "partial_update": MOTORCYCLE_MANAGE,
        "void": MOTORCYCLE_MANAGE,
        "unblock": MOTORCYCLE_UNBLOCK,
    }

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Motorcycle.objects.none()
        scoped = super().get_queryset().order_by("code", "id")
        if self.action == "list":
            query = MotorcycleFilterSerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            scoped = scoped.filter(**query.validated_data)
        return scoped

    def get_serializer_class(self) -> type[serializers.BaseSerializer[Any]]:
        if self.action == "create":
            return MotorcycleWriteSerializer
        if self.action == "partial_update":
            return MotorcycleUpdateSerializer
        return MotorcycleSerializer

    @extend_schema(
        parameters=[
            MotorcycleFilterSerializer,
            OpenApiParameter(
                "include_voided", bool, description="Include voided motorcycles (default false)."
            ),
        ]
    )
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(request=MotorcycleWriteSerializer, responses={201: MotorcycleSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        organization = request.organization  # type: ignore[attr-defined]
        motorcycle = create_motorcycle(
            organization, payload.validated_data, cast(User, request.user)
        )
        return self._response(motorcycle, status.HTTP_201_CREATED)

    @extend_schema(
        request=MotorcycleUpdateSerializer,
        responses={200: MotorcycleSerializer},
        description=(
            "Update the plate only. Supplying code (even unchanged) returns 400 validation_error "
            "with fields.code immutable_code. To correct a code, void the motorcycle and create "
            "a new one; the voided code remains reserved."
        ),
    )
    def partial_update(self, request: Request, *args: object, **kwargs: object) -> Response:
        motorcycle = self.get_object()
        payload = self.get_serializer(motorcycle, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        return self._response(update_motorcycle(motorcycle, payload.validated_data))

    @extend_schema(request=VoidSerializer, responses={200: MotorcycleSerializer})
    @action(detail=True, methods=["post"])
    def void(self, request: Request, *args: object, **kwargs: object) -> Response:
        motorcycle = self.get_object()
        payload = VoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._response(
            void_motorcycle(motorcycle, cast(User, request.user), **payload.validated_data)
        )

    @extend_schema(request=UnblockSerializer, responses={200: MotorcycleSerializer})
    @action(detail=True, methods=["post"])
    def unblock(self, request: Request, *args: object, **kwargs: object) -> Response:
        motorcycle = self.get_object()
        payload = UnblockSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._response(
            unblock_motorcycle(
                motorcycle, cast(User, request.user), payload.validated_data["reason"]
            )
        )

    def _response(self, motorcycle: Motorcycle, status_code: int = status.HTTP_200_OK) -> Response:
        return Response(
            MotorcycleSerializer(motorcycle, context=self.get_serializer_context()).data,
            status=status_code,
        )
