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

The quota counter is locked after the courier try-lock and any handler locks of that event,
inside the rejection savepoint. No later code takes a user/device/session row lock; see
accounts/README.md for the global order. A batch has one device and one receipt-local day.
Nothing here calls an external service: the view may hold the user and session locks of a final
upload for the whole batch.
"""

import hashlib
import logging
import math
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from functools import partial
from typing import Any, Self
from uuid import UUID
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, OperationalError, connection, transaction
from django.db.models import F
from rest_framework.exceptions import ValidationError

from core.validation import flatten_error_details
from field_sync.clock import ClockPolicy, build_clock_policy
from field_sync.codes import (
    EVENT_ID_CONFLICT,
    EVENT_PAYLOAD_TOO_LARGE,
    FINAL_UPLOAD_AFTER_REVOKE,
    INVALID_PAYLOAD,
    REJECTION_QUOTA_EXCEEDED,
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
    InvalidCursorError,
    SyncInProgressError,
)
from field_sync.models import (
    ACCEPTED_CODE,
    CourierChange,
    EventStatus,
    FieldEvent,
    RejectionQuotaCounter,
)
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.producers import get_producer, serialize_payload
from field_sync.registry import (
    EventContext,
    EventHandler,
    OrgScopedRequest,
    find_handler,
    run_envelope_checks,
)
from field_sync.selectors import (
    Changes,
    StoredEvent,
    build_bootstrap,
    build_changes,
    find_stored_event,
    latest_change_sequence,
    producer_context,
    scope_revision,
)
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


def rejection_quota_window(batch: BatchContext) -> tuple[date, int]:
    """Receipt-local day and seconds until its next midnight (ceil, at least one).

    Subtract UTC instants: local wall-clock subtraction is wrong on DST transition days.
    All events of a batch use its receipt time, so it cannot lock counters for two days.
    """
    local = batch.received_at.astimezone(ZoneInfo(batch.organization.timezone))
    midnight = datetime.combine(local.date() + timedelta(days=1), time.min, tzinfo=local.tzinfo)
    seconds = (midnight.astimezone(UTC) - batch.received_at.astimezone(UTC)).total_seconds()
    return local.date(), max(1, math.ceil(seconds))


def claim_rejection_slot(batch: BatchContext, local_date: date) -> bool:
    """Atomically increment the budget and schedule threshold logs (writes).

    Call only inside the rejection's savepoint: an id race must roll back the claim and its
    on-commit callbacks, just like a whole-batch rollback. The unique device/day index arbitrates
    concurrent row creation; the conditional UPDATE arbitrates concurrent slot claims.
    """
    limit = settings.SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY
    counter, _ = RejectionQuotaCounter.objects.get_or_create(
        organization=batch.organization, device=batch.device, local_date=local_date
    )
    claimed = RejectionQuotaCounter.objects.filter(pk=counter.pk, count__lt=limit).update(
        count=F("count") + 1
    )
    if not claimed:
        return False
    counter.refresh_from_db(fields=["count"])
    schedule_rejection_alerts(counter, limit)
    return True


def schedule_rejection_alerts(counter: RejectionQuotaCounter, limit: int) -> None:
    """Emit each configured crossing only after the transaction commits, without personal data."""
    for percent in settings.SYNC_REJECTION_ALERT_PERCENTS:
        if counter.count != math.ceil(limit * percent / 100):
            continue
        fields = {
            "organization": str(counter.organization_id),
            "device": str(counter.device_id),
            "local_date": counter.local_date.isoformat(),
            "count": counter.count,
            "limit": limit,
            "threshold_percent": percent,
        }
        transaction.on_commit(
            partial(
                logger.warning,
                "Rejection quota threshold: organization=%s device=%s local_date=%s count=%s limit=%s threshold_percent=%s",
                *fields.values(),
                extra=fields,
            )
        )


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
    if not connection.in_atomic_block:
        raise RuntimeError("Courier locks require an explicit transaction.")
    key = advisory_key("courier", batch.organization.pk, batch.user.pk)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [key])
        row = cursor.fetchone()
    if row is None or not row[0]:
        raise SyncInProgressError
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('field_sync.courier_locks', "
            "concat_ws(',', nullif(current_setting('field_sync.courier_locks', true), ''), %s), true)",
            [str(key)],
        )


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
            ctx = None if cursor is None else producer_context(batch, FIELD_EVENT_SYNC)
            if cursor is not None and ctx is not None:
                revision = scope_revision(ctx)
                if cursor.scope_revision is not None and cursor.scope_revision != revision:
                    raise InvalidCursorError
            results = ingest_batch(batch, envelopes)
            changes = (
                Changes() if cursor is None or ctx is None else build_changes(batch, cursor, ctx)
            )
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
            raise EventRejected(INVALID_PAYLOAD, rejection_params(error)) from None
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
        local_date, retry_after = rejection_quota_window(self.batch)
        try:
            with transaction.atomic():
                # A final upload happens once and cannot be retried: never refuse its evidence.
                if not self.batch.is_final_upload and not claim_rejection_slot(
                    self.batch, local_date
                ):
                    return self._quota_exceeded_result(envelope, retry_after)
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

    def _quota_exceeded_result(self, envelope: EventEnvelope, retry_after: int) -> EventResult:
        """Resolve an id stored while we waited for the last slot before refusing new storage."""
        stored = find_stored_event(envelope.id)
        if stored is not None:
            return self._replay(envelope, stored)
        return EventResult(
            envelope.id,
            EventStatus.REJECTED,
            REJECTION_QUOTA_EXCEEDED,
            {"retry_after_seconds": retry_after},
        )

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


def rejection_params(error: ValidationError) -> dict[str, Any]:
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


@dataclass(frozen=True)
class ChangeInput:
    kind: str
    resource_type: str
    resource_id: str
    resource_version: str
    scope: dict[str, str | None] | None
    action: str
    payload: dict[str, Any]


def require_courier_lock(batch: BatchContext) -> None:
    """Transaction-local marker: cannot outlive commit or savepoint rollback."""
    if not connection.in_atomic_block:
        raise RuntimeError("CourierChange append requires the courier transaction lock.")
    key = str(advisory_key("courier", batch.organization.pk, batch.user.pk))
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('field_sync.courier_locks', true)")
        row = cursor.fetchone()
    if row is None or key not in (row[0] or "").split(","):
        raise RuntimeError("CourierChange append requires the courier transaction lock.")


def _validate_change_scope(scope: dict[str, str | None] | None) -> None:
    if scope is None:
        return
    if set(scope) != {"center_id", "quadrant_id"}:
        raise ValueError("Change scope requires center_id and quadrant_id (null if inapplicable).")
    for identifier in scope.values():
        if identifier is not None and str(UUID(identifier)) != identifier:
            raise ValueError("Change scope identifiers must be canonical UUID strings.")


def append_courier_change(batch: BatchContext, change: ChangeInput) -> CourierChange:
    """Append a validated producer change; caller holds the lock through domain write + commit."""
    require_courier_lock(batch)
    producer = get_producer(change.kind)
    if change.action not in {"upsert", "remove"}:
        raise ValueError("Change action must be upsert or remove.")
    _validate_change_scope(change.scope)
    payload = serialize_payload(producer, change.payload) if change.action == "upsert" else {}
    return CourierChange.objects.create(
        organization=batch.organization,
        courier=batch.user,
        created_by=batch.user,
        sequence=latest_change_sequence(batch) + 1,
        kind=change.kind,
        resource_type=change.resource_type,
        resource_id=change.resource_id,
        resource_version=change.resource_version,
        scope=change.scope,
        action=change.action,
        payload=payload,
    )


def bootstrap_bundle(batch: BatchContext) -> dict[str, Any]:
    """Read bootstrap and its feed boundary in one try-locked transaction; no external I/O."""
    try:
        with transaction.atomic():
            lock_courier_batches(batch)
            set_batch_lock_timeout()
            return build_bootstrap(batch)
    except OperationalError as error:
        if getattr(error.__cause__, "sqlstate", None) in RETRYABLE_SQLSTATES:
            raise SyncInProgressError from None
        raise
