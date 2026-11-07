"""Views that accept the final upload of a revoked phone (used by `/field/sync/` in #5)."""

import sys
from http import HTTPStatus
from typing import Any
from uuid import UUID

from django.db import transaction
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework.response import Response

from accounts.exceptions import SessionRevokedError
from accounts.models import DeviceSession, User
from accounts.revocation import consume_final_upload, is_final_upload_available
from core.exceptions import DomainError
from core.time import server_now

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
    final_upload_contention_errors: tuple[type[DomainError], ...] = ()
    _final_upload_transaction: Any = None

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        super().initial(request, *args, **kwargs)  # type: ignore[misc]
        session = request.auth
        if not isinstance(session, DeviceSession) or session.revoked_at is None:
            return
        if request.method not in self.final_upload_methods:
            raise SessionRevokedError
        deferred_error = None
        try:
            participants = self.prepare_final_upload_participants(request)
        except (APIException, DomainError) as error:
            # Expected API/domain preparation errors share the canonical fresh eligibility boundary.
            deferred_error = error
            participants = ()
        self._final_upload_transaction = transaction.atomic()
        self._final_upload_transaction.__enter__()
        self._acquire_final_upload_participants(
            session, tuple(sorted({session.user_id, *participants}))
        )
        consume_final_upload(session)
        self.is_final_upload = True
        if deferred_error is not None:
            raise deferred_error

    def prepare_final_upload_participants(self, request: Request) -> tuple[UUID, ...]:
        """Opt-in domain hook: authenticated, bounded, read-only and outside retained locks."""
        return ()

    def lock_final_upload_participants(self, identifiers: tuple[UUID, ...]) -> None:
        """Default opt-in views retain actor-only locking and their existing lifecycle."""
        list(User.objects.filter(pk__in=identifiers).order_by("pk").select_for_update(no_key=True))

    def _acquire_final_upload_participants(
        self, session: DeviceSession, identifiers: tuple[UUID, ...]
    ) -> None:
        try:
            # Roll back an unsuccessful closure before any fresh query; release partial User locks.
            with transaction.atomic():
                self.lock_final_upload_participants(identifiers)
        except self.final_upload_contention_errors as error:
            if error.status_code != HTTPStatus.TOO_MANY_REQUESTS:
                raise
            # No Device/Session/domain lock here. Withdrawal still outranks retryable contention.
            fresh = DeviceSession.objects.filter(pk=session.pk, user_id=session.user_id).first()
            now = server_now()
            if fresh is None or not is_final_upload_available(fresh, now):
                raise SessionRevokedError from error
            raise

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
