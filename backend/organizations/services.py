from collections.abc import Iterable, Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Literal, cast
from uuid import UUID

from django.db import DatabaseError, transaction
from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.models import User
from accounts.services import create_user_without_password
from core.exceptions import FieldValidationError
from organizations.defaults import seed_organization_defaults
from organizations.exceptions import (
    AdministrationBusyError,
    AdminUserConflictError,
    GovernmentPermissionError,
    LastAdministratorError,
    ProfileOrganizationMismatchError,
    StaleRevisionError,
)
from organizations.models import (
    DEFAULT_LANGUAGE,
    Center,
    ConfigurationRevision,
    Membership,
    Organization,
    Profile,
    all_scope,
)
from organizations.scope import (
    EffectiveScope,
    WorkScope,
    intersect,
    normalize_scope,
    safe_scope,
)


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


# The nine client-confirmed permission bundles are data, never authorization by profile name.
DEFAULT_PROFILE_SEEDS = (
    ProfileSeed("courier", "Repartidor", "Courier"),
    ProfileSeed("supervisor", "Supervisor", "Supervisor"),
    ProfileSeed("entomologist", "Entomólogo", "Entomologist"),
    ProfileSeed("community_promoter", "Promotor", "Community promoter"),
    ProfileSeed("admin", "Administrador", "Administrator"),
    ProfileSeed("coordinator", "Coordinador", "Coordinator"),
    ProfileSeed("warehouse", "Almacén", "Warehouse"),
    ProfileSeed("regulatory", "Regulatorio", "Regulatory"),
    ProfileSeed("government", "Gobierno", "Government"),
)
ADMIN_PROFILE_SLUG = "admin"


def seed_default_profiles(organization: Organization) -> list[Profile]:
    """Create the default profiles of an organization (writes Profile). Safe to run twice.

    Profiles it creates carry `created_by_seed`, which is what lets the permission seed grant
    them default codes later.
    """
    profiles = []
    for seed in DEFAULT_PROFILE_SEEDS:
        profile, _ = Profile.objects.get_or_create(
            organization=organization,
            slug=seed.slug,
            defaults={
                "label_es": seed.label_es,
                "label_en": seed.label_en,
                "created_by_seed": True,
                "scope": all_scope(),
            },
        )
        profiles.append(profile)
    return profiles


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
        _append_revision(organization, "organization", _organization_snapshot(organization), None)
    return organization


def assign_profiles(membership: Membership, profiles: Iterable[Profile]) -> None:
    """Replace the profiles of a membership; every profile must belong to its organization."""
    profile_list = list(profiles)
    if any(profile.organization_id != membership.organization_id for profile in profile_list):
        raise ProfileOrganizationMismatchError
    with lock_organization_configuration(membership.organization_id) as organization:
        locked = cast(Membership, Membership.objects.select_for_update().get(pk=membership.pk))
        had_admin = _has_administrator(organization)
        _ensure_original_revision(locked, "membership", _membership_snapshot(locked))
        locked.profiles.set(profile_list)
        locked.revision += 1
        locked.save(update_fields=["revision"])
        _preserve_administrator(organization, had_admin)
        _append_revision(locked, "membership", _membership_snapshot(locked), None)
    membership.revision = locked.revision


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
        membership = create_membership(user, organization, [admin_profile])
        membership.scope = all_scope()
        membership.revision += 1
        membership.save(update_fields=["scope", "revision"])
        _append_revision(membership, "membership", _membership_snapshot(membership), None)
    return organization, user


# Administration uses the organization as its serialization point. No User/Device/Session/
# TokenPair locks are acquired below it, and no network or storage operation runs under it.

ADMINISTRATION_PERMISSIONS = frozenset({"organization.update", "role.update"})
ORGANIZATION_FIELDS = (
    "name",
    "timezone",
    "languages",
    "epi_week",
    "label_phone",
    "support_contact",
)


