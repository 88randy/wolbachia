"""Prune only complete families whose effective end is older than retention (#54).

The DeviceSession row lock serializes the eligibility re-check and delete with refresh,
revocation and final upload. We skip User/Device locks and never acquire them afterwards.
Each session commits independently; candidate selection is bounded and holds no locks.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Max, Q, QuerySet

from accounts.audit import AuditContext, AuthEvent, log_auth_event
from accounts.models import DeviceSession, TokenPair
from core.time import server_now

MAX_SESSIONS_PER_RUN = 500


@dataclass(frozen=True)
class PruneResult:
    sessions_pruned: int = 0
    pairs_deleted: int = 0


def _eligible_sessions(cutoff: datetime) -> QuerySet[DeviceSession]:
    """Both maxima must precede cutoff; NULL (an empty family) is never eligible."""
    revoked = Q(revoked_at__lt=cutoff) & (
        Q(final_upload_deadline__isnull=True) | Q(final_upload_deadline__lt=cutoff)
    )
    expired = Q(revoked_at__isnull=True, last_refresh__lt=cutoff, last_access__lt=cutoff)
    return (
        DeviceSession.objects.annotate(
            last_refresh=Max("token_pairs__refresh_expires_at"),
            last_access=Max("token_pairs__access_expires_at"),
        )
        .filter(last_refresh__isnull=False)
        .filter(revoked | expired)
    )


def _prune_session(session_id: UUID, cutoff: datetime) -> int:
    with transaction.atomic():
        session = DeviceSession.objects.select_for_update().get(pk=session_id)
        if not _eligible_sessions(cutoff).filter(pk=session.pk).exists():
            return 0
        # The normal manager forbids deletes; Django's collector also refuses PROTECT
        # parent/child families. One parameterized statement removes all siblings and
        # descendants together, satisfying their deferred self-FK without recursion.
        with connection.cursor() as cursor:
            cursor.execute(
                f"DELETE FROM {connection.ops.quote_name(TokenPair._meta.db_table)} "  # noqa: S608
                "WHERE session_id = %s",
                [session.pk],
            )
            return int(cursor.rowcount)


def prune_ended_token_pairs() -> PruneResult:
    """Delete at most MAX_SESSIONS_PER_RUN ended families, keeping their session audit rows.

    A single conservative cutoff applies to this run. Eligibility is re-evaluated from
    committed rows after acquiring each session lock, never from the candidate snapshot.
    """
    cutoff = server_now() - timedelta(days=settings.AUTH_TOKEN_PAIR_RETENTION_DAYS)
    candidates = list(
        _eligible_sessions(cutoff)
        .order_by("pk")
        .values_list("pk", flat=True)[:MAX_SESSIONS_PER_RUN]
    )
    sessions_pruned = pairs_deleted = 0
    for session_id in candidates:
        deleted = _prune_session(session_id, cutoff)
        sessions_pruned += int(deleted > 0)
        pairs_deleted += deleted
    result = PruneResult(sessions_pruned=sessions_pruned, pairs_deleted=pairs_deleted)
    log_auth_event(
        AuthEvent.TOKEN_PAIRS_PRUNED,
        AuditContext(),
        {"sessions_pruned": result.sessions_pruned, "pairs_deleted": result.pairs_deleted},
    )
    return result
