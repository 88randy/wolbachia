"""Revoking device sessions and devices, and the single final upload of a revoked phone.

Lock order is User, Device, DeviceSession, TokenPair (accounts/README.md).

None of these functions may run inside a caller's outer `transaction.atomic()` (nor with
`ATOMIC_REQUESTS`): they take row locks and some callers raise right after revoking, relying on
the revocation having already been committed. `tests/test_settings.py` checks that
`ATOMIC_REQUESTS` stays off.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet

from accounts.audit import AuditContext, AuthEvent, log_auth_event
from accounts.exceptions import SessionRevokedError
from accounts.models import Device, DeviceSession, RevokeReason, User
from core.time import server_now
from organizations.models import Organization

# A final upload can only follow these reasons, and only when an administrator asks for it.
FINAL_UPLOAD_REASONS = frozenset({RevokeReason.ADMIN_REVOKE, RevokeReason.DEVICE_REVOKED})


@dataclass(frozen=True)
class Revocation:
    """Why sessions are revoked, by whom, and whether the phone keeps one final upload.

    `allow_final_upload` only counts for `admin_revoke` and `device_revoked`: every other reason
    (logout, refresh reuse, password change, supersession, deactivation...) never allows it.
    """

    reason: RevokeReason
    revoked_by: User | None = None
    allow_final_upload: bool = False


def _final_upload_deadline(revocation: Revocation, now: datetime) -> datetime | None:
    hours = settings.AUTH_REVOKED_FINAL_UPLOAD_HOURS
    if revocation.allow_final_upload and revocation.reason in FINAL_UPLOAD_REASONS and hours > 0:
        return now + timedelta(hours=hours)
    return None


def revoke_active(sessions: QuerySet[DeviceSession], revocation: Revocation) -> int:
    """Revoke the active sessions of a queryset (writes DeviceSession); returns how many.

    Locks them first. A caller that raises right after revoking must do it after its own
    transaction has exited, or the revocation rolls back (see the module docstring).
    """
    now = server_now()
    with transaction.atomic():
        locked = sessions.filter(revoked_at__isnull=True).select_for_update()
        ids = list(locked.values_list("pk", flat=True))
        DeviceSession.objects.filter(pk__in=ids).update(
            revoked_at=now,
            revoked_by=revocation.revoked_by,
            revoke_reason=revocation.reason,
            final_upload_deadline=_final_upload_deadline(revocation, now),
        )
    return len(ids)


def revoke_user_sessions(
    user: User, revocation: Revocation, organization: Organization | None = None
) -> int:
    """Revoke every active session of a user, optionally only in one organization (writes)."""
    sessions = DeviceSession.objects.filter(user=user)
    if organization is not None:
        sessions = sessions.filter(organization=organization)
    with transaction.atomic():
        # Global lock order: the user comes before its sessions (accounts/README.md).
        User.objects.select_for_update(no_key=True).filter(pk=user.pk).first()
        return revoke_active(sessions, revocation)


def revoke_session(session: DeviceSession, revocation: Revocation) -> int:
    """Revoke one session if it is still active (writes). Calling it again changes nothing."""
    return revoke_active(DeviceSession.objects.filter(pk=session.pk), revocation)


def revoke_device(device: Device, admin: User, allow_final_upload: bool = False) -> Device:
    """Mark a device as revoked and revoke all its sessions (writes Device, DeviceSession).

    Lost phone: the device cannot log in again. Idempotent: an already revoked device is returned
    unchanged. The phone keeps a final upload only with `allow_final_upload`.
    """
    with transaction.atomic():
        locked = Device.objects.select_for_update().get(pk=device.pk)
        if locked.is_revoked:
            return locked
        locked.is_revoked = True
        locked.revoked_at = server_now()
        locked.revoked_by = admin
        locked.save(update_fields=["is_revoked", "revoked_at", "revoked_by"])
        count = revoke_active(
            DeviceSession.objects.filter(device=locked),
            Revocation(RevokeReason.DEVICE_REVOKED, admin, allow_final_upload),
        )
    log_auth_event(
        AuthEvent.DEVICE_REVOKED,
        AuditContext(organization_id=locked.organization_id, user_id=admin.pk, device_id=locked.pk),
        {"sessions": count, "final_upload": allow_final_upload},
    )
    return locked


def cancel_final_uploads(user: User) -> int:
    """Withdraw the pending final uploads of all the user's sessions, revoked ones included.

    A password change must not leave a phone that knew the old password an open upload (writes
    DeviceSession.final_upload_deadline). Call it inside the transaction that sets the password.
    """
    return DeviceSession.objects.filter(user=user, final_upload_deadline__isnull=False).update(
        final_upload_deadline=None
    )


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

    Atomic: of two concurrent calls only one succeeds, the other gets `SessionRevokedError`.
    `accounts.final_upload.FinalUploadMixin` calls it for every opt-in view, inside the request's
    transaction, so a view cannot forget it.
    """
    now = server_now()
    with transaction.atomic():
        # Global lock order: user, then session. Holding the user also keeps a password reset
        # (which takes the user lock first) from interleaving with the upload's own writes.
        User.objects.select_for_update(no_key=True).get(pk=session.user_id)
        locked = DeviceSession.objects.select_for_update().get(pk=session.pk)
        if not is_final_upload_available(locked, now):
            raise SessionRevokedError
        locked.final_upload_used_at = now
        locked.save(update_fields=["final_upload_used_at"])