def effective_scope(
    membership: Membership, *, profiles: list[Profile] | None = None
) -> EffectiveScope:
    """Single authority for paired action/scope checks, including /me/.

    Supply profiles only when captured with the membership in one SQL statement
    (field bootstrap/sync). That path performs no further configuration reads.
    """
    from organizations.selectors import list_active_profiles

    if (
        not membership.is_active
        or not membership.organization.is_active
        or not membership.user.is_active
    ):
        return EffectiveScope(())
    member_scope = safe_scope(membership.scope)
    if profiles is None:
        profiles = list_active_profiles(membership)
    else:
        profiles = [
            profile
            for profile in profiles
            if profile.is_active and profile.organization_id == membership.organization_id
        ]
    return fold_profile_scope(member_scope, profiles)


def fold_profile_scope(member_scope: WorkScope, profiles: list[Profile]) -> EffectiveScope:
    """Fold caller-validated active profiles, from current or complete historical facts."""
    grants = []
    if any(getattr(profile, "slug", "") == "government" for profile in profiles):
        profiles = [profile for profile in profiles if profile.slug == "government"]
    for profile in profiles:
        profile_scope = safe_scope(profile.scope)
        codes = frozenset(profile.permission_codes)
        if getattr(profile, "slug", "") == "government":
            codes = codes & {"portal.read"}
        scope = WorkScope(
            centers=intersect(member_scope["centers"], profile_scope["centers"]),
            quadrants=intersect(member_scope["quadrants"], profile_scope["quadrants"]),
        )
        grants.append((codes, scope))
    return EffectiveScope(tuple(grants))


@contextmanager
def lock_organization_configuration(organization_id: UUID) -> Iterator[Organization]:
    """Serialize without blocking FK KEY SHARE; try-lock contention is retryable 429."""
    try:
        with transaction.atomic():
            organization = Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=organization_id
            )
            yield organization
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in {"55P03", "40P01"}:
            raise AdministrationBusyError from error
        raise


def _check_revision(current: int, expected: int) -> None:
    if current != expected:
        raise StaleRevisionError


def _actor_scope(actor: User, organization: Organization, permission: str) -> EffectiveScope:
    membership = (
        Membership.objects.filter(user=actor, organization=organization, is_active=True)
        .select_related("user", "organization")
        .first()
    )
    if membership is None:
        raise PermissionDenied
    effective = effective_scope(membership)
    if not effective.allows(permission):
        raise PermissionDenied
    return effective


def validate_scope_references(organization: Organization, scope: WorkScope) -> None:
    """Selected centers and real quadrants must belong to the active organization."""
    from geography.models import Quadrant

    ids = scope["centers"]["ids"]
    if Center.objects.filter(organization=organization, pk__in=ids).count() != len(ids):
        raise NotFound
    quadrant_ids = scope["quadrants"]["ids"]
    quadrants = Quadrant.objects.filter(organization=organization, pk__in=quadrant_ids)
    if scope["centers"]["mode"] != "all":
        quadrants = quadrants.filter(center_id__in=ids)
    if quadrants.count() != len(quadrant_ids):
        raise NotFound


def _covers_scope(available: WorkScope, requested: WorkScope) -> bool:
    names: tuple[Literal["centers", "quadrants"], ...] = ("centers", "quadrants")
    for name in names:
        grant, proposed = available[name], requested[name]
        if proposed["mode"] == "none" or grant["mode"] == "all":
            continue
        if proposed["mode"] == "all" or not set(proposed["ids"]) <= set(grant["ids"]):
            return False
    return True


def _validate_delegation(effective: EffectiveScope, scope: WorkScope, codes: Iterable[str]) -> None:
    for code in codes:
        if code not in effective.permissions:
            raise PermissionDenied
        if not any(
            code in permissions and _covers_scope(grant, scope)
            for permissions, grant in effective.grants
        ):
            raise NotFound


def _has_administrator(organization: Organization) -> bool:
    members = (
        Membership.objects.filter(organization=organization, is_active=True, user__is_active=True)
        .select_related("user", "organization")
        .prefetch_related("profiles")
    )
    return any(
        effective_scope(member).permissions >= ADMINISTRATION_PERMISSIONS for member in members
    )


def _preserve_administrator(organization: Organization, had_administrator: bool) -> None:
    if had_administrator and not _has_administrator(organization):
        raise LastAdministratorError
    from incidents.configuration import preserve_terminal_owners

    preserve_terminal_owners(organization)


