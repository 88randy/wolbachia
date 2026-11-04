from dataclasses import dataclass, field
from typing import Any

from accounts.models import User
from organizations.exceptions import OrganizationHeaderRequiredError
from organizations.models import Membership, Organization, Profile, default_scope
from organizations.services import resolve_active_membership


@dataclass(frozen=True)
class MeContext:
    """What `GET /me/` returns. `organization` is None when the user must still choose one."""

    user: User
    organization: Organization | None
    profiles: list[Profile]
    permissions: list[str]
    scope: dict[str, Any] = field(default_factory=default_scope)
    organizations: list[Organization] = field(default_factory=list)


def list_active_organizations(user: User) -> list[Organization]:
    memberships = Membership.objects.filter(
        user=user, is_active=True, organization__is_active=True
    ).select_related("organization")
    return [membership.organization for membership in memberships.order_by("organization__name")]


def list_active_profiles(membership: Membership) -> list[Profile]:
    return list(membership.profiles.filter(is_active=True).order_by("slug"))


def get_permission_codes(membership: Membership) -> frozenset[str]:
    """Union of the permission codes of the membership's active profiles."""
    codes: set[str] = set()
    for profile in list_active_profiles(membership):
        codes.update(profile.permission_codes)
    return frozenset(codes)


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
        scope=membership.scope,
        organizations=organizations,
    )
