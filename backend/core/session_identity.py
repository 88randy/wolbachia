"""The server attests who a response was answered for (`X-Session-Identity`, #82).

All browser tabs share one session cookie, so a client cannot know from its own state which
identity a response belongs to: a request sent under user A can be answered with the cookie of user
B when another tab signed in meanwhile. Every authenticated `/api/v1/` response therefore carries an
opaque attestation of the (user, active organization, session) it was answered for; the web client
compares it with the one it holds and discards a response that does not match.

The value is an HMAC (SHA-256, key derived from `SECRET_KEY`) truncated to 128 bits: it is not
reversible, carries no personal data and changes when the user, the organization or the session
(a new login) changes. It is meaningless without the key, so it cannot be forged by a client.
"""

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.utils.crypto import salted_hmac

IDENTITY_HEADER = "X-Session-Identity"
API_PREFIX = "/api/v1/"
_SALT = "wolbachia.session-identity"
_DIGEST_CHARS = 32  # 128 bits of the SHA-256 hex digest


def remember_active_organization(request: object, organization_id: object) -> None:
    """Views call this once they resolved the organization the request acts in.

    DRF's `Request` wraps the Django request: the middleware only sees the wrapped one, so the
    value is stored there.
    """
    wrapped = getattr(request, "_request", request)
    wrapped.attested_organization_id = "" if organization_id is None else str(organization_id)  # type: ignore[attr-defined]


def _session_id(request: HttpRequest) -> str:
    key = getattr(getattr(request, "session", None), "session_key", None)
    if key:
        return f"s:{key}"
    auth = getattr(request, "auth", None)  # a device session of the mobile app
    return "" if auth is None else f"d:{auth.pk}"


def session_identity(request: HttpRequest) -> str | None:
    """The attestation of a request's identity, or `None` when nobody is authenticated."""
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return None
    organization_id = getattr(request, "attested_organization_id", "")
    message = f"{user.pk}|{organization_id}|{_session_id(request)}"
    return salted_hmac(_SALT, message, algorithm="sha256").hexdigest()[:_DIGEST_CHARS]


class SessionIdentityMiddleware:
    """Adds `X-Session-Identity` to every authenticated `/api/v1/` response."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        if request.path.startswith(API_PREFIX):
            identity = session_identity(request)
            if identity is not None:
                response[IDENTITY_HEADER] = identity
        return response
