"""Sync batch ingest: idempotent, one savepoint per event, nothing stored half-way.

`sync_batch` is the whole use case, in one transaction:

1. A transaction advisory lock per (organization, user) is *tried*: if another batch of the same
   courier is running the request fails at once with `sync_in_progress` (429, `Retry-After`).
   Nothing waits, so a burst of retries cannot pile up workers or connections. With every batch of
   a courier serialized, the pull of `changes` inside the same transaction can use a strict
   keyset cursor (decision 71).
2. `SET LOCAL lock_timeout` for the whole transaction: a lock wait that takes too long
   (`55P03`), or a deadlock with another courier's batch over a shared event id (`40P01`), is
   also `429 sync_in_progress` (decision 72). There are no per-id locks: shared ids are arbitrated
   by the primary key and the savepoint, as for any duplicate.
3. Events are processed in `(device_time, id)` order; results go back in request order. Per event:
   a stored event with the same id returns its stored result (or `event_id_conflict` when it
   belongs to another organization, device or user); otherwise the payload is validated, the
   handler applies the event and the `FieldEvent` is inserted, all in one savepoint. The primary
   key is still the final arbiter.
4. `EventRejected` rolls the savepoint back and the rejected event is stored in a second step with
   its `ReviewItem` (its payload only when the database can hold it, see `storable_payload`).
   Precedence: rejected, in review, accepted.

The advisory lock is not a row lock and is a *try* (never waits), so the global row lock order
(accounts/README.md) is untouched.
Nothing here calls an external service: the view may hold the user and session locks of a final
upload for the whole batch.
"""

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any, Self

from django.conf import settings
from django.db import IntegrityError, OperationalError, connection, transaction
from rest_framework.exceptions import ValidationError

from core.validation import flatten_error_details
from field_sync.clock import ClockPolicy, build_clock_policy
from field_sync.codes import (
    EVENT_ID_CONFLICT,
    EVENT_PAYLOAD_TOO_LARGE,
    FINAL_UPLOAD_AFTER_REVOKE,
    INVALID_PAYLOAD,
    VOID_EVENT_TYPE,
)
from field_sync.cursor import ChangesCursor
from field_sync.envelope import (
    BatchContext,
    EventEnvelope,
    EventResult,
    is_plausible_time,
)
from field_sync.exceptions import (
    EventNeedsReview,
    EventRejected,
    EventSignal,
    SyncInProgressError,
)
from field_sync.models import ACCEPTED_CODE, EventStatus, FieldEvent
from field_sync.registry import (
    EventContext,
    EventHandler,
    OrgScopedRequest,
    find_handler,
    run_envelope_checks,
)
from field_sync.selectors import Changes, StoredEvent, build_changes, find_stored_event
from reviews.services import create_review_item

logger = logging.getLogger(__name__)

# PostgreSQL `lock_not_available` (lock_timeout expired) and `deadlock_detected`.
RETRYABLE_SQLSTATES = frozenset({"55P03", "40P01"})


@dataclass(frozen=True)
class Verdict:
    """The final status of one event: what is stored and what the phone is told."""

    status: EventStatus
    code: str = ACCEPTED_CODE
    params: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_signal(cls, status: EventStatus, signal: EventSignal) -> Self:
        return cls(status, signal.code, signal.params)

    def result_for(self, event: EventEnvelope) -> EventResult:
        return EventResult(event.id, self.status, self.code, self.params)


@dataclass(frozen=True)
class PreparedEvent:
    """A validated event ready to apply: its handler, its payload and the review signal of the
    shift it names (an event captured after the shift closed), if any."""

    handler: EventHandler
    data: dict[str, Any]
    shift_signal: EventNeedsReview | None = None


@dataclass(frozen=True)
class SyncOutcome:
    results: list[EventResult]
    changes: Changes


def advisory_key(*parts: object) -> int:
    """A stable signed 64-bit key for `pg_advisory_*lock` from named parts (a hash: a collision
    only makes two unrelated things wait for each other, it never breaks anything)."""
    digest = hashlib.sha256(":".join(["field_sync", *map(str, parts)]).encode()).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


