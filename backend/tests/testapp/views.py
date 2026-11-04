from typing import Any

from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.pagination import StreamCursorPagination
from core.permissions import HasPermissionCode
from core.views import OrgScopedViewSet, VoidActionMixin
from tests.testapp.models import Widget


class WidgetSerializer(serializers.ModelSerializer[Widget]):
    class Meta:
        model = Widget
        fields = ["id", "name", "created_at", "voided_at", "voided_by", "void_reason"]
        read_only_fields = ["id", "created_at", "voided_at", "voided_by", "void_reason"]


class WidgetViewSet(VoidActionMixin, OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer


class RestrictedWidgetViewSet(OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "widget.manage"


class StreamWidgetViewSet(OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer
    pagination_class = StreamCursorPagination


class BoomView(APIView):
    """Raises an unexpected error to exercise the 500 envelope."""

    def get(self, request: Request) -> Response:
        raise RuntimeError("boom")


class OnePerMinuteThrottle(AnonRateThrottle):
    rate = "1/min"


class ThrottledView(APIView):
    authentication_classes: list[Any] = []
    permission_classes: list[Any] = []
    throttle_classes = [OnePerMinuteThrottle]

    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})
