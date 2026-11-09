"""Token pairs of a device session: issuing, rotation with reuse detection, validity.

Rules (decision 48, docs/api-conventions.md):

* A refresh token is single use. Exchanging it consumes its pair and issues a child pair.
* A consumed refresh token presented again *inside the grace window* is a lost response: it is
  allowed only if no token issued after it has been used yet (no child access token used, no child
  refresh consumed) and the parent has fewer than `MAX_SIBLING_PAIRS` children. It then issues one
  more sibling pair.
* Past the sibling cap a duplicate is refused with `429 throttled` and `Retry-After` until the window
  closes; it does not revoke. A consumed refresh token presented outside the window or after a later
  token was used means a copy exists: the whole session is revoked (`refresh_reuse`).
* Per parent, only the first sibling ever used (its access token used or its refresh exchanged) is
  valid. Using or refreshing any other sibling afterwards revokes the session (`refresh_reuse`).

Lock order (see accounts/README.md): User, Device, DeviceSession, TokenPair. Refresh locks the user
first. The revocation is committed before the error is raised, so none of this may run inside an
outer `atomic()` (see `accounts.revocation`).
"""

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import Throttled

from accounts.audit import AuditContext, AuthEvent, log_auth_event
from accounts.exceptions import (
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import DeviceSession, RevokeReason, TokenPair, User
from accounts.revocation import Revocation, revoke_session
from accounts.tokens import generate_token, hash_token
from core.exceptions import DomainError
from core.time import server_now
from organizations.models import Membership

# Children a consumed pair may have: the first exchange plus accepted duplicates (lost responses).
MAX_SIBLING_PAIRS = 3


@dataclass(frozen=True)
class IssuedTokens:
    """A fresh token pair. The plaintext tokens are shown to the client once and never stored."""

    access: str = field(repr=False)
    refresh: str = field(repr=False)
    session: DeviceSession
    pair: TokenPair


def _grace() -> timedelta:
    return timedelta(seconds=settings.AUTH_REFRESH_REUSE_GRACE_SECONDS)


def _adopted() -> Q:
    """A pair that was used: its access token used or its refresh token exchanged."""
    return Q(access_used_at__isnull=False) | Q(consumed_at__isnull=False)


def issue_pair(session: DeviceSession, parent: TokenPair | None = None) -> IssuedTokens:
    """Create a new token pair for the session (writes TokenPair)."""
    with transaction.atomic():
        session = DeviceSession.objects.select_for_update().get(pk=session.pk)
        if session.user_id is None or session.end_basis or session.dissociated_at is not None:
            raise InvalidTokenError
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
    return pair.children.filter(_adopted()).exists()


def _other_adopted_sibling(pair: TokenPair) -> bool:
    if pair.parent_id is None:
        return False
    siblings = TokenPair.objects.filter(parent_id=pair.parent_id).exclude(pk=pair.pk)
    return siblings.filter(_adopted()).exists()


def is_retired_sibling(pair: TokenPair) -> bool:
    """A never-used sibling of a pair that was used: it must not be used any more."""
    if pair.access_used_at is not None or pair.consumed_at is not None:
        return False
    return _other_adopted_sibling(pair)


def is_access_superseded(pair: TokenPair, now: datetime) -> bool:
    """The pair was exchanged and its grace window for the access token has passed."""
    return pair.superseded_at is not None and now > pair.superseded_at + _grace()


def _audit(session: DeviceSession) -> AuditContext:
    return AuditContext(
        organization_id=session.organization_id,
        user_id=session.user_id,
        device_id=session.device_id,
    )


def _reuse(session: DeviceSession) -> DomainError:
    """A token that must not come back did: revoke the session (writes) and log it."""
    log_auth_event(AuthEvent.REFRESH_REUSE_DETECTED, _audit(session))
    revoke_session(session, Revocation(RevokeReason.REFRESH_REUSE))
    return SessionRevokedError()


def claim_access_use(pair: TokenPair) -> DomainError | None:
    """Record the first use of the pair's access token (writes TokenPair.access_used_at).

    Returns the error to raise, or None. Any pair that has a parent is claimed under the locks of
    the global order (user, session, parent pair) before looking at its siblings: no decision
    depends on a count taken without the lock, because a duplicate refresh may create a sibling
    at any moment. If another sibling was used first, this is a copy and the session is revoked.
    Raise the result only after this function returned, so the revocation is committed.
    """
    if pair.session.user_id is None or pair.session.end_basis or pair.session.dissociated_at:
        return InvalidTokenError()
    if pair.access_used_at is not None:
        return None
    if pair.parent_id is None:  # the pair of a login has no siblings
        TokenPair.objects.filter(pk=pair.pk, access_used_at__isnull=True).update(
            access_used_at=server_now()
        )
        return None
    failure: DomainError | None = None
    with transaction.atomic():
        User.objects.select_for_update(no_key=True).get(pk=pair.session.user_id)
        session = DeviceSession.objects.select_for_update().get(pk=pair.session_id)
        TokenPair.objects.select_for_update().get(pk=pair.parent_id)  # type: ignore[misc]
        if session.revoked_at is not None:
            failure = SessionRevokedError()
        elif _other_adopted_sibling(pair):
            failure = _reuse(session)
        else:
            TokenPair.objects.filter(pk=pair.pk, access_used_at__isnull=True).update(
                access_used_at=server_now()
            )
    return failure


def _has_active_membership(session: DeviceSession) -> bool:
    if session.user_id is None:
        return False
    return Membership.objects.filter(
        user_id=session.user_id,
        organization_id=session.organization_id,
        is_active=True,
        organization__is_active=True,
    ).exists()


def _revoked_failure(session: DeviceSession, reason: RevokeReason) -> DomainError:
    revoke_session(session, Revocation(reason))
    return SessionRevokedError()


def _session_failure(session: DeviceSession) -> DomainError | None:
    """Why the session itself cannot refresh, or None. May revoke it (writes DeviceSession)."""
    if session.user is None or session.end_basis or session.dissociated_at is not None:
        return InvalidTokenError()
    if session.revoked_at is not None or session.device.is_revoked:
        return SessionRevokedError()
    if not session.user.is_active:
        return _revoked_failure(session, RevokeReason.USER_DEACTIVATED)
    if not _has_active_membership(session):
        return _revoked_failure(session, RevokeReason.MEMBERSHIP_INACTIVE)
    return None


def _consumed_failure(pair: TokenPair, consumed_at: datetime, now: datetime) -> Exception | None:
    """A consumed refresh token came back: a grace retry (None), a throttle or a reuse.

    Reaching the sibling cap does not revoke: the duplicate is refused with `429 throttled` and
    `Retry-After` until the grace window closes (nothing proves a copy exists). Revocation is for
    a token that was actually used after this one, or one presented outside the window.
    """
    window_end = consumed_at + _grace()
    if now > window_end or has_used_descendants(pair):
        return _reuse(pair.session)
    if pair.children.count() >= MAX_SIBLING_PAIRS:
        return Throttled(wait=max(1, math.ceil((window_end - now).total_seconds())))
    log_auth_event(AuthEvent.REFRESH_GRACE_RETRY, _audit(pair.session))
    return None


def _refresh_failure(pair: TokenPair, now: datetime) -> Exception | None:
    """Why a refresh must be refused, or None when the pair may be exchanged."""
    failure = _session_failure(pair.session)
    if failure is not None:
        return failure
    if pair.consumed_at is not None:
        return _consumed_failure(pair, pair.consumed_at, now)
    if pair.refresh_expires_at <= now:
        return TokenExpiredError()
    if _other_adopted_sibling(pair):
        return _reuse(pair.session)  # a sibling was used first: this one is a copy
    return None


def _lock_pair(digest: str) -> TokenPair | None:
    """The pair with this refresh digest, locked with its user, session and parent.

    Global lock order: user, session, pair (the parent pair is locked right after the pair).
    """
    found = (
        TokenPair.objects.filter(refresh_hash=digest)
        .values_list("pk", "session_id", "session__user_id", "parent_id")
        .first()
    )
    if found is None:
        return None
    pair_pk, session_pk, user_pk, parent_pk = found
    if user_pk is None:
        return None
    User.objects.select_for_update(no_key=True).get(pk=user_pk)
    DeviceSession.objects.select_for_update().get(pk=session_pk)
    pair = (
        TokenPair.objects.select_for_update(of=("self",))
        .select_related("session__user", "session__device", "parent")
        .filter(pk=pair_pk)
        .first()
    )
    # Retention may have pruned the ended family while we waited for the session lock.
    if pair is None:
        return None
    if parent_pk is not None:
        TokenPair.objects.select_for_update().get(pk=parent_pk)
    return pair


def rotate_refresh_token(refresh_token: str, device_id: uuid.UUID) -> IssuedTokens:
    """Exchange a refresh token for a new access + refresh pair (writes TokenPair, session).

    See the module docstring for the reuse rules. A reuse revokes the session and the revocation
    is committed before `SessionRevokedError` is raised.
    """
    digest = hash_token(refresh_token)
    now = server_now()
    failure: Exception
    with transaction.atomic():
        pair = _lock_pair(digest)
        if pair is None or pair.session.device_id != device_id:
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
