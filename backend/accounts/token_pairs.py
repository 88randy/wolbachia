"""Token pairs of a device session: issuing, rotation with reuse detection, validity.

Rules (decision 36, docs/api-conventions.md):

* A refresh token is single use. Exchanging it consumes its pair and issues a child pair.
* A consumed refresh token presented again *inside the grace window* is a lost response: it is
  allowed only if no token issued after it has been used yet (no child access token used, no child
  refresh consumed). It then issues one more sibling pair; every pair issued in the window stays
  valid, so out-of-order responses do not strand the client.
* A consumed refresh token presented outside the window, or after a later token was used, means a
  copy exists: the whole session is revoked (`refresh_reuse`).
* Once the window has closed, a sibling pair that was never used is retired if another sibling
  was used or consumed.

The revocation is committed before the error is raised, so none of this may run inside an outer
`atomic()` (see `accounts.revocation`).
"""

import hmac
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q

from accounts.audit import AuditContext, AuthEvent, log_auth_event
from accounts.exceptions import (
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import DeviceSession, RevokeReason, TokenPair
from accounts.revocation import Revocation, revoke_session
from accounts.tokens import generate_token, hash_token
from core.exceptions import DomainError
from core.time import server_now
from organizations.models import Membership


@dataclass(frozen=True)
class IssuedTokens:
    """A fresh token pair. The plaintext tokens are shown to the client once and never stored."""

    access: str = field(repr=False)
    refresh: str = field(repr=False)
    session: DeviceSession
    pair: TokenPair


def _grace() -> timedelta:
    return timedelta(seconds=settings.AUTH_REFRESH_REUSE_GRACE_SECONDS)


def issue_pair(session: DeviceSession, parent: TokenPair | None = None) -> IssuedTokens:
    """Create a new token pair for the session (writes TokenPair)."""
    now = server_now()
    access, refresh = generate_token(), generate_token()
    pair = TokenPair.objects.create(
        organization_id=session.organization_id,
        created_by_id=session.user_id,
        session=session,
        parent=parent,
        access_hash=hash_token(access),
        access_expires_at=now + timedelta(seconds=settings.AUTH_ACCESS_TOKEN_TTL_SECONDS),
        refresh_hash=hash_token(refresh),
        refresh_expires_at=now + timedelta(days=settings.AUTH_REFRESH_TOKEN_TTL_DAYS),
    )
    return IssuedTokens(access=access, refresh=refresh, session=session, pair=pair)


def has_used_descendants(pair: TokenPair) -> bool:
    """True when a pair issued from this one had its access token used or its refresh consumed."""
    return pair.children.filter(
        Q(access_used_at__isnull=False) | Q(consumed_at__isnull=False)
    ).exists()


def is_retired_sibling(pair: TokenPair, now: datetime) -> bool:
    """A never-used sibling whose window closed after another sibling was used or consumed."""
    parent = pair.parent
    if parent is None or parent.consumed_at is None:
        return False
    if pair.consumed_at is not None or pair.access_used_at is not None:
        return False
    if now <= parent.consumed_at + _grace():
        return False
    return (
        TokenPair.objects.filter(parent_id=parent.pk)
        .exclude(pk=pair.pk)
        .filter(Q(access_used_at__isnull=False) | Q(consumed_at__isnull=False))
        .exists()
    )


def is_access_superseded(pair: TokenPair, now: datetime) -> bool:
    """The pair was exchanged and its grace window for the access token has passed."""
    return pair.superseded_at is not None and now > pair.superseded_at + _grace()


def mark_access_used(pair: TokenPair) -> None:
    """Record the first use of the pair's access token (writes TokenPair.access_used_at)."""
    if pair.access_used_at is None:
        TokenPair.objects.filter(pk=pair.pk, access_used_at__isnull=True).update(
            access_used_at=server_now()
        )


def _has_active_membership(session: DeviceSession) -> bool:
    return Membership.objects.filter(
        user_id=session.user_id,
        organization_id=session.organization_id,
        is_active=True,
        organization__is_active=True,
    ).exists()


def _audit(session: DeviceSession) -> AuditContext:
    return AuditContext(
        organization_id=session.organization_id,
        user_id=session.user_id,
        device_id=session.device_id,
    )


def _revoked_failure(session: DeviceSession, reason: RevokeReason) -> DomainError:
    revoke_session(session, Revocation(reason))
    return SessionRevokedError()


def _session_failure(session: DeviceSession) -> DomainError | None:
    """Why the session itself cannot refresh, or None. May revoke it (writes DeviceSession)."""
    if session.revoked_at is not None or session.device.is_revoked:
        return SessionRevokedError()
    if not session.user.is_active:
        return _revoked_failure(session, RevokeReason.USER_DEACTIVATED)
    if not _has_active_membership(session):
        return _revoked_failure(session, RevokeReason.MEMBERSHIP_INACTIVE)
    return None


def _consumed_failure(pair: TokenPair, now: datetime) -> DomainError | None:
    """A consumed refresh token came back: a grace retry (None) or a reuse (session revoked)."""
    assert pair.consumed_at is not None  # noqa: S101
    in_window = now <= pair.consumed_at + _grace()
    if in_window and not has_used_descendants(pair):
        log_auth_event(AuthEvent.REFRESH_GRACE_RETRY, _audit(pair.session))
        return None
    log_auth_event(AuthEvent.REFRESH_REUSE_DETECTED, _audit(pair.session))
    return _revoked_failure(pair.session, RevokeReason.REFRESH_REUSE)


def _refresh_failure(pair: TokenPair, now: datetime) -> DomainError | None:
    """Why a refresh must be refused, or None when the pair may be exchanged."""
    failure = _session_failure(pair.session)
    if failure is not None:
        return failure
    if pair.consumed_at is not None:
        return _consumed_failure(pair, now)
    if pair.refresh_expires_at <= now:
        return TokenExpiredError()
    if is_retired_sibling(pair, now):
        return InvalidTokenError()
    return None


def _lock_pair(digest: str) -> TokenPair | None:
    """The pair with this refresh digest and its session, both rows locked (session first)."""
    found = TokenPair.objects.filter(refresh_hash=digest).values_list("pk", "session_id").first()
    if found is None:
        return None
    pair_pk, session_pk = found
    DeviceSession.objects.select_for_update().get(pk=session_pk)
    return (
        TokenPair.objects.select_for_update(of=("self",))
        .select_related("session__user", "session__device", "parent")
        .get(pk=pair_pk)
    )


def rotate_refresh_token(refresh_token: str, device_id: uuid.UUID) -> IssuedTokens:
    """Exchange a refresh token for a new access + refresh pair (writes TokenPair, session).

    See the module docstring for the reuse rules. A reuse revokes the session and the revocation
    is committed before `SessionRevokedError` is raised.
    """
    digest = hash_token(refresh_token)
    now = server_now()
    failure: DomainError
    with transaction.atomic():
        pair = _lock_pair(digest)
        if (
            pair is None
            or not hmac.compare_digest(pair.refresh_hash, digest)
            or pair.session.device_id != device_id
        ):
            raise InvalidTokenError
        refusal = _refresh_failure(pair, now)
        if refusal is None:
            if pair.consumed_at is None:
                pair.consumed_at = pair.superseded_at = now
                pair.save(update_fields=["consumed_at", "superseded_at"])
            pair.session.last_used_at = now
            pair.session.save(update_fields=["last_used_at"])
            return issue_pair(pair.session, parent=pair)
        failure = refusal
    raise failure