def lock_courier_batches(batch: BatchContext) -> None:
    """Take the (organization, user) batch lock or raise `SyncInProgressError` (never waits).

    A PostgreSQL advisory transaction lock, released at commit or rollback. It is not a row
    lock on purpose (a final upload already holds the `DeviceSession` row; see accounts/README.md).
    """
    key = advisory_key("courier", batch.organization.pk, batch.user.pk)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [key])
        row = cursor.fetchone()
    if row is None or not row[0]:
        raise SyncInProgressError


def set_batch_lock_timeout() -> None:
    """Cap how long any lock wait of this transaction may last (`SYNC_LOCK_TIMEOUT_MS`).

    `SET LOCAL` semantics (`is_local`): it lasts until the transaction ends and is rolled back
    with it, so it never leaks to another request. It covers every wait of the batch: a primary key
    insert blocked by another batch that shares an event id, a row lock on a void target...
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('lock_timeout', %s, true)", [f"{settings.SYNC_LOCK_TIMEOUT_MS}ms"]
        )


def check_deferred_constraints_now() -> None:
    """Run the deferred foreign key checks here, inside `sync_batch`'s error mapping
    (`connection.check_constraints()`: Django's own `SET CONSTRAINTS ALL IMMEDIATE` then
    `ALL DEFERRED` on PostgreSQL).

    Django's foreign keys are checked at commit. In a final upload this block is only a savepoint
    and the real commit is the mixin's, outside the `try`: a lock wait (`55P03`) on a referenced
    row (say a `Device` held by a concurrent login) would surface there as a 500. Checking now
    keeps every wait of the batch under the timeout and the 429 mapping.

    Constraints go back to deferred right after the check: `SET CONSTRAINTS` lasts until the
    transaction ends, and domain rows that point at a `FieldEvent` before the pipeline inserts it
    (`Shift.opened_event`) rely on the deferral for the next event or batch of the same transaction.
    """
    connection.check_constraints()


def sync_batch(
    batch: BatchContext, envelopes: list[EventEnvelope], cursor: ChangesCursor | None
) -> SyncOutcome:
    """Ingest a batch and pull the courier's changes in one locked transaction (writes).

    `cursor` None means "do not pull" (a revoked phone's final upload). A lock wait that exceeds
    the timeout (`55P03`) or a deadlock with another courier's batch over a shared event id
    (`40P01`) is `429 sync_in_progress`: the transaction rolls back (a final upload is given
    back) and the phone retries the same batch, which event ids make safe (decision 72).
    """
    try:
        with transaction.atomic():
            lock_courier_batches(batch)
            set_batch_lock_timeout()
            results = ingest_batch(batch, envelopes)
            changes = Changes() if cursor is None else build_changes(batch, cursor)
            check_deferred_constraints_now()
    except OperationalError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from None
        raise
    return SyncOutcome(results, changes)


def ingest_batch(batch: BatchContext, envelopes: list[EventEnvelope]) -> list[EventResult]:
    """Apply the events of one batch (writes FieldEvent, ReviewItem and whatever handlers write).

    Returns one result per event in request order. Call it inside `sync_batch`'s transaction.
    """
    processor = EventProcessor(batch, build_clock_policy(batch))
    by_index = {
        envelope.index: processor.process(envelope)
        for envelope in sorted(envelopes, key=lambda item: (item.device_time, item.id))
    }
    return [by_index[index] for index in range(len(envelopes))]


class EventProcessor:
    """Processes the events of one batch (one instance per batch; it keeps no event state)."""

    def __init__(self, batch: BatchContext, clock: ClockPolicy) -> None:
        self.batch = batch
        self.clock = clock

    def process(self, envelope: EventEnvelope) -> EventResult:
        stored = find_stored_event(envelope.id)
        if stored is not None:
            return self._replay(envelope, stored)
        try:
            prepared = self._validate(envelope)
            return self._accept(envelope, prepared)
        except EventRejected as rejection:
            return self._reject(envelope, rejection)

    # --- validation (no writes) -------------------------------------------------------------

    def _validate(self, envelope: EventEnvelope) -> PreparedEvent:
        handler = find_handler(envelope.type, envelope.schema_version)
        self._check_envelope(envelope)
        organization = self.batch.organization
        serializer = handler.payload_serializer(
            data=envelope.payload,
            context={"request": OrgScopedRequest(organization), "organization": organization},
        )
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as error:
            raise EventRejected(INVALID_PAYLOAD, _rejection_params(error)) from None
        shift_signal = (
            run_envelope_checks(organization, self.batch.user, envelope)
            if handler.checks_shift
            else None
        )
        return PreparedEvent(handler, dict(serializer.validated_data), shift_signal)

    @staticmethod
    def _check_envelope(envelope: EventEnvelope) -> None:
        info = envelope.payload_info
        if info.is_too_deep:
            raise EventRejected(INVALID_PAYLOAD, {"fields": {"payload": ["too_deep"]}})
        if info.is_unstorable:
            raise EventRejected(INVALID_PAYLOAD, {"fields": {"payload": ["not_storable"]}})
        if info.size_bytes > settings.SYNC_MAX_EVENT_PAYLOAD_BYTES:
            raise EventRejected(
                EVENT_PAYLOAD_TOO_LARGE, {"max_bytes": settings.SYNC_MAX_EVENT_PAYLOAD_BYTES}
            )
        if info.has_null_character:
            raise EventRejected(INVALID_PAYLOAD, {"fields": {"payload": ["null_character"]}})
        if not is_plausible_time(envelope.device_time):
            raise EventRejected(INVALID_PAYLOAD, {"fields": {"device_time": ["out_of_range"]}})
        if envelope.voids_event_id is not None and envelope.type != VOID_EVENT_TYPE:
            raise EventRejected(INVALID_PAYLOAD, {"fields": {"voids_event_id": ["not_allowed"]}})

    # --- accepted and in-review events ------------------------------------------------------

    def _accept(self, envelope: EventEnvelope, prepared: PreparedEvent) -> EventResult:
        try:
            with transaction.atomic():
                outcome = self._apply(envelope, prepared)
                self._store(envelope, outcome)
        except IntegrityError as error:
            return self._replay_after_conflict(envelope, error)
        return outcome.result_for(envelope)

    def _apply(self, envelope: EventEnvelope, prepared: PreparedEvent) -> Verdict:
        final_upload = self._final_upload_signal()
        clock = self.clock.review_signal(envelope.device_time)
        batch_signal = final_upload or prepared.shift_signal or clock
        context = EventContext(
            organization=self.batch.organization,
            user=self.batch.user,
            device=self.batch.device,
            envelope=envelope,
            server_received_at=self.batch.received_at,
            review_code=None if batch_signal is None else batch_signal.code,
        )
        handler_signal: EventNeedsReview | None = None
        try:
            prepared.handler.apply(context, prepared.data)
        except EventNeedsReview as needs_review:
            handler_signal = needs_review
        signal = final_upload or handler_signal or prepared.shift_signal or clock
        if signal is None:
            return Verdict(EventStatus.ACCEPTED)
        return Verdict.from_signal(EventStatus.IN_REVIEW, signal)

    def _final_upload_signal(self) -> EventNeedsReview | None:
        if not self.batch.is_final_upload:
            return None
        return EventNeedsReview(FINAL_UPLOAD_AFTER_REVOKE)

    # --- rejected events --------------------------------------------------------------------

    def _reject(self, envelope: EventEnvelope, rejection: EventRejected) -> EventResult:
        params = dict(rejection.params)
        if envelope.voids_event_id is not None:
            params["voids_event_id"] = str(envelope.voids_event_id)  # the link is not stored
        outcome = Verdict(EventStatus.REJECTED, rejection.code, params)
        try:
            with transaction.atomic():
                self._store(envelope, outcome)
        except IntegrityError as error:
            return self._replay_after_conflict(envelope, error)
        logger.info(
            "Event rejected: organization=%s user=%s device=%s event=%s code=%s",
            self.batch.organization.pk,
            self.batch.user.pk,
            self.batch.device.pk,
            envelope.id,
            outcome.code,
        )
        return outcome.result_for(envelope)

    # --- storing ----------------------------------------------------------------------------

    def _store(self, envelope: EventEnvelope, outcome: Verdict) -> None:
        """Insert the event and, unless it is plainly accepted, its review item (writes both)."""
        event = FieldEvent.objects.create(**self._event_fields(envelope, outcome))
        if outcome.status != EventStatus.ACCEPTED:
            create_review_item(event)

    def _event_fields(self, envelope: EventEnvelope, outcome: Verdict) -> dict[str, Any]:
        batch, gps = self.batch, envelope.gps
        # A rejected void may point at an id that does not exist (or is not ours): only a
        # verified target is linked, so the foreign key can never fail at commit.
        is_rejected = outcome.status == EventStatus.REJECTED
        return {
            "id": envelope.id,
            "organization": batch.organization,
            "created_by": batch.user,
            "device": batch.device,
            "type": envelope.type,
            "schema_version": envelope.schema_version,
            "payload": envelope.storable_payload,
            "payload_sha256": envelope.payload_info.sha256,
            "shift_id": envelope.shift_id,
            "device_time": envelope.device_time,
            "server_received_at": batch.received_at,
            "clock_skew_seconds": self.clock.skew_seconds,
            "gps_lat": None if gps is None else gps.lat,
            "gps_lng": None if gps is None else gps.lng,
            "gps_accuracy_m": None if gps is None else gps.accuracy_m,
            "rules_version": envelope.rules_version,
            "catalog_version": envelope.catalog_version,
            "manual_capture": envelope.manual_capture,
            "voids_event_id": None if is_rejected else envelope.voids_event_id,
            "status": outcome.status,
            "status_code": outcome.code,
            "status_params": outcome.params,
            "is_final_upload": batch.is_final_upload,
        }

    # --- idempotency ------------------------------------------------------------------------

    def _replay(self, envelope: EventEnvelope, stored: StoredEvent) -> EventResult:
        """The answer for an id that is already stored: the same result, or a conflict."""
        batch = self.batch
        owner = (stored.organization_id, stored.device_id, stored.created_by_id)
        if owner != (batch.organization.pk, batch.device.pk, batch.user.pk):
            logger.warning(
                "Event id conflict: event=%s organization=%s device=%s",
                envelope.id,
                batch.organization.pk,
                batch.device.pk,
            )
            return EventResult(envelope.id, EventStatus.REJECTED, EVENT_ID_CONFLICT)
        if stored.payload_sha256 != envelope.payload_info.sha256:
            logger.warning(
                "Event id reused with other content: event=%s organization=%s device=%s",
                envelope.id,
                batch.organization.pk,
                batch.device.pk,
            )
        return EventResult(
            envelope.id, EventStatus(stored.status), stored.status_code, stored.status_params
        )

    def _replay_after_conflict(self, envelope: EventEnvelope, error: IntegrityError) -> EventResult:
        """A savepoint failed on the primary key: another batch stored this id first.

        Anything that is not a duplicate id is a real integrity problem and is raised again.
        """
        stored = find_stored_event(envelope.id)
        if stored is None:
            raise error
        return self._replay(envelope, stored)


def _rejection_params(error: ValidationError) -> dict[str, Any]:
    """`{"fields": {name: [code]}}`, plus `field_params: {name: {code: params}}` when a code
    carries params (the phone needs `min_length` of `void_reason_too_short`)."""
    flat = flatten_error_details(error.get_full_details())
    params: dict[str, Any] = {
        "fields": {n: [i["code"] for i in items] for n, items in flat.items()}
    }
    carried = {
        name: {item["code"]: item["params"] for item in items if item["params"]}
        for name, items in flat.items()
    }
    carried = {name: codes for name, codes in carried.items() if codes}
    if carried:
        params["field_params"] = carried
    return params
