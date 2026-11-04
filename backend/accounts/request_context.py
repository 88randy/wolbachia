"""Reading the organization a request asks for. The `X-Organization` header is parsed only here."""

from rest_framework.request import Request

from accounts.models import DeviceSession
from core.constants import ORGANIZATION_HEADER
from organizations.exceptions import NoActiveMembershipError


def organization_header(request: Request) -> str | None:
    """The raw `X-Organization` header. Use `requested_organization_slug` unless logging in."""
    return request.headers.get(ORGANIZATION_HEADER)


def requested_organization_slug(request: Request) -> str | None:
    """The organization slug a request asks for: its token's, else the `X-Organization` header.

    A device session pins its organization. A header naming a different one is refused as if the
    user were not a member there (`no_active_membership`), never silently overridden.
    """
    header = organization_header(request)
    if not isinstance(request.auth, DeviceSession):
        return header
    pinned = request.auth.organization.slug
    if header and header != pinned:
        raise NoActiveMembershipError
    return pinned
