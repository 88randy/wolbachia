"""`GET /api/v1/bags/{code}/trace/`: the origin of one egg paddle, addressed by its human code."""

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from lab.trace import bag_trace
from lab.trace_serializers import BagTraceSerializer
from organizations.services import effective_scope
from uploads.access import actor_from_request

CODE_ROUTE = r"(?P<bag_code>[A-Za-z0-9_.-]{1,50})"


class BagTraceAction:
    # Mixed into the bag viewset; `required_permissions["trace"]` gates it (reading.read).

    @extend_schema(responses=BagTraceSerializer)
    @action(detail=False, methods=["get"], url_path=CODE_ROUTE + "/trace", url_name="trace")
    def trace(self, request: Request, bag_code: str) -> Response:
        scope = effective_scope(request.membership)  # type: ignore[attr-defined]
        return Response(bag_trace(actor_from_request(request), scope, bag_code))
