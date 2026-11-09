"""Bounded session-row unlinking; device, business and log identity remain independent."""

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils.timezone import is_aware

from accounts.audit import AuditContext, AuthEvent, log_auth_event
from accounts.models import DeviceSession, SessionEndBasis, SessionHoldPurpose
from core.time import server_now

MAX_AUDITS_PER_RUN = 500
MAX_HOLD_DAYS = 90


@dataclass(frozen=True)
class EndProof:
    ended_at: datetime | None
    retention_anchor: datetime
    end_basis: str
    end_reason: str


def end_proof(
    session: DeviceSession, latest_expiry: datetime | None, observed_at: datetime
) -> EndProof:
    """Describe proof already selected under the session lock; this does not authorize pruning."""
    if session.revoked_at is not None:
        window = session.revoked_at + timedelta(hours=settings.AUTH_REVOKED_FINAL_UPLOAD_HOURS)
        boundary = max(window, session.final_upload_deadline or window)
        return EndProof(
            boundary, boundary, SessionEndBasis.REVOCATION_WINDOW, session.revoke_reason
        )
    if latest_expiry is not None:
        return EndProof(latest_expiry, latest_expiry, SessionEndBasis.TOKEN_EXPIRY, "expired")
    return EndProof(None, observed_at, SessionEndBasis.LEGACY_EMPTY, "unknown")


def remember_end(
    session: DeviceSession, latest_expiry: datetime | None, observed_at: datetime
) -> None:
    """Write end evidence before the caller deletes its locked family, in the SAME transaction."""
    if session.end_basis:
        return
    proof = asdict(end_proof(session, latest_expiry, observed_at))
    DeviceSession.objects.filter(pk=session.pk).update(**proof)


@dataclass(frozen=True)
class DissociationResult:
    sessions_dissociated: int = 0
    candidates_checked: int = 0
    skipped_after_lock: int = 0


def _dissociate(session_id: UUID, now: datetime) -> bool:
    with transaction.atomic():
        session = DeviceSession.objects.select_for_update().get(pk=session_id)
        cutoff = now - timedelta(days=settings.AUTH_SESSION_AUDIT_RETENTION_DAYS)
        if (
            session.dissociated_at is not None
            or not session.end_basis
            or session.retention_anchor is None
            or session.retention_anchor >= cutoff
            or (session.hold_until is not None and session.hold_until > now)
            or session.token_pairs.exists()
        ):
            return False
        DeviceSession.objects.filter(pk=session.pk).update(
            user=None,
            created_by=None,
            revoked_by=None,
            last_used_at=None,
            final_upload_deadline=None,
            final_upload_used_at=None,
            hold_until=None,
            hold_purpose="",
            hold_reference=None,
            dissociated_at=now,
        )
        return True


def dissociate_ended_sessions() -> DissociationResult:
    """Unlink at most one capped batch; every decision is rechecked under the current row lock."""
    now = server_now()
    cutoff = now - timedelta(days=settings.AUTH_SESSION_AUDIT_RETENTION_DAYS)
    candidates = list(
        DeviceSession.objects.filter(dissociated_at__isnull=True, retention_anchor__lt=cutoff)
        .exclude(end_basis="")
        .filter(Q(hold_until__isnull=True) | Q(hold_until__lte=now))
        .order_by("pk")
        .values_list("pk", flat=True)[:MAX_AUDITS_PER_RUN]
    )
    dissociated = sum(_dissociate(identifier, now) for identifier in candidates)
    result = DissociationResult(dissociated, len(candidates), len(candidates) - dissociated)
    log_auth_event(AuthEvent.SESSION_AUDITS_DISSOCIATED, AuditContext(), asdict(result))
    return result


@dataclass(frozen=True)
class HoldRequest:
    organization_id: UUID
    session_id: UUID
    purpose: str
    reference: UUID
    until: datetime | None


def validate_hold(request: HoldRequest, now: datetime) -> None:
    if request.purpose != SessionHoldPurpose.SECURITY_INVESTIGATION or not isinstance(
        request.reference, UUID
    ):
        raise ValueError(
            "An explicit security-investigation purpose and opaque UUID reference are required."
        )
    if request.until is not None and (
        not is_aware(request.until)
        or not now < request.until <= now + timedelta(days=MAX_HOLD_DAYS)
    ):
        raise ValueError(
            "Hold until must be an aware future instant within 90 days of this action."
        )


def _scoped_session(
    organization_id: UUID, session_id: UUID, *, lock: bool = False
) -> DeviceSession:
    rows = DeviceSession.objects.filter(organization_id=organization_id, pk=session_id).only(
        "id",
        "organization_id",
        "device_id",
        "end_basis",
        "end_reason",
        "ended_at",
        "retention_anchor",
        "dissociated_at",
        "hold_until",
        "hold_purpose",
        "hold_reference",
    )
    session = (rows.select_for_update() if lock else rows).first()
    if session is None:
        raise ValueError("Unknown organization/session pair.")
    return session


def change_session_hold(request: HoldRequest, *, apply: bool = False) -> dict[str, object]:
    """Privileged CLI-only action; dry-run by default, no public permission is borrowed."""
    now = server_now()
    validate_hold(request, now)
    with transaction.atomic():
        session = _scoped_session(request.organization_id, request.session_id, lock=True)
        if session.dissociated_at is not None:
            raise ValueError("A dissociated session cannot be held or restored.")
        if request.until is None and session.hold_reference not in (None, request.reference):
            raise ValueError("Release requires the current opaque investigation reference.")
        if apply:
            DeviceSession.objects.filter(pk=session.pk).update(
                hold_until=request.until,
                hold_purpose=request.purpose if request.until else "",
                hold_reference=request.reference if request.until else None,
            )
    if apply:
        log_auth_event(
            AuthEvent.SESSION_AUDIT_HOLD_CHANGED,
            AuditContext(organization_id=request.organization_id),
            {
                "session_id": request.session_id,
                "operation": "hold" if request.until else "release",
                "purpose": request.purpose,
                "reference": request.reference,
                "until": request.until.isoformat() if request.until else None,
            },
        )
    return {"applied": apply, "operation": "hold" if request.until else "release"}


def session_audit(organization_id: UUID, session_id: UUID) -> dict[str, object]:
    """Minimal operator projection, with no user/creator/revoker lookup or output."""
    session = _scoped_session(organization_id, session_id)
    state = (
        "dissociated"
        if session.dissociated_at
        else "ended"
        if session.end_basis
        else "unclassified"
    )
    return {
        "state": state,
        "organization_id": str(session.organization_id),
        "session_id": str(session.pk),
        "device_id": str(session.device_id),
        "end_basis": session.end_basis or None,
        "end_reason": session.end_reason or None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "retention_anchor": session.retention_anchor.isoformat()
        if session.retention_anchor
        else None,
        "dissociated_at": session.dissociated_at.isoformat() if session.dissociated_at else None,
    }
