"""Defaults of a new organization: permission codes, catalogs and rule parameters.

Orchestration only (the data lives in `catalogs.seeds` and `rules.seeds`). It sits here, and not
in `organizations.services`, so the seeds never import the services that call them.
"""

from collections.abc import Mapping
from dataclasses import dataclass

from django.db import transaction

from accounts.permissions import ADMIN_AUTH_PERMISSION_CODES
from catalogs.permissions import (
    CATALOG_ITEM_ACTIVATE,
    CATALOG_ITEM_CREATE,
    CATALOG_ITEM_DEACTIVATE,
    CATALOG_ITEM_UPDATE,
    CATALOG_READ,
)
from catalogs.seeds import missing_catalog_slugs, seed_default_catalogs
from field_sync.permissions import FIELD_EVENT_SYNC
from organizations.models import Organization, Profile
from reviews.permissions import REVIEW_ITEM_READ
from rules.permissions import (
    RULE_PARAMETER_READ,
    RULE_PARAMETER_VERSION_CREATE,
    RULE_PARAMETER_VERSION_READ,
    RULE_PARAMETER_VERSION_VOID,
)
from rules.seeds import missing_parameter_keys, seed_default_rule_parameters

# Codes granted by default. Every internal profile reads the catalogs and the current rule values
# (the field snapshots need them); only admin edits them and reads the version history.
READ_ONLY_CODES = (CATALOG_READ, RULE_PARAMETER_READ)
ADMIN_CODES = (
    CATALOG_READ,
    CATALOG_ITEM_CREATE,
    CATALOG_ITEM_UPDATE,
    CATALOG_ITEM_DEACTIVATE,
    CATALOG_ITEM_ACTIVATE,
    RULE_PARAMETER_READ,
    RULE_PARAMETER_VERSION_READ,
    RULE_PARAMETER_VERSION_CREATE,
    RULE_PARAMETER_VERSION_VOID,
    *ADMIN_AUTH_PERMISSION_CODES,  # device and session administration (#4)
    REVIEW_ITEM_READ,
)
COURIER_CODES = (*READ_ONLY_CODES, FIELD_EVENT_SYNC)  # the phone syncs (#5)
SUPERVISOR_CODES = (*READ_ONLY_CODES, REVIEW_ITEM_READ)  # supervisors read the review items (#5)
# Keys are the slugs of `organizations.services.DEFAULT_PROFILE_SEEDS`.
DEFAULT_PROFILE_PERMISSIONS: Mapping[str, tuple[str, ...]] = {
    "courier": COURIER_CODES,
    "supervisor": SUPERVISOR_CODES,
    "entomologist": READ_ONLY_CODES,
    "community_promoter": READ_ONLY_CODES,
    "admin": ADMIN_CODES,
}


@dataclass(frozen=True)
class PermissionSeedPlan:
    """What the permission seed would do: codes to add per profile slug, and profiles it skips.

    A profile is skipped when it was not created by the seed (an admin made or renamed it): its
    codes are the admin's to set.
    """

    grants: Mapping[str, tuple[str, ...]]
    skipped: tuple[str, ...]


@dataclass(frozen=True)
class DefaultsPlan:
    permissions: PermissionSeedPlan
    missing_catalogs: tuple[str, ...]
    missing_parameters: tuple[str, ...]


def _seedable_profiles(organization: Organization) -> list[Profile]:
    return list(
        Profile.objects.filter(
            organization=organization, slug__in=DEFAULT_PROFILE_PERMISSIONS
        ).order_by("slug")
    )


def _new_codes(profile: Profile) -> tuple[str, ...]:
    """Default codes never seeded into this profile before."""
    seeded = set(profile.seeded_permission_codes)
    return tuple(code for code in DEFAULT_PROFILE_PERMISSIONS[profile.slug] if code not in seeded)


def plan_default_permission_codes(organization: Organization) -> PermissionSeedPlan:
    """Read-only: the codes `seed_default_permission_codes` would add."""
    grants: dict[str, tuple[str, ...]] = {}
    skipped = []
    for profile in _seedable_profiles(organization):
        if not profile.created_by_seed:
            skipped.append(profile.slug)
        elif codes := _new_codes(profile):
            grants[profile.slug] = codes
    return PermissionSeedPlan(grants=grants, skipped=tuple(skipped))


def seed_default_permission_codes(organization: Organization) -> PermissionSeedPlan:
    """Add default permission codes to the profiles the seed created (writes Profile).

    Each code is granted once and recorded in `seeded_permission_codes`, so running it again
    never re-grants a code an admin revoked, and it never removes a code. Returns what it did.

    Every profile is read with `select_for_update()` and the codes to add are computed from that
    locked row, never from an earlier read: a concurrent run or an admin edit that committed in
    between is seen, so a revoked code is not granted again.
    """
    grants: dict[str, tuple[str, ...]] = {}
    skipped = []
    with transaction.atomic():
        locked = (
            Profile.objects.select_for_update()
            .filter(organization=organization, slug__in=DEFAULT_PROFILE_PERMISSIONS)
            .order_by("slug")
        )
        for profile in locked:
            if not profile.created_by_seed:
                skipped.append(profile.slug)
            elif codes := _new_codes(profile):
                profile.permission_codes = sorted({*profile.permission_codes, *codes})
                profile.seeded_permission_codes = sorted({*profile.seeded_permission_codes, *codes})
                profile.save(update_fields=["permission_codes", "seeded_permission_codes"])
                grants[profile.slug] = codes
    return PermissionSeedPlan(grants=grants, skipped=tuple(skipped))


def plan_organization_defaults(organization: Organization) -> DefaultsPlan:
    """Read-only: what `seed_organization_defaults` would add."""
    return DefaultsPlan(
        permissions=plan_default_permission_codes(organization),
        missing_catalogs=tuple(missing_catalog_slugs(organization)),
        missing_parameters=tuple(missing_parameter_keys(organization)),
    )


def seed_organization_defaults(organization: Organization) -> DefaultsPlan:
    """Seed permission codes, catalogs and rule parameters (writes several tables). Safe to rerun.

    Returns the plan it applied. Also the way to bring an organization created before these
    defaults existed up to date (`manage.py seed_organization_defaults --apply`).
    """
    with transaction.atomic():
        missing_catalogs = tuple(missing_catalog_slugs(organization))
        missing_parameters = tuple(missing_parameter_keys(organization))
        permissions = seed_default_permission_codes(organization)
        seed_default_catalogs(organization)
        seed_default_rule_parameters(organization)
    return DefaultsPlan(permissions, missing_catalogs, missing_parameters)
