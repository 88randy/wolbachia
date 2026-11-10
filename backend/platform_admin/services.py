"""Platform use cases: provision, configure, suspend and reactivate organizations.

Every function here writes and says so. Each one appends an immutable `PlatformAuditEntry`
inside the same transaction as its change. None of them reads or writes organization business
data: they reuse the organization bootstrap and default seeds (the same services the
`bootstrap_organization` and `seed_organization_defaults` commands call).
"""

import secrets
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal
from uuid import UUID

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.views.decorators.debug import sensitive_variables

from accounts.models import User
from accounts.services import create_user_without_password
from core.exceptions import FieldValidationError
from core.time import server_now
from organizations.defaults import DefaultsPlan, seed_organization_defaults
from organizations.models import Center, Organization, Profile, all_scope
from organizations.services import (
    ADMIN_PROFILE_SLUG,
    AdminSpec,
    OrganizationSpec,
    _append_revision,
    _ensure_original_revision,
    _membership_snapshot,
    _organization_snapshot,
    bootstrap_organization,
    create_membership,
    lock_organization_configuration,
    seed_default_profiles,
)
from platform_admin.models import PlatformAdmin, PlatformAuditEntry

Delivery = Literal["password", "invite"]
Action = PlatformAuditEntry.Action

# Unambiguous characters only (no 0/O, 1/l/I), so the password can be read aloud or retyped.
PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"  # noqa: S105
PASSWORD_GROUPS = 4
PASSWORD_GROUP_LENGTH = 4


@dataclass(frozen=True)
class CenterSpec:
    code: str
    name: str


@dataclass(frozen=True)
class FirstAdminSpec:
    username: str
    email: str
    first_name: str
    last_name: str
    delivery: Delivery


@dataclass(frozen=True)
class ProvisionRequest:
    organization: OrganizationSpec
    centers: Sequence[CenterSpec]
    admin: FirstAdminSpec


@dataclass(frozen=True)
class AdminResult:
    user: User
    temporary_password: str | None


@dataclass(frozen=True)
class ProvisionResult:
    organization: Organization
    admin: AdminResult


def record(  # noqa: PLR0913 -- one audit receipt: action, actor, organization, target, details
    action: str,
    actor: User | None,
    organization: Organization | None = None,
    target_id: UUID | None = None,
    details: Mapping[str, object] | None = None,
) -> PlatformAuditEntry:
    """Append one immutable audit receipt (writes PlatformAuditEntry). Never pass secrets."""
    return PlatformAuditEntry.objects.create(
        action=action,
        actor=actor,
        organization=organization,
        target_id=target_id,
        details=dict(details or {}),
    )


def grant_platform_admin(user: User, actor: User | None = None) -> PlatformAdmin:
    """Give a user the platform role (writes PlatformAdmin and the audit). Safe to run twice."""
    with transaction.atomic():
        role, created = PlatformAdmin.objects.select_for_update().get_or_create(
            user=user, defaults={"created_by": actor}
        )
        if not created and not role.is_active:
            role.is_active = True
            role.save(update_fields=["is_active"])
            created = True
        if created:
            record(Action.PLATFORM_ADMIN_GRANT, actor, target_id=user.pk)
    return role


def revoke_platform_admin(user: User, actor: User | None = None) -> PlatformAdmin | None:
    """Remove the platform role (writes PlatformAdmin and the audit). Safe to run twice.

    The row is deactivated, never deleted. The user's organization memberships are untouched.
    """
    with transaction.atomic():
        role = PlatformAdmin.objects.select_for_update().filter(user=user).first()
        if role is None or not role.is_active:
            return role
        role.is_active = False
        role.save(update_fields=["is_active"])
        record(Action.PLATFORM_ADMIN_REVOKE, actor, target_id=user.pk)
    return role


