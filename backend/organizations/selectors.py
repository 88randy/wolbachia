from dataclasses import dataclass, field

from django.db.models import QuerySet

from accounts.models import User
from organizations.exceptions import NoActiveMembershipError, OrganizationHeaderRequiredError
from organizations.models import Membership, Organization, Profile, default_scope


@dataclass(frozen=True)
class MeContext:
    """What `GET /me/` returns. `organization` is None when the user must still choose one."""

    user: User
    organization: Organization | None
    profiles: list[Profile]
    permissions: list[str]
    scope: dict[str, list[str]] = field(default_factory=default_scope)
    organizations: list[Organization] = field(default_factory=list)


def _active_memberships(user: User) -> QuerySet[Membership]:
    return Membership.objects.filter(
        user=user, is_active=True, organization__is_active=True
    ).select_related("organization")


def resolve_active_membership(user: User, organization_slug: str | None) -> Membership:
    """Pick the membership that defines the active organization of a request.

    Active means the membership and its organization are both active. A given slug is always
    validated, even for users with one membership. Raises `NoActiveMembershipError` (403) or,
    for several memberships and no slug, `OrganizationHeaderRequiredError` (400).
    """
    memberships = _active_memberships(user)
    if organization_slug:
        membership = memberships.filter(organization__slug=organization_slug).first()
        if membership is None:
            raise NoActiveMembershipError
        return membership
    candidates = list(memberships[:2])
    if not candidates:
        raise NoActiveMembershipError
    if len(candidates) > 1:
        raise OrganizationHeaderRequiredError
    return candidates[0]


def list_active_organizations(user: User) -> list[Organization]:
    memberships = _active_memberships(user).order_by("organization__name")
    return [membership.organization for membership in memberships]


def list_active_profiles(membership: Membership) -> list[Profile]:
    """Active profiles of the membership that belong to its own organization.

    The organization filter is defense in depth: `assign_profiles` already rejects foreign
    profiles, but a row written around the service must never grant permissions.
    """
    return list(
        membership.profiles.filter(
            is_active=True, organization_id=membership.organization_id
        ).order_by("slug")
    )


def get_permission_codes(membership: Membership) -> frozenset[str]:
    """Union of the permission codes of the membership's active profiles."""
    codes: set[str] = set()
    for profile in list_active_profiles(membership):
        codes.update(profile.permission_codes)
    return frozenset(codes)


def get_scope(membership: Membership) -> dict[str, list[str]]:
    """The membership scope with its known keys always present, whatever the stored JSON is."""
    stored = membership.scope if isinstance(membership.scope, dict) else {}
    scope = default_scope()
    for key in scope:
        value = stored.get(key, [])
        scope[key] = [str(item) for item in value] if isinstance(value, list) else []
    return scope


def get_me_context(user: User, organization_slug: str | None) -> MeContext:
    organizations = list_active_organizations(user)
    try:
        membership = resolve_active_membership(user, organization_slug)
    except OrganizationHeaderRequiredError:
        return MeContext(
            user=user, organization=None, profiles=[], permissions=[], organizations=organizations
        )
    return MeContext(
        user=user,
        organization=membership.organization,
        profiles=list_active_profiles(membership),
        permissions=sorted(get_permission_codes(membership)),
        scope=get_scope(membership),
        organizations=organizations,
    )
