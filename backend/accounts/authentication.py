"""Bearer authentication for the mobile app: opaque access tokens bound to a device session."""

from datetime import datetime
from typing import NoReturn

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from accounts.exceptions import (
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import DeviceSession, RevokeReason, User
from accounts.services import (
    Revocation,
    is_final_upload_available,
    revoke_user_sessions,
    touch_session,
)
from accounts.tokens import hash_token
from core.exceptions import DomainError
from core.time import server_now

BEARER_KEYWORD = b"bearer"
BEARER_PARTS = 2  # keyword + token


def fail(error: type[DomainError]) -> NoReturn:
    """Raise a DRF authentication failure carrying the machine code of a domain error."""
    raise AuthenticationFailed(detail=error.default_detail, code=error.code)


class DeviceBearerAuthentication(BaseAuthentication):
    """`Authorization: Bearer <access>`. Returns `(user, DeviceSession)`; `request.auth` is the session.

    Looks the token up by its SHA-256 digest (unique index), so no plaintext is stored and no
    secret is compared in Python. Everything is revalidated on every request: revocation (also
    of the device), expiry and whether the user is still active.

    A revoked session is let through only for views that set `allows_revoked_final_upload = True`
    and only while its single final upload is available (see `consume_final_upload`).
    """

    # Subclass hook: logout must find a session even when it already ended.
    accepts_ended_sessions = False

    def authenticate(self, request: Request) -> tuple[User, DeviceSession] | None:
        token = self._bearer_token(request)
        if token is None:
            return None
        session = (
            DeviceSession.objects.select_related("user", "device", "organization")
            .filter(access_hash=hash_token(token))
            .first()
        )
        if session is None:
            fail(InvalidTokenError)
        if not self.accepts_ended_sessions:
            self._check_usable(session, request)
            if session.revoked_at is None:
                touch_session(session)
        return session.user, session

    def authenticate_header(self, request: Request) -> str:
        return "Bearer"

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

    def _check_usable(self, session: DeviceSession, request: Request) -> None:
        now = server_now()
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
        if session.access_expires_at <= now:
            fail(TokenExpiredError)

    @staticmethod
    def _final_upload_allowed(session: DeviceSession, request: Request, now: datetime) -> bool:
        """Revoked session, opt-in view, deadline not passed, not used yet, user still active."""
        view = request.parser_context.get("view") if request.parser_context else None
        opted_in = bool(getattr(view, "allows_revoked_final_upload", False))
        return opted_in and session.user.is_active and is_final_upload_available(session, now)


class EndedSessionBearerAuthentication(DeviceBearerAuthentication):
    """Like the bearer authentication but accepts expired and revoked sessions (logout only).

    Ending a session with a token that already expired or was revoked is harmless and must work:
    the app logs out with whatever token it still has.
    """

    accepts_ended_sessions = True
