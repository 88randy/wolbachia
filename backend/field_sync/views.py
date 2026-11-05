"""`POST /api/v1/field/sync/`: the phone's one endpoint for uploading events and pulling changes."""

from typing import Any

from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import NotAuthenticated, ParseError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.authentication import DeviceBearerAuthentication
from accounts.final_upload import FinalUploadMixin
from accounts.models import DeviceSession, User
from core.exceptions import PayloadTooLargeError
from core.permissions import HasPermissionCode
from core.snapshots import IF_NONE_MATCH_PARAMETER, SNAPSHOT_CACHE_CONTROL, etag_matches
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from field_sync.codes import REJECTION_QUOTA_EXCEEDED
from field_sync.cursor import decode_cursor
from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.exceptions import DeviceMismatchError
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC, BodySizeWithinLimit
from field_sync.serializers import (
    BootstrapSerializer,
    SyncBatchSerializer,
    SyncResponseSerializer,
    build_envelopes,
)
from field_sync.services import bootstrap_bundle, sync_batch
from field_sync.throttling import FieldSyncDeviceThrottle


def ensure_batch_size_within_limit(data: object) -> None:
    """`413` when the request has more events than `SYNC_MAX_EVENTS` (not a validation error)."""
    events = data.get("events") if isinstance(data, dict) else None
    if isinstance(events, list) and len(events) > settings.SYNC_MAX_EVENTS:
        raise PayloadTooLargeError


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
    permission_classes = [IsAuthenticated, HasPermissionCode, BodySizeWithinLimit]
    required_permissions = {"create": FIELD_EVENT_SYNC}

    @extend_schema(
        request=SyncBatchSerializer,
        responses={200: SyncResponseSerializer},
        parameters=[
            OpenApiParameter(
                "Retry-After",
                OpenApiTypes.INT,
                OpenApiParameter.HEADER,
                response=[200],
                description="Present only when a result has code rejection_quota_exceeded. Seconds until the next organization-local midnight (minimum 1). Keep those events in the outbox/quarantine and resend after this delay; they were not stored. Other results remain final.",
            )
        ],
    )
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
        outcome = sync_batch(batch, self._envelopes(data), cursor)
        body = {"server_time": server_now(), "results": outcome.results, "changes": outcome.changes}
        response = Response(SyncResponseSerializer(body).data)
        retry_after = [
            result.params["retry_after_seconds"]
            for result in outcome.results
            if result.code == REJECTION_QUOTA_EXCEEDED
        ]
        if retry_after:
            response["Retry-After"] = str(max(retry_after))
        return response

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


class FieldBootstrapViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """Versioned assigned bundle. Revoked devices have no final-upload entitlement here."""

    authentication_classes = [DeviceBearerAuthentication]
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permissions = {"list": FIELD_BOOTSTRAP}
    serializer_class = BootstrapSerializer
    pagination_class = None
    throttle_classes = [FieldSyncDeviceThrottle]
    http_method_names = ["get", "options"]

    @extend_schema(
        parameters=[IF_NONE_MATCH_PARAMETER], responses={200: BootstrapSerializer, 304: None}
    )
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        session, user = request.auth, request.user
        if not isinstance(session, DeviceSession) or not isinstance(user, User):
            raise NotAuthenticated
        now = server_now()
        organization = request.organization  # type: ignore[attr-defined]
        batch = BatchContext(
            organization=organization,
            user=user,
            device=session.device,
            sent_at=now,
            received_at=now,
        )
        bundle = bootstrap_bundle(batch)
        version = str(bundle["bundle_version"])
        headers = {
            "ETag": f'"{version}"',
            "Cache-Control": SNAPSHOT_CACHE_CONTROL,
            "Vary": "X-Organization",
        }
        if etag_matches(request, version):
            return Response(status=304, headers=headers)
        return Response(BootstrapSerializer(bundle).data, headers=headers)
