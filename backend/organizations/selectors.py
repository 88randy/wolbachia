from dataclasses import dataclass, field
from typing import Any, Literal

from django.db.models import QuerySet

from accounts.models import User
from core.void_reason import VOID_REASON_MAX_LENGTH, void_reason_min_length
from organizations.exceptions import NoActiveMembershipError, OrganizationHeaderRequiredError
from organizations.models import Membership, Organization, Profile, default_scope
from organizations.scope import EffectiveScope


def default_limits() -> dict[str, int]:
    """Server limits the web mirrors in its forms (it still shows the server's answer)."""
    return {
        "void_reason_min_length": void_reason_min_length(),
        "void_reason_max_length": VOID_REASON_MAX_LENGTH,
    }


@dataclass(frozen=True)
class MeContext:
    """What `GET /me/` returns. `organization` is None when the user must still choose one."""

    user: User
    organization: Organization | None
    profiles: list[Profile]
    permissions: list[str]
    scope: dict[str, dict[str, object]] = field(default_factory=default_scope)
    organizations: list[Organization] = field(default_factory=list)
    limits: dict[str, int] = field(default_factory=default_limits)


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
    from organizations.services import effective_scope

    return effective_scope(membership).permissions


def get_scope(membership: Membership) -> dict[str, dict[str, object]]:
    """Effective projection for display; action/object authorization keeps each grant paired."""
    from organizations.services import effective_scope

    effective = effective_scope(membership)
    scope = default_scope()
    names: tuple[Literal["centers", "quadrants"], ...] = ("centers", "quadrants")
    for name in names:
        dimensions = [grant[name] for _codes, grant in effective.grants]
        if any(dimension["mode"] == "all" for dimension in dimensions):
            scope[name] = {"mode": "all", "ids": []}
        else:
            ids = sorted(
                {
                    identifier
                    for dimension in dimensions
                    if dimension["mode"] == "selected"
                    for identifier in dimension["ids"]
                }
            )
            scope[name] = {
                "mode": "selected"
                if any(dimension["mode"] == "selected" for dimension in dimensions)
                else "none",
                "ids": ids,
            }
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


def filter_by_effective_scope(
    queryset: QuerySet[Any], membership: Membership, permission: str
) -> QuerySet[Any]:
    """Filter applicable dimensions with paired per-profile grants; foreign rows stay 404."""

    from organizations.services import effective_scope

    effective = effective_scope(membership)
    return filter_by_scope(queryset, effective, permission)


def filter_by_scope(
    queryset: QuerySet[Any], effective: EffectiveScope, permission: str
) -> QuerySet[Any]:
    """Use the same paired predicate with an explicit already-proved scope."""
    from django.db.models import Q

    fields = {field.name for field in queryset.model._meta.get_fields()}
    center_field = (
        "pk"
        if queryset.model._meta.label_lower == "organizations.center"
        else ("center_id" if "center" in fields else None)
    )
    center_field = getattr(queryset.model, "scope_center_lookup", center_field)
    quadrant_field = getattr(
        queryset.model, "scope_quadrant_lookup", "quadrant_id" if "quadrant" in fields else None
    )
    allowed = Q(pk__in=[])
    lookups: tuple[tuple[Literal["centers", "quadrants"], str | None], ...] = (
        ("centers", center_field),
        ("quadrants", quadrant_field),
    )
    for codes, scope in effective.grants:
        if permission not in codes:
            continue
        grant = Q(pk__isnull=False)
        for name, lookup in lookups:
            if lookup is None or scope[name]["mode"] == "all":
                continue
            grant &= Q(
                **{f"{lookup}__in": scope[name]["ids"] if scope[name]["mode"] == "selected" else []}
            )
        allowed |= grant
    return queryset.filter(allowed)
