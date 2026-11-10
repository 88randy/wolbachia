"""Authentication use cases: login, device sessions, password reset.

Everything that writes says so in its docstring. Rows are locked with `select_for_update` wherever
two requests could race. Lock order is always User, then Device, then DeviceSession, then
TokenPair (accounts/README.md). Revocation and rotation must not run inside an outer `atomic()`
(accounts.revocation).
"""

import hmac
import uuid
from dataclasses import dataclass

from django.contrib.auth.hashers import check_password
from django.contrib.auth.tokens import default_token_generator
from django.db import IntegrityError, transaction
from django.views.decorators.debug import sensitive_variables
from rest_framework.exceptions import Throttled

from accounts.audit import AuditContext, AuthEvent, fingerprint, log_auth_event
from accounts.constants import LAST_USED_UPDATE_INTERVAL_SECONDS
from accounts.exceptions import (
    DeviceOrganizationMismatchError,
    DeviceRevokedError,
    InvalidCredentialsError,
    InvalidResetTokenError,
)
from accounts.login_attempts import clear_failures, ensure_not_locked_out, register_failure
from accounts.models import Device, DeviceSession, RevokeReason, User
from accounts.revocation import (
    Revocation,
    cancel_final_uploads,
    revoke_active,
    revoke_user_sessions,
)
from accounts.token_pairs import IssuedTokens, issue_pair
from core.time import server_now
from organizations.exceptions import NoActiveMembershipError
from organizations.models import Membership, Organization


def create_user_without_password(username: str, email: str) -> User:
    """Create a user that cannot log in until a password is set (`manage.py changepassword`)."""
    user = User(username=username, email=email)
    user.set_unusable_password()
    user.full_clean()
    user.save()
    return user


@sensitive_variables("password")
def verify_credentials(username: str, password: str) -> User | None:
    """The active user with this password, or None. Upgrades an outdated hash safely.

    Replaces `django.contrib.auth.authenticate`, whose hash upgrade saves the password later
    without a lock and could restore an old password after a reset committed in between. Here
    the slow hash check runs without any lock; only if the hash must be upgraded do we lock the
    user row (same lock as `reset_password`) and save the upgraded hash when the stored hash is
    still the one that was verified. If it changed meanwhile the login fails.
    Unknown users still pay one hash, so timing does not tell them apart.
    """
    user = User.objects.filter(username=username).first()
    if user is None:
        User().set_password(password)  # same cost as a real check
        return None
    upgrade = False

    def request_upgrade(raw_password: str) -> None:
        nonlocal upgrade
        upgrade = True

    verified = check_password(password, user.password, setter=request_upgrade)
    if not verified or not user.is_active:
        return None
    if upgrade and not _upgrade_hash(user, password):
        return None
    return user


@sensitive_variables("password")
def _upgrade_hash(user: User, password: str) -> bool:
    """Save an upgraded hash under the user lock; False if the password changed meanwhile."""
    with transaction.atomic():
        locked = User.objects.select_for_update(no_key=True).get(pk=user.pk)
        if not hmac.compare_digest(locked.password, user.password):
            return False
        locked.set_password(password)
        locked.save(update_fields=["password"])
        user.password = locked.password
    return True


@sensitive_variables("password")
def authenticate_user(username: str, password: str, ip: str | None) -> User:
    """Check credentials with the lockout in front (writes the failure counter and the log).

    Bad password, unknown user and inactive user all raise the same `InvalidCredentialsError`;
    Django's backend hashes a dummy password for unknown users, so timing does not tell them
    apart either. While the username+address pair is locked, even the right password is refused.
    """
    context = AuditContext(ip=ip, username_fingerprint=fingerprint(username))
    try:
        ensure_not_locked_out(username, ip)
    except Throttled:
        log_auth_event(AuthEvent.LOGIN_LOCKED_OUT, context)
        raise
    user = verify_credentials(username, password)
    if user is None:
        locked = register_failure(username, ip)
        log_auth_event(AuthEvent.LOGIN_FAILED, context, {"locked": locked})
        raise InvalidCredentialsError
    expires = user.temporary_password_expires_at
    if user.must_change_password and expires is not None and expires <= server_now():
        # An unused temporary password stops working; the platform admin issues a new account
        # or the user resets the password by email.
        log_auth_event(AuthEvent.LOGIN_FAILED, context, {"reason": "temporary_password_expired"})
        raise InvalidCredentialsError
    clear_failures(username, ip)
    return user


@dataclass(frozen=True)
class DeviceInfo:
    device_id: uuid.UUID
    label: str = ""
    app_version: str = ""


# --- Device registration and session start ---------------------------------------------------


def _lock_device(device_id: uuid.UUID) -> Device | None:
    return Device.objects.select_for_update().filter(pk=device_id).first()


def _create_or_lock_device(user: User, organization: Organization, info: DeviceInfo) -> Device:
    existing = _lock_device(info.device_id)
    if existing is not None:
        return existing
    try:
        with transaction.atomic():
            return Device.objects.create(
                id=info.device_id, organization=organization, created_by=user
            )
    except IntegrityError:
        # Another request registered the same device first: lock and reuse its row.
        raced = _lock_device(info.device_id)
        if raced is None:
            raise
        return raced


