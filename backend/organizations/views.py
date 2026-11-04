from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import ORGANIZATION_HEADER
from organizations.selectors import get_me_context
from organizations.serializers import MeSerializer


class MeView(APIView):
    """Who am I: user, active organization, profiles, permissions and scope.

    Unlike scoped resources, several memberships without `X-Organization` is not an error here:
    it answers `organization: null` plus the `organizations` list to choose from.
    """

    uses_organization_header = True

    @extend_schema(responses=MeSerializer)
    def get(self, request: Request) -> Response:
        context = get_me_context(request.user, request.headers.get(ORGANIZATION_HEADER))  # type: ignore[arg-type]
        return Response(MeSerializer(context).data)
