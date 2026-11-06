"""Narrow current-authority OP03 read; no broad history grant or final capability."""

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.authentication import DeviceBearerAuthentication
from core.snapshots import IF_NONE_MATCH_PARAMETER, snapshot_response
from core.views import OrgScopedViewSetMixin
from field_sync.permissions import FIELD_BOOTSTRAP
from field_sync.throttling import FieldSyncDeviceThrottle
from ovitraps.lifecycle.advisory import read_scoped_advisory
from ovitraps.lifecycle.serializers import (
    OvitrapAdvisoryQuerySerializer,
    OvitrapAdvisorySerializer,
)
from ovitraps.models import Ovitrap
from uploads.access import actor_from_request


class FieldOvitrapAdvisoryViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    authentication_classes = [DeviceBearerAuthentication]
    throttle_classes = [FieldSyncDeviceThrottle]
    required_permissions = {"retrieve": FIELD_BOOTSTRAP}
    serializer_class = OvitrapAdvisorySerializer
    queryset = Ovitrap.objects.none()
    pagination_class = None
    http_method_names = ["get", "options"]
    lookup_field = "client_uuid"
    lookup_url_kwarg = "id"
    lookup_value_regex = (
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )

    @extend_schema(
        parameters=[OvitrapAdvisoryQuerySerializer, IF_NONE_MATCH_PARAMETER],
        responses={200: OvitrapAdvisorySerializer, 304: None},
    )
    def retrieve(self, request: Request, id: str) -> Response:
        query = OvitrapAdvisoryQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        snapshot = read_scoped_advisory(
            actor_from_request(request), UUID(id), query.validated_data["at"]
        )
        return snapshot_response(request, snapshot)
