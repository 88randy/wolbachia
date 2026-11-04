from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from django.db import transaction

from accounts.models import User
from accounts.services import create_user_without_password
from catalogs.seeds import seed_default_catalogs
from core.permission_codes import (
    CATALOG_ITEM_ACTIVATE,
    CATALOG_ITEM_CREATE,
    CATALOG_ITEM_DEACTIVATE,
    CATALOG_ITEM_UPDATE,
    CATALOG_READ,
    RULE_PARAMETER_READ,
    RULE_PARAMETER_VERSION_CREATE,
)
from organizations.exceptions import AdminUserConflictError, ProfileOrganizationMismatchError
from organizations.models import DEFAULT_LANGUAGE, Membership, Organization, Profile
from rules.seeds import seed_default_rule_parameters


@dataclass(frozen=True)
class OrganizationSpec:
    name: str
    slug: str
    country: str
    timezone: str
    languages: tuple[str, ...] = (DEFAULT_LANGUAGE,)


@dataclass(frozen=True)
class AdminSpec:
    username: str
    email: str
    reuse_existing_user: bool = False


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

# Codes granted by default (decision 5 of the plan of #3). Admins can change them per
# organization afterwards: the seed only adds, it never removes. Every internal profile reads
# the catalogs and rules (the field snapshots need them); only admin edits them.
READ_ONLY_CODES = (CATALOG_READ, RULE_PARAMETER_READ)
ADMIN_CODES = (
    CATALOG_READ,
    CATALOG_ITEM_CREATE,
    CATALOG_ITEM_UPDATE,
    CATALOG_ITEM_DEACTIVATE,
    CATALOG_ITEM_ACTIVATE,
    RULE_PARAMETER_READ,
    RULE_PARAMETER_VERSION_CREATE,
)
DEFAULT_PROFILE_PERMISSIONS: Mapping[str, tuple[str, ...]] = {
    "courier": READ_ONLY_CODES,
    "supervisor": READ_ONLY_CODES,
    "entomologist": READ_ONLY_CODES,
    "community_promoter": READ_ONLY_CODES,
    ADMIN_PROFILE_SLUG: ADMIN_CODES,
}


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


def seed_default_permission_codes(organization: Organization) -> None:
    """Add the default permission codes to the organization's profiles (writes Profile).

    Idempotent and additive: it never removes a code an admin granted. Profiles that do not
    exist (or were renamed) are skipped.
    """
    for profile in Profile.objects.filter(
        organization=organization, slug__in=DEFAULT_PROFILE_PERMISSIONS
    ):
        wanted = set(DEFAULT_PROFILE_PERMISSIONS[profile.slug])
        if not wanted <= set(profile.permission_codes):
            profile.permission_codes = sorted({*profile.permission_codes, *wanted})
            profile.save(update_fields=["permission_codes"])


def seed_organization_defaults(organization: Organization) -> None:
    """Seed permission codes, catalogs and rule parameters (writes several tables). Safe to rerun.

    Also the way to bring an organization created before these defaults existed up to date
    (`manage.py seed_organization_defaults`).
    """
    with transaction.atomic():
        seed_default_permission_codes(organization)
        seed_default_catalogs(organization)
        seed_default_rule_parameters(organization)


def create_organization(spec: OrganizationSpec) -> Organization:
    """Create an organization with its default profiles, catalogs and rule parameters."""
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
        seed_organization_defaults(organization)
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


def _get_or_create_admin(admin: AdminSpec) -> User:
    existing = User.objects.filter(username=admin.username).first()
    if existing is None:
        return create_user_without_password(admin.username, admin.email)
    if existing.email != admin.email and not admin.reuse_existing_user:
        raise AdminUserConflictError
    return existing


def bootstrap_organization(spec: OrganizationSpec, admin: AdminSpec) -> tuple[Organization, User]:
    """Create an organization, its default profiles and an admin membership (writes several tables).

    A new admin user has no password (set it with `manage.py changepassword`). An existing user
    with the same username is reused only when the email matches or `reuse_existing_user` is set;
    otherwise `AdminUserConflictError` stops the command from granting admin to the wrong person.
    """
    with transaction.atomic():
        user = _get_or_create_admin(admin)
        organization = create_organization(spec)
        admin_profile = Profile.objects.get(organization=organization, slug=ADMIN_PROFILE_SLUG)
        create_membership(user, organization, [admin_profile])
    return organization, user
