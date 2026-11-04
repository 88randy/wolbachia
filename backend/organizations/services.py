from collections.abc import Iterable
from dataclasses import dataclass

from django.db import transaction

from accounts.constants import ADMIN_AUTH_PERMISSION_CODES
from accounts.models import User
from accounts.services import create_user_without_password
from organizations.exceptions import AdminUserConflictError, ProfileOrganizationMismatchError
from organizations.models import DEFAULT_LANGUAGE, Membership, Organization, Profile


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


def add_permission_codes_to_admin_profiles(
    codes: Iterable[str] = ADMIN_AUTH_PERMISSION_CODES, organization: Organization | None = None
) -> int:
    """Add permission codes to the `admin` profile(s) (writes Profile); returns profiles changed.

    Idempotent: codes already present are left alone and nothing else changes, so running it
    again, or on organizations created before a code existed, is safe. `organization=None`
    covers every organization.
    """
    wanted = list(codes)
    admin_profiles = Profile.objects.select_for_update().filter(slug=ADMIN_PROFILE_SLUG)
    if organization is not None:
        admin_profiles = admin_profiles.filter(organization=organization)
    changed = 0
    with transaction.atomic():
        for profile in admin_profiles:
            missing = [code for code in wanted if code not in profile.permission_codes]
            if missing:
                profile.permission_codes = [*profile.permission_codes, *missing]
                profile.save(update_fields=["permission_codes"])
                changed += 1
    return changed


def seed_default_profiles(organization: Organization) -> list[Profile]:
    """Create the default profiles of an organization (writes Profile). Safe to run twice.

    The `admin` profile starts with the codes of the device and session administration (#4);
    other profiles start with no codes and are configured per organization.
    """
    profiles = []
    for seed in DEFAULT_PROFILE_SEEDS:
        profile, _ = Profile.objects.get_or_create(
            organization=organization,
            slug=seed.slug,
            defaults={"label_es": seed.label_es, "label_en": seed.label_en},
        )
        profiles.append(profile)
    add_permission_codes_to_admin_profiles(organization=organization)
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