def _append_revision(  # noqa: PLR0913 -- audited target, kind, snapshot and actor
    target: Organization | Profile | Membership,
    kind: str,
    snapshot: dict[str, Any],
    actor: User | None,
) -> None:
    organization_id = target.pk if isinstance(target, Organization) else target.organization_id
    ConfigurationRevision.objects.create(
        organization_id=organization_id,
        target_id=target.pk,
        kind=kind,
        revision=target.revision,
        snapshot=snapshot,
        created_by=actor,
    )


def _profile_snapshot(profile: Profile) -> dict[str, Any]:
    return {
        "slug": profile.slug,
        "permissions": sorted(profile.permission_codes),
        "scope": profile.scope,
        "is_active": profile.is_active,
    }


def _membership_snapshot(membership: Membership) -> dict[str, Any]:
    return {
        "user": str(membership.user_id),
        "profiles": sorted(
            str(identifier) for identifier in membership.profiles.values_list("id", flat=True)
        ),
        "scope": membership.scope,
        "is_active": membership.is_active,
    }


def _organization_snapshot(organization: Organization) -> dict[str, Any]:
    import hashlib

    return {
        **{name: getattr(organization, name) for name in ORGANIZATION_FIELDS},
        "logo_sha256": hashlib.sha256(bytes(organization.logo_content)).hexdigest()
        if organization.logo_content
        else None,
    }


def _ensure_original_revision(
    target: Organization | Profile | Membership, kind: str, snapshot: dict[str, Any]
) -> None:
    if not ConfigurationRevision.objects.filter(
        organization_id=target.pk if isinstance(target, Organization) else target.organization_id,
        kind=kind,
        target_id=target.pk,
        revision=target.revision,
    ).exists():
        _append_revision(target, kind, snapshot, None)


@dataclass(frozen=True)
class ProfileChange:
    actor: User
    expected_revision: int
    permissions: list[str]
    scope: WorkScope


def update_profile_permissions(profile: Profile, change: ProfileChange) -> Profile:
    """Serialize privilege removal; compare revision and append an immutable audit snapshot."""
    with lock_organization_configuration(profile.organization_id) as organization:
        effective = _actor_scope(change.actor, organization, "role.update")
        locked = cast(
            Profile,
            Profile.objects.select_for_update().get(pk=profile.pk, organization=organization),
        )
        _check_revision(locked.revision, change.expected_revision)
        scope = normalize_scope(change.scope)
        validate_scope_references(organization, scope)
        if locked.slug == "government" and not set(change.permissions) <= {"portal.read"}:
            raise GovernmentPermissionError
        _validate_delegation(effective, scope, change.permissions)
        had_admin = _has_administrator(organization)
        _ensure_original_revision(locked, "role", _profile_snapshot(locked))
        locked.permission_codes = sorted(set(change.permissions))
        locked.scope = scope
        locked.revision += 1
        locked.save(update_fields=["permission_codes", "scope", "revision"])
        _preserve_administrator(organization, had_admin)
        _append_revision(locked, "role", _profile_snapshot(locked), change.actor)
    return locked


@dataclass(frozen=True)
class MembershipChange:
    actor: User
    expected_revision: int
    profiles: list[Profile]
    scope: WorkScope
    is_active: bool = True


def _apply_membership_change(member: Membership, change: MembershipChange) -> None:
    member.scope = normalize_scope(change.scope)
    member.is_active = change.is_active
    member.revision += 1
    member.save(update_fields=["scope", "is_active", "revision"])
    member.profiles.set(change.profiles)


