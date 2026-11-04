from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.exceptions import AlreadyVoidedError
from core.pagination import StreamCursorPagination
from core.serializers import OrgScopedModelSerializer
from core.views import OrgScopedViewSet, VoidActionMixin
from organizations.models import Organization
from tests.testapp.models import Widget

WIDGET_PERMISSIONS = {
    "list": "widget.read",
    "retrieve": "widget.read",
    "create": "widget.create",
    "update": "widget.update",
    "partial_update": "widget.update",
    "void": "widget.void",
}


class WidgetSerializer(OrgScopedModelSerializer):
    class Meta:
        model = Widget
        fields = [
            "id",
            "name",
            "code",
            "related",
            "created_at",
            "voided_at",
            "voided_by",
            "void_reason",
        ]
        read_only_fields = ["id", "created_at", "voided_at", "voided_by", "void_reason"]


class StreamWidgetSerializer(WidgetSerializer):
    """Own component name, so the page and cursor list schemas do not collide."""

    class Meta(WidgetSerializer.Meta):
        pass


class WidgetViewSet(VoidActionMixin, OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer
    required_permissions = WIDGET_PERMISSIONS
    code_lookup_field = "code"


class UndeclaredPermissionsViewSet(OrgScopedViewSet):
    """Declares no required_permissions: the defaults must deny everything."""

    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = WidgetSerializer


class StreamWidgetViewSet(OrgScopedViewSet):
    queryset = Widget.objects.order_by("created_at", "id")
    serializer_class = StreamWidgetSerializer
    pagination_class = StreamCursorPagination
    required_permissions = WIDGET_PERMISSIONS
    code_lookup_field = "code"


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


class WriteThenFailView(APIView):
    """Writes a row, then fails with a domain error: the write must not survive."""

    authentication_classes: list[Any] = []
    permission_classes: list[Any] = []
    throttle_classes: list[Any] = []

    def post(self, request: Request) -> Response:
        Widget.objects.create(organization=Organization.objects.first(), name="leaked")
        raise AlreadyVoidedError