def generate_temporary_password() -> str:
    """A random one-time password (about 95 bits), shown once and never stored in clear."""
    groups = [
        "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(PASSWORD_GROUP_LENGTH))
        for _ in range(PASSWORD_GROUPS)
    ]
    return "-".join(groups)


def _new_user(spec: FirstAdminSpec) -> User:
    """Create a brand-new account; an existing username is never reused or taken over."""
    if User.objects.filter(username__iexact=spec.username).exists():
        raise FieldValidationError("admin_username", "username_taken")
    try:
        with transaction.atomic():
            user = create_user_without_password(spec.username, spec.email)
    except IntegrityError as error:
        raise FieldValidationError("admin_username", "username_taken") from error
    except ValidationError as error:
        raise FieldValidationError("admin_username", "invalid") from error
    user.first_name = spec.first_name
    user.last_name = spec.last_name
    user.save(update_fields=["first_name", "last_name"])
    return user


@sensitive_variables("password")
def _deliver_credentials(user: User, delivery: Delivery) -> str | None:
    """Set a one-time password, or email the existing reset link as an invitation."""
    if delivery == "password":
        password = generate_temporary_password()
        user.set_password(password)
        user.must_change_password = True
        user.temporary_password_expires_at = server_now() + timedelta(
            hours=settings.PLATFORM_TEMPORARY_PASSWORD_HOURS
        )
        user.save(
            update_fields=["password", "must_change_password", "temporary_password_expires_at"]
        )
        return password
    from accounts.tasks import send_password_reset_email

    email = user.email
    transaction.on_commit(
        lambda: send_password_reset_email.apply_async(args=[email], argsrepr="('<redacted>',)")
    )
    return None


def _create_center(organization: Organization, spec: CenterSpec, actor: User) -> Center:
    if Center.objects.filter(organization=organization, code__iexact=spec.code).exists():
        raise FieldValidationError("code", "center_code_taken")
    try:
        with transaction.atomic():
            center = Center.objects.create(
                organization=organization, code=spec.code, name=spec.name, created_by=actor
            )
    except IntegrityError as error:
        raise FieldValidationError("code", "center_code_taken") from error
    record(
        Action.CENTER_CREATE,
        actor,
        organization,
        center.pk,
        {"code": center.code, "name": center.name},
    )
    return center


def provision_organization(actor: User, request: ProvisionRequest) -> ProvisionResult:
    """Create an organization with its defaults, first centers and first admin, atomically.

    Writes Organization, Profile, catalogs, rule parameters, Center, User, Membership,
    ConfigurationRevision and PlatformAuditEntry. The admin account must be new.
    """
    spec = request.organization
    if Organization.objects.filter(slug=spec.slug).exists():
        raise FieldValidationError("slug", "slug_taken")
    codes = [center.code.lower() for center in request.centers]
    if len(set(codes)) != len(codes):
        raise FieldValidationError("centers", "duplicate_center_code")
    try:
        with transaction.atomic():
            user = _new_user(request.admin)
            organization, _ = bootstrap_organization(
                spec, AdminSpec(username=user.username, email=user.email)
            )
            record(
                Action.ORGANIZATION_CREATE,
                actor,
                organization,
                organization.pk,
                {"slug": organization.slug, "name": organization.name},
            )
            for center in request.centers:
                _create_center(organization, center, actor)
            password = _deliver_credentials(user, request.admin.delivery)
            record(
                Action.ADMIN_CREATE,
                actor,
                organization,
                user.pk,
                {"username": user.username, "delivery": request.admin.delivery},
            )
    except IntegrityError as error:
        # A concurrent request took the slug between the check and the insert.
        raise FieldValidationError("slug", "slug_taken") from error
    except ValidationError as error:
        raise FieldValidationError("slug", "invalid") from error
    return ProvisionResult(organization, AdminResult(user, password))


def add_center(actor: User, organization: Organization, spec: CenterSpec) -> Center:
    """Add one center (writes Center and the audit)."""
    with transaction.atomic():
        return _create_center(organization, spec, actor)


