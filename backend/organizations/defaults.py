"""Defaults of a new organization: permission codes, catalogs and rule parameters.

Catalog and rule definitions live in their seed modules. Runtime profile orchestration
uses local audit-service imports to avoid a module-initialization cycle.
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
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC
from fleet.permissions import MOTORCYCLE_SERVICE_CLEAR
from geography.permissions import GEOGRAPHY_WRITE_CODES, QUADRANT_READ
from incidents.permissions import (
    INCIDENT_CLOSE,
    INCIDENT_CREATE,
    INCIDENT_READ,
    INCIDENT_REASSIGN,
    MANAGEMENT_CODES,
)
from organizations.models import Organization, Profile
from ovitraps.permissions import OVITRAP_REMOVAL_RESOLVE, READ_CODES, READING_READ
from reviews.permissions import REVIEW_ITEM_READ
from rules.permissions import (
    RULE_PARAMETER_READ,
    RULE_PARAMETER_VERSION_CREATE,
    RULE_PARAMETER_VERSION_READ,
    RULE_PARAMETER_VERSION_VOID,
)
from rules.seeds import missing_parameter_keys, seed_default_rule_parameters
from scheduling.permissions import RISK_IMPORT_APPLY, SCHEDULE_MANAGE, SCHEDULE_READ
from shifts.permissions import MOTORCYCLE_MANAGE, MOTORCYCLE_READ, MOTORCYCLE_UNBLOCK, SHIFT_READ
from uploads.limits import FIELD_UPLOAD

# Codes granted by default. Every internal profile reads the catalogs and the current rule values
# (the field snapshots need them); only admin edits them and reads the version history.
READ_ONLY_CODES = (CATALOG_READ, RULE_PARAMETER_READ, "organization.read", "center.read")
ADMIN_CODES = (
    *MANAGEMENT_CODES,
    OVITRAP_REMOVAL_RESOLVE,
    FIELD_UPLOAD,
    SCHEDULE_READ,
    SCHEDULE_MANAGE,
    RISK_IMPORT_APPLY,
    *READ_CODES,
    *GEOGRAPHY_WRITE_CODES,
    FIELD_EVENT_SYNC,
    FIELD_BOOTSTRAP,
    "portal.read",
    "organization.read",
    "organization.update",
    "role.read",
    "role.update",
    "center.read",
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
    SHIFT_READ,
    MOTORCYCLE_READ,
    MOTORCYCLE_MANAGE,
    MOTORCYCLE_UNBLOCK,
    MOTORCYCLE_SERVICE_CLEAR,
)
COURIER_CODES = (
    INCIDENT_READ,
    INCIDENT_CREATE,
    FIELD_UPLOAD,
    *READ_ONLY_CODES,
    FIELD_EVENT_SYNC,
    FIELD_BOOTSTRAP,
    MOTORCYCLE_READ,
)  # the phone syncs (#5)
# Supervisors read the review items (#5) and the shifts (#68).
SUPERVISOR_CODES = (
    INCIDENT_READ,
    INCIDENT_CREATE,
    INCIDENT_CLOSE,
    INCIDENT_REASSIGN,
    OVITRAP_REMOVAL_RESOLVE,
    FIELD_UPLOAD,
    SCHEDULE_READ,
    SCHEDULE_MANAGE,
    *READ_CODES,
    QUADRANT_READ,
    *READ_ONLY_CODES,
    REVIEW_ITEM_READ,
    SHIFT_READ,
    MOTORCYCLE_READ,
    MOTORCYCLE_UNBLOCK,
    MOTORCYCLE_SERVICE_CLEAR,
)
# Keys are the slugs of `organizations.services.DEFAULT_PROFILE_SEEDS`.
DEFAULT_PROFILE_PERMISSIONS: Mapping[str, tuple[str, ...]] = {
    "courier": COURIER_CODES,
    "supervisor": SUPERVISOR_CODES,
    "entomologist": (*READ_ONLY_CODES, READING_READ, SCHEDULE_READ, RISK_IMPORT_APPLY),
    "community_promoter": READ_ONLY_CODES,
    "admin": ADMIN_CODES,
    "coordinator": (
        *READ_ONLY_CODES,
        *GEOGRAPHY_WRITE_CODES,
        *READ_CODES,
        FIELD_UPLOAD,
        INCIDENT_READ,
        INCIDENT_CREATE,
        INCIDENT_CLOSE,
        INCIDENT_REASSIGN,
    ),
    "warehouse": READ_ONLY_CODES,
    "regulatory": READ_ONLY_CODES,
    "government": ("portal.read",),
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
    missing_profiles: tuple[str, ...] = ()


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
        Organization.objects.select_for_update(no_key=True).get(pk=organization.pk)
        locked = (
            Profile.objects.select_for_update()
            .filter(organization=organization, slug__in=DEFAULT_PROFILE_PERMISSIONS)
            .order_by("slug")
        )
        for profile in locked:
            if not profile.created_by_seed:
                skipped.append(profile.slug)
            elif codes := _new_codes(profile):
                from organizations.services import (
                    _append_revision,
                    _ensure_original_revision,
                    _profile_snapshot,
                )

                _ensure_original_revision(profile, "role", _profile_snapshot(profile))
                profile.permission_codes = sorted({*profile.permission_codes, *codes})
                profile.seeded_permission_codes = sorted({*profile.seeded_permission_codes, *codes})
                profile.revision += 1
                profile.save(
                    update_fields=["permission_codes", "seeded_permission_codes", "revision"]
                )
                _append_revision(profile, "role", _profile_snapshot(profile), None)
                grants[profile.slug] = codes
    return PermissionSeedPlan(grants=grants, skipped=tuple(skipped))


def plan_organization_defaults(organization: Organization) -> DefaultsPlan:
    """Read-only: what `seed_organization_defaults` would add."""
    return DefaultsPlan(
        permissions=plan_default_permission_codes(organization),
        missing_catalogs=tuple(missing_catalog_slugs(organization)),
        missing_parameters=tuple(missing_parameter_keys(organization)),
        missing_profiles=_missing_profile_slugs(organization),
    )


def _missing_profile_slugs(organization: Organization) -> tuple[str, ...]:
    existing = set(Profile.objects.filter(organization=organization).values_list("slug", flat=True))
    return tuple(slug for slug in DEFAULT_PROFILE_PERMISSIONS if slug not in existing)


def seed_organization_defaults(organization: Organization) -> DefaultsPlan:
    """Seed permission codes, catalogs and rule parameters (writes several tables). Safe to rerun.

    Returns the plan it applied. Also the way to bring an organization created before these
    defaults existed up to date (`manage.py seed_organization_defaults --apply`).
    """
    from organizations.services import seed_default_profiles

    with transaction.atomic():
        Organization.objects.select_for_update(no_key=True).get(pk=organization.pk)
        missing_profiles = _missing_profile_slugs(organization)
        seed_default_profiles(organization)
        missing_catalogs = tuple(missing_catalog_slugs(organization))
        missing_parameters = tuple(missing_parameter_keys(organization))
        permissions = seed_default_permission_codes(organization)
        seed_default_catalogs(organization)
        seed_default_rule_parameters(organization)
    return DefaultsPlan(permissions, missing_catalogs, missing_parameters, missing_profiles)
