"""Permission code of the sync endpoint (profiles hold it as data, seeded for `courier`) and
the request gate that refuses over-size bodies."""

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from core.exceptions import PayloadTooLargeError

FIELD_EVENT_SYNC = "field_event.sync"


def declared_body_size(request: Request) -> int:
    """The `Content-Length` of the request; 0 when it is missing or not a number."""
    try:
        return int(request.META.get("CONTENT_LENGTH") or 0)
    except ValueError:
        return 0


class BodySizeWithinLimit(BasePermission):
    """Refuses (`413`) a body over `SYNC_MAX_BODY_BYTES` by its `Content-Length`, before it is read.

    It is a gate, not an authorization: it grants everything else. It runs inside DRF's
    `initial`, after authentication and before `FinalUploadMixin` spends a final upload, so an
    oversize request never costs a revoked phone its one upload.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        if declared_body_size(request) > settings.SYNC_MAX_BODY_BYTES:
            raise PayloadTooLargeError
        return True
