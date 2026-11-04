"""Views that accept the final upload of a revoked phone (used by `/field/sync/` in #5)."""

from typing import Any

from django.db import transaction
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.models import DeviceSession
from accounts.revocation import consume_final_upload

SESSION_REVOKED_HEADER = "X-Session-Revoked"
ERROR_STATUS = 400


class FinalUploadMixin:
    """Mix into an `APIView`/viewset to accept one upload from a session revoked with
    `allow_final_upload`.

    The mixin does everything, so a view cannot forget a step:

    * it opts the view in (`allows_revoked_final_upload`), so the bearer authentication lets an
      eligible revoked session through;
    * it runs the whole request in one transaction and spends the single final upload first
      (`consume_final_upload`), so two concurrent uploads cannot both pass and a failed request
      (any answer of status 400 or above) rolls the spending back: the phone can retry;
    * it adds `X-Session-Revoked: true` to the response and sets `self.is_final_upload`, which
      the view must use to mark the events it records as `in_review` (#5).

    Put it before the DRF base class: `class SyncView(FinalUploadMixin, APIView)`.
    """

    allows_revoked_final_upload = True
    is_final_upload = False

    def dispatch(self, request: Any, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
        with transaction.atomic():
            response = super().dispatch(request, *args, **kwargs)  # type: ignore[misc]
            if self.is_final_upload and response.status_code >= ERROR_STATUS:
                transaction.set_rollback(True)
        return response

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        super().initial(request, *args, **kwargs)  # type: ignore[misc]
        session = request.auth
        if isinstance(session, DeviceSession) and session.revoked_at is not None:
            consume_final_upload(session)
            self.is_final_upload = True

    def finalize_response(
        self,
        request: Request,
        response: Response,
        *args: Any,  # noqa: ANN401
        **kwargs: Any,  # noqa: ANN401
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)  # type: ignore[misc]
        if self.is_final_upload and response.status_code < ERROR_STATUS:
            response[SESSION_REVOKED_HEADER] = "true"
        return response
