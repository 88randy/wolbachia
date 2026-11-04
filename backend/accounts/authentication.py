"""Bearer authentication for the mobile app: opaque access tokens bound to a device session."""

from datetime import datetime
from typing import Any, NoReturn

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from accounts.exceptions import (
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import DeviceSession, RevokeReason, TokenPair, User
from accounts.revocation import Revocation, is_final_upload_available, revoke_user_sessions
from accounts.services import touch_session
from accounts.token_pairs import is_access_superseded, is_retired_sibling, mark_access_used
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


def _view_flag(request: Request, name: str) -> bool:
    view = request.parser_context.get("view") if request.parser_context else None
    return bool(getattr(view, name, False))


class DeviceBearerAuthentication(BaseAuthentication):
    """`Authorization: Bearer <access>`. Returns `(user, session)`; `request.auth` is the session.

    Looks the token up by its SHA-256 digest (unique index), so no plaintext is stored and no
    secret is compared in Python. Everything is revalidated on every request: revocation (also
    of the device), expiry, supersession by a newer pair (after the grace window) and whether the
    user is still active. 401 answers carry `WWW-Authenticate: Bearer`.

    Two opt-in flags on the view (read from `request.parser_context["view"]`, verified in DRF
    3.18):

    * `allows_revoked_final_upload`: a revoked session is accepted while its single final upload
      is available. Set by `accounts.final_upload.FinalUploadMixin`, which also spends it.
    * `accepts_ended_sessions`: expired, superseded and revoked sessions are accepted (logout
      only, so the app can always end its session).
    """

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
        if not _view_flag(request, "accepts_ended_sessions"):
            self._check_usable(pair, request)
            if session.revoked_at is None:
                mark_access_used(pair)
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

    def _check_usable(self, pair: TokenPair, request: Request) -> None:
        session, now = pair.session, server_now()
        if session.revoked_at is not None:
            # The access token may have expired while the phone was offline: the final upload
            # does not depend on it (its own deadline applies).
            if self._final_upload_allowed(session, request, now):
                return
            fail(SessionRevokedError)
        if session.device.is_revoked:
            fail(SessionRevokedError)
        if not session.user.is_active:
            revoke_user_sessions(session.user, Revocation(RevokeReason.USER_DEACTIVATED))
            fail(SessionRevokedError)
        if pair.access_expires_at <= now:
            fail(TokenExpiredError)
        if is_access_superseded(pair, now) or is_retired_sibling(pair, now):
            fail(InvalidTokenError)

    @staticmethod
    def _final_upload_allowed(session: DeviceSession, request: Request, now: datetime) -> bool:
        """Revoked session, opt-in view, deadline not passed, not used yet, user still active."""
        return (
            _view_flag(request, "allows_revoked_final_upload")
            and session.user.is_active
            and is_final_upload_available(session, now)
        )


def bearer_flags() -> dict[str, Any]:
    """Names of the view attributes this authenticator reads (kept for the structure tests)."""
    return {"allows_revoked_final_upload": False, "accepts_ended_sessions": False}
