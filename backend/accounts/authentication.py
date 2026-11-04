"""Bearer authentication for the mobile app: opaque access tokens bound to a device session."""

from datetime import datetime
from typing import NoReturn

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from accounts.exceptions import (
    BEARER_CHALLENGE,
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import DeviceSession, TokenPair, User
from accounts.revocation import is_final_upload_available
from accounts.services import touch_session
from accounts.token_pairs import claim_access_use, is_access_superseded, is_retired_sibling
from accounts.tokens import hash_token
from core.exceptions import DomainError
from core.time import server_now

BEARER_KEYWORD = b"bearer"
BEARER_PARTS = 2  # keyword + token


def fail(error: type[DomainError]) -> NoReturn:
    """Raise a DRF authentication failure with the machine code and challenge of a domain error.

    The `challenge` attribute makes the exception handler answer `WWW-Authenticate: Bearer`.
    """
    failure = AuthenticationFailed(detail=error.default_detail, code=error.code)
    failure.challenge = error.challenge  # type: ignore[attr-defined]
    raise failure


def _view_attribute(request: Request, name: str, default: object) -> object:
    view = request.parser_context.get("view") if request.parser_context else None
    return getattr(view, name, default)


class DeviceBearerAuthentication(BaseAuthentication):
    """`Authorization: Bearer <access>`. Returns `(user, session)`; `request.auth` is the session.

    Looks the token up by its SHA-256 digest (unique index), so no plaintext is stored and no
    secret is compared in Python. Everything is revalidated on every request: revocation (also
    of the device), expiry, supersession by a newer pair (after the grace window), retirement of
    an unused sibling pair and whether the user is still active. It never writes a revocation:
    it only rejects (a deactivated user's sessions are revoked on refresh and on deactivation).
    401 answers carry `WWW-Authenticate: Bearer`.

    Two opt-in attributes of the view (read from `request.parser_context["view"]`, verified in
    DRF 3.18):

    * `allows_revoked_final_upload` with `final_upload_methods`: a revoked session is accepted
      for those HTTP methods only, while its single final upload is available. Set by
      `accounts.final_upload.FinalUploadMixin`, which also spends it.
    * `accepts_ended_sessions`: expired and revoked sessions are accepted (logout only, so the
      app can always end its session). The pair must still be the current leaf: not superseded
      beyond the grace window and not a retired sibling.
    """

    def authenticate_header(self, request: Request) -> str:
        """Makes a request with no credentials a `401` (not DRF's `403`) when this is the first
        authenticator of a view, as on `/field/sync/`."""
        return BEARER_CHALLENGE

    def authenticate(self, request: Request) -> tuple[User, DeviceSession] | None:
        token = self._bearer_token(request)
        if token is None:
            return None
        pair = (
            TokenPair.objects.select_related("session__user", "session__device", "parent")
            .filter(access_hash=hash_token(token))
            .first()
        )
        if pair is None:
            fail(InvalidTokenError)
        session = pair.session
        if _view_attribute(request, "accepts_ended_sessions", False):
            self._check_current(pair, server_now())
            return session.user, session
        self._check_usable(pair, request)
        if session.revoked_at is None:
            failure = claim_access_use(pair)
            if failure is not None:
                fail(type(failure))
            touch_session(session)
        return session.user, session

    @staticmethod
    def _bearer_token(request: Request) -> str | None:
        parts = get_authorization_header(request).split()
        if not parts or parts[0].lower() != BEARER_KEYWORD:
            return None
        if len(parts) != BEARER_PARTS:
            fail(InvalidTokenError)
        try:
            return parts[1].decode("ascii")
        except UnicodeDecodeError:
            fail(InvalidTokenError)

    @staticmethod
    def _check_current(pair: TokenPair, now: datetime) -> None:
        """The pair must be the current one: not replaced for good, not a retired sibling."""
        if is_access_superseded(pair, now) or is_retired_sibling(pair):
            fail(InvalidTokenError)

    def _check_usable(self, pair: TokenPair, request: Request) -> None:
        session, now = pair.session, server_now()
        if session.revoked_at is not None:
            # The access token may have expired while the phone was offline: the final upload
            # does not depend on it (its own deadline applies), but it must be the current pair.
            if self._final_upload_allowed(session, request, now):
                self._check_current(pair, now)
                return
            fail(SessionRevokedError)
        if session.device.is_revoked or not session.user.is_active:
            fail(SessionRevokedError)
        if pair.access_expires_at <= now:
            fail(TokenExpiredError)
        # A retired sibling is not rejected here: `claim_access_use` resolves it atomically and
        # revokes the session (the copy of a token that was already used), so it is not skipped.
        if is_access_superseded(pair, now):
            fail(InvalidTokenError)

    @staticmethod
    def _final_upload_allowed(session: DeviceSession, request: Request, now: datetime) -> bool:
        """Revoked session, opt-in view and method, deadline not passed, not used, user active."""
        methods = _view_attribute(request, "final_upload_methods", ())
        return (
            bool(_view_attribute(request, "allows_revoked_final_upload", False))
            and request.method in methods  # type: ignore[operator]
            and session.user.is_active
            and is_final_upload_available(session, now)
        )