def _validate_membership_change(organization: Organization, change: MembershipChange) -> None:
    effective = _actor_scope(change.actor, organization, "role.update")
    scope = normalize_scope(change.scope)
    validate_scope_references(organization, scope)
    if any(profile.organization_id != organization.pk for profile in change.profiles):
        raise NotFound
    profiles = Profile.objects.filter(
        organization=organization,
        pk__in=[profile.pk for profile in change.profiles],
        is_active=True,
    )
    if profiles.count() != len(change.profiles):
        raise NotFound
    if any(profile.slug == "government" for profile in profiles) and len(change.profiles) != 1:
        raise GovernmentPermissionError
    if not profiles:
        _validate_delegation(effective, scope, {"role.update"})
    for profile in profiles:
        profile_scope = safe_scope(profile.scope)
        delegated_scope = WorkScope(
            centers=intersect(scope["centers"], profile_scope["centers"]),
            quadrants=intersect(scope["quadrants"], profile_scope["quadrants"]),
        )
        _validate_delegation(effective, delegated_scope, profile.permission_codes)


def update_membership(membership: Membership, change: MembershipChange) -> Membership:
    """Update assignments/scope/active state atomically, retaining the last administrator."""
    with lock_organization_configuration(membership.organization_id) as organization:
        _validate_membership_change(organization, change)
        locked = cast(
            Membership,
            Membership.objects.select_for_update().get(pk=membership.pk, organization=organization),
        )
        _check_revision(locked.revision, change.expected_revision)
        had_admin = _has_administrator(organization)
        _ensure_original_revision(locked, "membership", _membership_snapshot(locked))
        _apply_membership_change(locked, change)
        _preserve_administrator(organization, had_admin)
        _append_revision(locked, "membership", _membership_snapshot(locked), change.actor)
    return locked


def deactivate_personnel_membership(
    membership: Membership, actor: User, expected_revision: int
) -> Membership:
    """Deactivate and audit one membership without changing shared identity or assignments.

    The personnel caller locks the authentic account/session closure and authorizes its
    actual personnel context first. This helper takes no account locks after Organization.
    The same arbiter and guard also serialize role/scope removals from other entry points.
    """
    with lock_organization_configuration(membership.organization_id) as organization:
        _actor_scope(actor, organization, "user.deactivate")
        locked = (
            Membership.objects.select_for_update()
            .filter(pk=membership.pk, organization=organization, user_id=membership.user_id)
            .first()
        )
        if locked is None:
            raise NotFound
        _check_revision(locked.revision, expected_revision)
        if not locked.is_active:
            return locked
        had_admin = _has_administrator(organization)
        _ensure_original_revision(locked, "membership", _membership_snapshot(locked))
        locked.is_active = False
        locked.revision += 1
        locked.save(update_fields=["is_active", "revision"])
        _preserve_administrator(organization, had_admin)
        _append_revision(locked, "membership", _membership_snapshot(locked), actor)
    return locked


def create_managed_membership(
    user: User, organization: Organization, change: MembershipChange
) -> Membership:
    """Assign an existing shared identity; never creates users or another organization."""
    with lock_organization_configuration(organization.pk) as locked:
        _validate_membership_change(locked, change)
        if Membership.objects.filter(user=user, organization=locked).exists():
            raise FieldValidationError("user", "duplicate_membership")
        member = Membership.objects.create(
            user=user,
            organization=locked,
            scope=normalize_scope(change.scope),
            is_active=change.is_active,
            created_by=change.actor,
        )
        member.profiles.set(change.profiles)
        _append_revision(member, "membership", _membership_snapshot(member), change.actor)
    return member


@dataclass(frozen=True)
class OrganizationChange:
    actor: User
    expected_revision: int
    fields: Mapping[str, object]
    logo_content: bytes | None = None


def update_organization(organization: Organization, change: OrganizationChange) -> Organization:
    """Version current settings; the caller validates raster bytes before taking locks."""
    with lock_organization_configuration(organization.pk) as locked:
        _actor_scope(change.actor, locked, "organization.update")
        _check_revision(locked.revision, change.expected_revision)
        _ensure_original_revision(locked, "organization", _organization_snapshot(locked))
        for name in ORGANIZATION_FIELDS:
            if name in change.fields:
                setattr(locked, name, change.fields[name])
        if change.logo_content is not None:
            locked.logo_content = change.logo_content
        locked.revision += 1
        locked.save(update_fields=[*ORGANIZATION_FIELDS, "logo_content", "revision"])
        _append_revision(locked, "organization", _organization_snapshot(locked), change.actor)
    return locked