def _register_device(user: User, organization: Organization, info: DeviceInfo) -> Device:
    """Create or update the Device of a login (writes Device). Call inside a transaction."""
    device = _create_or_lock_device(user, organization, info)
    if device.organization_id != organization.pk:
        raise DeviceOrganizationMismatchError
    if device.is_revoked:
        raise DeviceRevokedError
    device.label = info.label or device.label
    device.app_version = info.app_version or device.app_version
    device.last_seen_at = server_now()
    device.last_user = user
    device.save(update_fields=["label", "app_version", "last_seen_at", "last_user"])
    return device


def _lock_authenticated_user(user: User) -> User:
    """Lock the user row and check it is still the account that was authenticated.

    A password reset or a deactivation that committed after the credentials were checked
    (a concurrent request) must not be followed by a session: the account must be active and
    its password hash the very one that was verified.
    """
    locked = User.objects.select_for_update(no_key=True).get(pk=user.pk)
    if not locked.is_active or not hmac.compare_digest(locked.password, user.password):
        raise InvalidCredentialsError
    return locked


def start_device_session(user: User, organization: Organization, info: DeviceInfo) -> IssuedTokens:
    """Register the device and open a session for the user in the organization.

    Writes Device, DeviceSession and TokenPair. The user row is locked first and must still be
    active with the authenticated password hash (`InvalidCredentialsError` otherwise), the same
    lock `reset_password` takes. The user's earlier active sessions on the same device are
    superseded (revoked as `superseded`, no final upload), so one phone holds at most one live
    session per user.
    """
    with transaction.atomic():
        _lock_authenticated_user(user)
        # Membership resolution before credentials/session creation can become stale.
        # Personnel deactivation holds this same User lock until its revocation commits.
        if not Membership.objects.filter(
            user=user, organization=organization, is_active=True, organization__is_active=True
        ).exists():
            raise NoActiveMembershipError
        device = _register_device(user, organization, info)
        superseded = revoke_active(
            DeviceSession.objects.filter(user=user, device=device),
            Revocation(RevokeReason.SUPERSEDED, revoked_by=user),
        )
        session = DeviceSession.objects.create(
            organization=organization,
            created_by=user,
            user=user,
            device=device,
            last_used_at=server_now(),
        )
        issued = issue_pair(session)
    if superseded:
        log_auth_event(
            AuthEvent.SESSIONS_REVOKED,
            AuditContext(organization_id=organization.pk, user_id=user.pk, device_id=device.pk),
            {"count": superseded, "reason": RevokeReason.SUPERSEDED.value},
        )
    return issued


def touch_session(session: DeviceSession) -> None:
    """Record activity (writes DeviceSession.last_used_at and Device.last_seen_at), rate-limited."""
    now = server_now()
    last = session.last_used_at
    if last is not None and (now - last).total_seconds() < LAST_USED_UPDATE_INTERVAL_SECONDS:
        return
    changed = DeviceSession.objects.filter(
        pk=session.pk, end_basis="", dissociated_at__isnull=True
    ).update(last_used_at=now)
    if changed:
        Device.objects.filter(pk=session.device_id).update(last_seen_at=now)


# --- Password reset ----------------------------------------------------------------------------


@sensitive_variables("new_password", "token")
def reset_password(user: User, token: str, new_password: str) -> None:
    """Set a new password from a reset token (writes User) and end the user's device sessions.

    Takes the same user lock as `start_device_session`, and checks the token again inside it, so
    a token cannot be spent twice and a login that authenticated with the old password cannot
    open a session afterwards. Revokes every device session (`password_changed`) and withdraws
    every pending final upload, revoked sessions included. Web sessions end by themselves:
    Django ties them to the password hash.
    """
    with transaction.atomic():
        locked = User.objects.select_for_update(no_key=True).get(pk=user.pk)
        if not locked.is_active or not default_token_generator.check_token(locked, token):
            raise InvalidResetTokenError
        locked.set_password(new_password)
        locked.must_change_password = False
        locked.temporary_password_expires_at = None
        locked.save(
            update_fields=["password", "must_change_password", "temporary_password_expires_at"]
        )
        revoke_user_sessions(locked, Revocation(RevokeReason.PASSWORD_CHANGED))
        cancel_final_uploads(locked)


@sensitive_variables("current_password", "new_password")
def change_password(user: User, current_password: str, new_password: str) -> User:
    """Replace the password of a signed-in user (writes User) and end their device sessions.

    The current password is checked again under the user lock. Clears a pending temporary
    password. The caller keeps the web session with `update_session_auth_hash`.
    """
    with transaction.atomic():
        locked = User.objects.select_for_update(no_key=True).get(pk=user.pk)
        if not locked.is_active or not check_password(current_password, locked.password):
            raise InvalidCredentialsError
        locked.set_password(new_password)
        locked.must_change_password = False
        locked.temporary_password_expires_at = None
        locked.save(
            update_fields=["password", "must_change_password", "temporary_password_expires_at"]
        )
        revoke_user_sessions(locked, Revocation(RevokeReason.PASSWORD_CHANGED))
        cancel_final_uploads(locked)
    return locked
