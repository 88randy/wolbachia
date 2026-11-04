"""`POST /api/v1/field/sync/`: the phone's one endpoint for uploading events and pulling changes."""

from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import NotAuthenticated, ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.authentication import DeviceBearerAuthentication
from accounts.final_upload import FinalUploadMixin
from accounts.models import DeviceSession, User
from core.exceptions import PayloadTooLargeError
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from field_sync.cursor import decode_cursor
from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.exceptions import DeviceMismatchError
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.selectors import Changes, build_changes
from field_sync.serializers import (
    SyncBatchSerializer,
    SyncResponseSerializer,
    build_envelopes,
)
from field_sync.services import ingest_batch
from field_sync.throttling import FieldSyncDeviceThrottle


def ensure_batch_size_within_limit(data: object) -> None:
    """`413` when the request has more events than `SYNC_MAX_EVENTS` (not a validation error)."""
    events = data.get("events") if isinstance(data, dict) else None
    if isinstance(events, list) and len(events) > settings.SYNC_MAX_EVENTS:
        raise PayloadTooLargeError


def declared_body_size(request: Request) -> int:
    """The `Content-Length` of the request; 0 when it is missing or not a number."""
    try:
        return int(request.META.get("CONTENT_LENGTH") or 0)
    except ValueError:
        return 0


class FieldSyncViewSet(FinalUploadMixin, OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """Upload a batch of events and pull what changed, in one request.

    Bearer device tokens only (a web session is `401`). `FinalUploadMixin` lets a phone that an
    administrator revoked with `allow_final_upload` make exactly one upload; its events are all
    stored `in_review`. The mixin holds the user and session locks until the view returns, so
    the batch stays bounded (`SYNC_MAX_EVENTS`, `SYNC_MAX_BODY_BYTES`) and nothing here calls an
    external service.
    """

    authentication_classes = [DeviceBearerAuthentication]
    throttle_classes = [FieldSyncDeviceThrottle]
    serializer_class = SyncBatchSerializer
    pagination_class = None
    http_method_names = ["post", "options"]
    required_permissions = {"create": FIELD_EVENT_SYNC}

    def check_throttles(self, request: Request) -> None:
        """Throttle, then refuse an over-size body before it is read.

        This runs inside `initial`, after authentication and before `FinalUploadMixin` spends
        a final upload, so an oversize request never costs a revoked phone its one upload.
        """
        super().check_throttles(request)
        if declared_body_size(request) > settings.SYNC_MAX_BODY_BYTES:
            raise PayloadTooLargeError

    @extend_schema(request=SyncBatchSerializer, responses={200: SyncResponseSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        """Ingest the events idempotently and answer with one result per event plus `changes`."""
        session, user = request.auth, request.user
        if not isinstance(session, DeviceSession) or not isinstance(user, User):
            raise NotAuthenticated  # unreachable with the bearer authenticator: defense in depth
        received_at = server_now()
        data = self._validated_batch(request)
        if data["device_id"] != session.device_id:
            raise DeviceMismatchError
        organization = request.organization  # type: ignore[attr-defined]
        cursor = (
            None
            if self.is_final_upload
            else decode_cursor(data.get("cursor"), organization.pk, user.pk)
        )
        batch = BatchContext(
            organization=organization,
            user=user,
            device=session.device,
            sent_at=data["sent_at"],
            received_at=received_at,
            is_final_upload=self.is_final_upload,
        )
        results = ingest_batch(batch, self._envelopes(data))
        changes = Changes() if cursor is None else build_changes(batch, cursor)
        body = {"server_time": server_now(), "results": results, "changes": changes}
        return Response(SyncResponseSerializer(body).data)

    @staticmethod
    def _envelopes(data: dict[str, Any]) -> list[EventEnvelope]:
        try:
            return build_envelopes(data["events"])
        except RecursionError:  # serializing a payload nested close to the interpreter limit
            raise ParseError from None

    @staticmethod
    def _validated_batch(request: Request) -> dict[str, Any]:
        try:
            raw = request.data
        except RecursionError:  # a body nested deeper than the JSON parser can follow
            raise ParseError from None
        ensure_batch_size_within_limit(raw)
        serializer = SyncBatchSerializer(data=raw)
        serializer.is_valid(raise_exception=True)
        return dict(serializer.validated_data)
