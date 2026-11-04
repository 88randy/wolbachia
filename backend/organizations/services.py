from collections.abc import Iterable
from dataclasses import dataclass

from django.db import transaction

from accounts.models import User
from organizations.exceptions import (
    NoActiveMembershipError,
    OrganizationHeaderRequiredError,
    ProfileOrganizationMismatchError,
)
from organizations.models import DEFAULT_LANGUAGE, Membership, Organization, Profile


@dataclass(frozen=True)
class OrganizationSpec:
    name: str
    slug: str
    country: str
    timezone: str
    languages: tuple[str, ...] = (DEFAULT_LANGUAGE,)


@dataclass(frozen=True)
class ProfileSeed:
    slug: str
    label_es: str
    label_en: str


# Profiles are data (decision 13): permission codes start empty and are configured per
# organization. Coordinator, warehouse, regulatory and government are added as data if confirmed.
DEFAULT_PROFILE_SEEDS = (
    ProfileSeed("courier", "Repartidor", "Courier"),
    ProfileSeed("supervisor", "Supervisor", "Supervisor"),
    ProfileSeed("entomologist", "Entomólogo", "Entomologist"),
    ProfileSeed("community_promoter", "Promotor", "Community promoter"),
    ProfileSeed("admin", "Administrador", "Administrator"),
)
ADMIN_PROFILE_SLUG = "admin"


def seed_default_profiles(organization: Organization) -> list[Profile]:
    """Create the default profiles of an organization (writes Profile). Safe to run twice."""
    profiles = []
    for seed in DEFAULT_PROFILE_SEEDS:
        profile, _ = Profile.objects.get_or_create(
            organization=organization,
            slug=seed.slug,
            defaults={"label_es": seed.label_es, "label_en": seed.label_en},
        )
        profiles.append(profile)
    return profiles


def create_organization(spec: OrganizationSpec) -> Organization:
    """Create an organization and its default profiles (writes Organization and Profile)."""
    organization = Organization(
        name=spec.name,
        slug=spec.slug,
        country=spec.country,
        timezone=spec.timezone,
        languages=list(spec.languages),
    )
    organization.full_clean()
    with transaction.atomic():
        organization.save()
        seed_default_profiles(organization)
    return organization


def assign_profiles(membership: Membership, profiles: Iterable[Profile]) -> None:
    """Replace the profiles of a membership; every profile must belong to its organization."""
    profile_list = list(profiles)
    if any(profile.organization_id != membership.organization_id for profile in profile_list):
        raise ProfileOrganizationMismatchError
    membership.profiles.set(profile_list)


def create_membership(
    user: User, organization: Organization, profiles: Iterable[Profile]
) -> Membership:
    """Add a user to an organization with the given profiles (writes Membership)."""
    with transaction.atomic():
        membership = Membership.objects.create(user=user, organization=organization)
        assign_profiles(membership, profiles)
    return membership


def resolve_active_membership(user: User, organization_slug: str | None) -> Membership:
    """Pick the membership that defines the active organization of a request.

    Active means the membership and its organization are both active. A given slug is always
    validated, even for users with one membership. Raises `NoActiveMembershipError` (403) or,
    for several memberships and no slug, `OrganizationHeaderRequiredError` (400).
    """
    memberships = Membership.objects.filter(
        user=user, is_active=True, organization__is_active=True
    ).select_related("organization")
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
