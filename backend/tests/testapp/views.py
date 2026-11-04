from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.fields import OrgScopedPrimaryKeyRelatedField
from core.pagination import StreamCursorPagination
from core.views import OrgScopedViewSet, VoidActionMixin
from tests.testapp.models import Widget

WIDGET_PERMISSIONS = {
    "list": "widget.read",
    "retrieve": "widget.read",
    "create": "widget.create",
    "update": "widget.update",
    "partial_update": "widget.update",
    "void": "widget.void",
}


class WidgetSerializer(serializers.ModelSerializer[Widget]):
    related = OrgScopedPrimaryKeyRelatedField(
        queryset=Widget.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Widget
        fields = ["id", "name", "related", "created_at", "voided_at", "voided_by", "void_reason"]
        read_only_fields = ["id", "created_at", "voided_at", "voided_by", "void_reason"]


class WidgetViewSet(VoidActionMixin, OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer
    required_permissions = WIDGET_PERMISSIONS


class UndeclaredPermissionsViewSet(OrgScopedViewSet):
    """Declares no required_permissions: the defaults must deny everything."""

    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer


class StreamWidgetViewSet(OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer
    pagination_class = StreamCursorPagination
    required_permissions = WIDGET_PERMISSIONS


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
