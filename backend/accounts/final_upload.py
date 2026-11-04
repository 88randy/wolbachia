"""Views that accept the final upload of a revoked phone (used by `/field/sync/` in #5)."""

import sys
from http import HTTPStatus
from typing import Any

from django.db import transaction
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.exceptions import SessionRevokedError
from accounts.models import DeviceSession
from accounts.revocation import consume_final_upload

SESSION_REVOKED_HEADER = "X-Session-Revoked"


class FinalUploadMixin:
    """Mix into an `APIView`/viewset to accept one upload from a session revoked with
    `allow_final_upload`.

    The mixin does everything, so a view cannot forget a step:

    * it opts the view in (`allows_revoked_final_upload`) for the HTTP methods in
      `final_upload_methods` (default `POST`, the upload): the bearer authentication lets an
      eligible revoked session through for those methods only, so `OPTIONS` or `GET` never spend
      it and are answered `401 session_revoked`;
    * after authentication (whose activity bookkeeping therefore never runs inside this
      transaction) it opens a transaction and spends the single final upload first
      (`consume_final_upload`, which takes the user and session locks in the global order), so two
      concurrent uploads cannot both pass and the view's own writes and the spending commit
      together; any answer of status 400 or above rolls both back, and the phone can retry;
    * it adds `X-Session-Revoked: true` to the response and sets `self.is_final_upload`, which
      the view must use to mark the events it records as `in_review` (#5).

    Put it before the DRF base class: `class SyncView(FinalUploadMixin, APIView)`. Requests from
    sessions that are not revoked run exactly as without the mixin (no transaction opened here).
    """

    allows_revoked_final_upload = True
    final_upload_methods: tuple[str, ...] = ("POST",)
    is_final_upload = False
    _final_upload_transaction: Any = None

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        super().initial(request, *args, **kwargs)  # type: ignore[misc]
        session = request.auth
        if not isinstance(session, DeviceSession) or session.revoked_at is None:
            return
        if request.method not in self.final_upload_methods:
            raise SessionRevokedError
        self._final_upload_transaction = transaction.atomic()
        self._final_upload_transaction.__enter__()
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
        failed = response.status_code >= HTTPStatus.BAD_REQUEST
        if self.is_final_upload and not failed:
            response[SESSION_REVOKED_HEADER] = "true"
        self._close_final_upload_transaction(rollback=failed)
        return response

    def dispatch(self, request: Any, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
        try:
            return super().dispatch(request, *args, **kwargs)  # type: ignore[misc,no-any-return]
        except BaseException:
            self._close_final_upload_transaction(rollback=True)
            raise

    def _close_final_upload_transaction(self, rollback: bool) -> None:
        opened, self._final_upload_transaction = self._final_upload_transaction, None
        if opened is None:
            return
        if rollback:
            transaction.set_rollback(True)
        opened.__exit__(*sys.exc_info())
