"""Authentication use cases: device sessions, token rotation, revocation, password reset.

Everything that writes says so in its docstring. Rows are locked with `select_for_update` wherever
two requests could race (rotation, revocation, device registration, final upload).
"""

import hmac
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import cast

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from django.views.decorators.debug import sensitive_variables
from rest_framework.exceptions import Throttled

from accounts.audit import AuditContext, AuthEvent, fingerprint, log_auth_event
from accounts.constants import LAST_USED_UPDATE_INTERVAL_SECONDS
from accounts.exceptions import (
    DeviceOrganizationMismatchError,
    DeviceRevokedError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.login_attempts import clear_failures, ensure_not_locked_out, register_failure
from accounts.models import Device, DeviceSession, RevokeReason, User
from accounts.tokens import generate_token, hash_token
from core.exceptions import DomainError
from core.time import server_now
from organizations.models import Organization

# Revoking for these reasons leaves the phone a single last upload (see `consume_final_upload`).
FINAL_UPLOAD_REASONS = frozenset({RevokeReason.ADMIN_REVOKE, RevokeReason.DEVICE_REVOKED})


def create_user_without_password(username: str, email: str) -> User:
    """Create a user that cannot log in until a password is set (`manage.py changepassword`)."""
    user = User(username=username, email=email)
    user.set_unusable_password()
    user.full_clean()
    user.save()
    return user


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
    user = authenticate(username=username, password=password)
    if user is None:
        locked = register_failure(username, ip)
        log_auth_event(AuthEvent.LOGIN_FAILED, context, {"locked": locked})
        raise InvalidCredentialsError
    clear_failures(username, ip)
    return cast(User, user)


@dataclass(frozen=True)
class DeviceInfo:
    device_id: uuid.UUID
    label: str = ""
    app_version: str = ""


@dataclass(frozen=True)
class IssuedTokens:
    """A fresh token pair. The plaintext tokens are shown to the client once and never stored."""

    access: str = field(repr=False)
    refresh: str = field(repr=False)
    session: DeviceSession


@dataclass(frozen=True)
class Revocation:
    reason: RevokeReason
    revoked_by: User | None = None


def _access_ttl() -> timedelta:
    return timedelta(seconds=settings.AUTH_ACCESS_TOKEN_TTL_SECONDS)


def _refresh_ttl() -> timedelta:
    return timedelta(days=settings.AUTH_REFRESH_TOKEN_TTL_DAYS)


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


def start_device_session(user: User, organization: Organization, info: DeviceInfo) -> IssuedTokens:
    """Register the device and open a session for the user in the organization.

    Writes Device and DeviceSession. The user's earlier active sessions on the same device are
    superseded (revoked as `logout`), so one phone holds at most one live session per user.
    """
    now = server_now()
    access, refresh = generate_token(), generate_token()
    with transaction.atomic():
        device = _register_device(user, organization, info)
        _revoke_active(
            DeviceSession.objects.filter(user=user, device=device),
            Revocation(RevokeReason.LOGOUT, revoked_by=user),
        )
        session = DeviceSession.objects.create(
            organization=organization,
            created_by=user,
            user=user,
            device=device,
            access_hash=hash_token(access),
            access_expires_at=now + _access_ttl(),
            refresh_hash=hash_token(refresh),
            refresh_expires_at=now + _refresh_ttl(),
            last_used_at=now,
        )
    return IssuedTokens(access=access, refresh=refresh, session=session)


# --- Revocation --------------------------------------------------------------------------------


def _final_upload_deadline(reason: RevokeReason, now: datetime) -> datetime | None:
    hours = settings.AUTH_REVOKED_FINAL_UPLOAD_HOURS
    if reason in FINAL_UPLOAD_REASONS and hours > 0:
        return now + timedelta(hours=hours)
    return None


def _revoke_active(sessions: QuerySet[DeviceSession], revocation: Revocation) -> int:
    """Revoke the active sessions of a queryset (writes DeviceSession). Locks them first."""
    now = server_now()
    with transaction.atomic():
        ids = list(
            sessions.filter(revoked_at__isnull=True)
            .select_for_update()
            .values_list("pk", flat=True)
        )
        DeviceSession.objects.filter(pk__in=ids).update(
            revoked_at=now,
            revoked_by=revocation.revoked_by,
            revoke_reason=revocation.reason,
            final_upload_deadline=_final_upload_deadline(revocation.reason, now),
        )
    return len(ids)


def revoke_user_sessions(
    user: User, revocation: Revocation, organization: Organization | None = None
) -> int:
    """Revoke every active session of a user, optionally only in one organization (writes)."""
    sessions = DeviceSession.objects.filter(user=user)
    if organization is not None:
        sessions = sessions.filter(organization=organization)
    return _revoke_active(sessions, revocation)


def revoke_session(session: DeviceSession, revocation: Revocation) -> int:
    """Revoke one session if it is still active (writes). Calling it again changes nothing."""
    return _revoke_active(DeviceSession.objects.filter(pk=session.pk), revocation)


def revoke_device(device: Device, admin: User) -> Device:
    """Mark a device as revoked and revoke all its sessions (writes Device, DeviceSession).

    Lost phone: the device can no longer log in. Idempotent: an already revoked device is
    returned unchanged.
    """
    with transaction.atomic():
        locked = Device.objects.select_for_update().get(pk=device.pk)
        if locked.is_revoked:
            return locked
        locked.is_revoked = True
        locked.revoked_at = server_now()
        locked.revoked_by = admin
        locked.save(update_fields=["is_revoked", "revoked_at", "revoked_by"])
        count = _revoke_active(
            DeviceSession.objects.filter(device=locked),
            Revocation(RevokeReason.DEVICE_REVOKED, revoked_by=admin),
        )
    log_auth_event(
        AuthEvent.DEVICE_REVOKED,
        AuditContext(organization_id=locked.organization_id, user_id=admin.pk, device_id=locked.pk),
        {"sessions": count},
    )
    return locked


# --- Refresh rotation --------------------------------------------------------------------------


def _lock_session_by_refresh_hash(digest: str) -> DeviceSession | None:
    """The session whose current or previous refresh token has this digest, row locked."""
    return (
        DeviceSession.objects.select_for_update(of=("self",))
        .select_related("user", "device")
        .filter(Q(refresh_hash=digest) | Q(previous_refresh_hash=digest))
        .first()
    )


def _is_previous_refresh(session: DeviceSession, digest: str) -> bool:
    return not hmac.compare_digest(session.refresh_hash, digest)


def _within_grace(session: DeviceSession, now: datetime) -> bool:
    grace = timedelta(seconds=settings.AUTH_REFRESH_REUSE_GRACE_SECONDS)
    return session.rotated_at is not None and now - session.rotated_at <= grace


def _refresh_failure(session: DeviceSession, digest: str, now: datetime) -> DomainError | None:
    """Why a refresh must be refused, or None. May revoke the session (writes DeviceSession)."""
    if session.revoked_at is not None or session.device.is_revoked:
        return SessionRevokedError()
    if not session.user.is_active:
        revoke_session(session, Revocation(RevokeReason.USER_DEACTIVATED))
        return SessionRevokedError()
    if session.refresh_expires_at <= now:
        return TokenExpiredError()
    if _is_previous_refresh(session, digest) and not _within_grace(session, now):
        revoke_session(session, Revocation(RevokeReason.REFRESH_REUSE))
        log_auth_event(
            AuthEvent.REFRESH_REUSE_DETECTED,
            AuditContext(
                organization_id=session.organization_id,
                user_id=session.user_id,
                device_id=session.device_id,
            ),
        )
        return SessionRevokedError()
    return None


def _rotate(session: DeviceSession, digest: str, now: datetime) -> IssuedTokens:
    """Issue a new pair and keep the replaced refresh token as `previous` (writes the session)."""
    access, refresh = generate_token(), generate_token()
    if not _is_previous_refresh(session, digest):
        session.previous_refresh_hash = session.refresh_hash
        session.rotated_at = now
    # A retry inside the grace window (the first response was lost) keeps the original
    # `previous_refresh_hash` and `rotated_at`, so the window never stretches.
    session.access_hash = hash_token(access)
    session.access_expires_at = now + _access_ttl()
    session.refresh_hash = hash_token(refresh)
    session.refresh_expires_at = now + _refresh_ttl()
    session.last_used_at = now
    session.save(
        update_fields=[
            "access_hash",
            "access_expires_at",
            "refresh_hash",
            "previous_refresh_hash",
            "refresh_expires_at",
            "rotated_at",
            "last_used_at",
        ]
    )
    return IssuedTokens(access=access, refresh=refresh, session=session)


def rotate_refresh_token(refresh_token: str, device_id: uuid.UUID) -> IssuedTokens:
    """Exchange a refresh token for a new access + refresh pair (writes DeviceSession).

    The old refresh token is kept as `previous`. Presenting it again inside the grace window
    (a response lost on a weak signal) rotates again; after the window it means the token was
    copied: the session is revoked as `refresh_reuse`. The revocation is committed before the
    error is raised.
    """
    digest = hash_token(refresh_token)
    now = server_now()
    failure: DomainError
    with transaction.atomic():
        session = _lock_session_by_refresh_hash(digest)
        if session is None or session.device_id != device_id:
            raise InvalidTokenError
        refusal = _refresh_failure(session, digest, now)
        if refusal is None:
            return _rotate(session, digest, now)
        failure = refusal
    raise failure


# --- Final upload of a revoked device ------------------------------------------------------------


def is_final_upload_available(session: DeviceSession, now: datetime) -> bool:
    """A revoked session may still make one upload before its deadline (opt-in views only)."""
    return (
        session.revoked_at is not None
        and session.revoke_reason in FINAL_UPLOAD_REASONS
        and session.final_upload_deadline is not None
        and now <= session.final_upload_deadline
        and session.final_upload_used_at is None
    )


def consume_final_upload(session: DeviceSession) -> None:
    """Spend the single final upload of a revoked session (writes DeviceSession).

    Atomic: of two concurrent calls only one succeeds. The other gets `SessionRevokedError`.
    The view that accepts the upload calls this in the same transaction as its own writes and
    answers with `X-Session-Revoked: true`.
    """
    now = server_now()
    with transaction.atomic():
        locked = DeviceSession.objects.select_for_update().get(pk=session.pk)
        if not is_final_upload_available(locked, now):
            raise SessionRevokedError
        locked.final_upload_used_at = now
        locked.save(update_fields=["final_upload_used_at"])


def touch_session(session: DeviceSession) -> None:
    """Record activity (writes DeviceSession.last_used_at and Device.last_seen_at), rate-limited."""
    now = server_now()
    last = session.last_used_at
    if last is not None and (now - last).total_seconds() < LAST_USED_UPDATE_INTERVAL_SECONDS:
        return
    DeviceSession.objects.filter(pk=session.pk).update(last_used_at=now)
    Device.objects.filter(pk=session.device_id).update(last_seen_at=now)


# --- Password reset ----------------------------------------------------------------------------


@sensitive_variables("new_password", "token")
def reset_password(user: User, token: str, new_password: str) -> None:
    """Set a new password from a reset token (writes User) and end the user's device sessions.

    The user row is locked and the token checked again inside the lock, so a token cannot be
    spent twice by two concurrent requests. Web sessions end by themselves: Django ties them to
    the password hash.
    """
    with transaction.atomic():
        locked = User.objects.select_for_update().get(pk=user.pk)
        if not locked.is_active or not default_token_generator.check_token(locked, token):
            raise InvalidResetTokenError
        locked.set_password(new_password)
        locked.save(update_fields=["password"])
        revoke_user_sessions(locked, Revocation(RevokeReason.PASSWORD_CHANGED))