def add_admin(actor: User, organization: Organization, spec: FirstAdminSpec) -> AdminResult:
    """Add a NEW admin account to an organization (writes User, Membership, revisions, audit)."""
    with transaction.atomic():
        user = _new_user(spec)
        admin_profile = Profile.objects.get(organization=organization, slug=ADMIN_PROFILE_SLUG)
        membership = create_membership(user, organization, [admin_profile])
        membership.scope = all_scope()
        membership.revision += 1
        membership.save(update_fields=["scope", "revision"])
        _append_revision(membership, "membership", _membership_snapshot(membership), actor)
        password = _deliver_credentials(user, spec.delivery)
        record(
            Action.ADMIN_CREATE,
            actor,
            organization,
            user.pk,
            {"username": user.username, "delivery": spec.delivery},
        )
    return AdminResult(user, password)


def apply_defaults(actor: User, organization: Organization) -> DefaultsPlan:
    """Create missing default profiles, then seed missing permissions, catalogs and rules.

    Same idempotent seeds as the commands: revoked codes are never granted again and existing
    labels and versions are kept.
    """
    with transaction.atomic():
        seed_default_profiles(organization)
        plan = seed_organization_defaults(organization)
        record(
            Action.ORGANIZATION_DEFAULTS_APPLY,
            actor,
            organization,
            organization.pk,
            {
                "profiles": len(plan.missing_profiles),
                "catalogs": len(plan.missing_catalogs),
                "parameters": len(plan.missing_parameters),
            },
        )
    return plan


def upload_logo(actor: User, organization: Organization, content: bytes) -> Organization:
    """Replace the logo with already validated PNG bytes (writes Organization, revision, audit)."""
    import hashlib

    with lock_organization_configuration(organization.pk) as locked:
        _ensure_original_revision(locked, "organization", _organization_snapshot(locked))
        locked.logo_content = content
        locked.revision += 1
        locked.save(update_fields=["logo_content", "revision"])
        _append_revision(locked, "organization", _organization_snapshot(locked), actor)
        record(
            Action.ORGANIZATION_LOGO_UPLOAD,
            actor,
            locked,
            locked.pk,
            {"sha256": hashlib.sha256(content).hexdigest()},
        )
    return locked


def set_organization_active(  # noqa: PLR0913 -- actor, target, keyword state and reason
    actor: User, organization: Organization, *, active: bool, reason: str
) -> Organization:
    """Suspend or reactivate (writes Organization and the audit). Repeating it is a no-op.

    A suspended organization keeps every record. Its members cannot sign in and every scoped
    request answers `no_active_membership`, because membership resolution requires an active
    organization. As defense in depth, suspending also revokes the organization's device
    sessions and ends its members' web sessions right away (after the commit; the actor's own
    session is kept).
    """
    with lock_organization_configuration(organization.pk) as locked:
        if locked.is_active == active:
            return locked
        locked.is_active = active
        locked.save(update_fields=["is_active"])
        record(
            Action.ORGANIZATION_REACTIVATE if active else Action.ORGANIZATION_SUSPEND,
            actor,
            locked,
            locked.pk,
            {"reason": reason},
        )
    if not active:
        _lock_out_members(actor, locked)
    return locked


def _lock_out_members(actor: User, organization: Organization) -> None:
    """Revoke device sessions and end web sessions (outside any transaction, see revocation)."""
    from accounts.models import DeviceSession, RevokeReason
    from accounts.revocation import Revocation, revoke_active
    from accounts.web_sessions import end_web_sessions
    from organizations.models import Membership

    revoke_active(
        DeviceSession.objects.filter(organization=organization),
        Revocation(RevokeReason.MEMBERSHIP_INACTIVE, revoked_by=actor),
    )
    members = (
        Membership.objects.filter(organization=organization)
        .exclude(user_id=actor.pk)
        .values_list("user_id", flat=True)
    )
    end_web_sessions(members)
