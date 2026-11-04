"""Sync batch ingest: idempotent, one savepoint per event, nothing stored half-way.

`sync_batch` is the whole use case, in one transaction:

1. A transaction advisory lock per (organization, user) is *tried*: if another batch of the same
   courier is running the request fails at once with `sync_in_progress` (429, `Retry-After`).
   Nothing waits, so a burst of retries cannot pile up workers or connections. With every batch of
   a courier serialized, the pull of `changes` inside the same transaction can use a strict
   keyset cursor (decision 71).
2. A blocking advisory lock per event id, taken in sorted order (short and ordered: no deadlock),
   so two couriers that share an id run one after the other and the second one finds the first's
   row (decision 72) instead of running its handler for nothing.
3. Events are processed in `(device_time, id)` order; results go back in request order. Per event:
   a stored event with the same id returns its stored result (or `event_id_conflict` when it
   belongs to another organization, device or user); otherwise the payload is validated, the
   handler applies the event and the `FieldEvent` is inserted, all in one savepoint. The primary
   key is still the final arbiter.
4. `EventRejected` rolls the savepoint back and the rejected event is stored in a second step with
   its `ReviewItem` (its payload only when the database can hold it, see `storable_payload`).
   Precedence: rejected, in review, accepted.

None of these locks are row locks, so the global row lock order (accounts/README.md) is untouched:
the user lock is a *try* (never waits) and the event-id locks wait only for short transactions.
Nothing here calls an external service: the view may hold the user and session locks of a final
upload for the whole batch.
"""

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any, Self

from django.conf import settings
from django.db import IntegrityError, connection, transaction
from rest_framework.exceptions import ValidationError

from core.validation import flatten_error_codes
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
from field_sync.registry import EventContext, EventHandler, OrgScopedRequest, find_handler
from field_sync.selectors import Changes, StoredEvent, build_changes, find_stored_event
from reviews.services import create_review_item

logger = logging.getLogger(__name__)


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


def lock_event_ids(envelopes: list[EventEnvelope]) -> None:
    """Wait for the lock of every event id of the batch, in one global sorted order."""
    keys = sorted({advisory_key("event", envelope.id) for envelope in envelopes})
    with connection.cursor() as cursor:
        for key in keys:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [key])


def sync_batch(
    batch: BatchContext, envelopes: list[EventEnvelope], cursor: ChangesCursor | None
) -> SyncOutcome:
    """Ingest a batch and pull the courier's changes in one locked transaction (writes).

    `cursor` None means "do not pull" (a revoked phone's final upload).
    """
    with transaction.atomic():
        lock_courier_batches(batch)
        lock_event_ids(envelopes)
        results = ingest_batch(batch, envelopes)
        changes = Changes() if cursor is None else build_changes(batch, cursor)
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
            handler, data = self._validate(envelope)
            return self._accept(envelope, handler, data)
        except EventRejected as rejection:
            return self._reject(envelope, rejection)

    # --- validation (no writes) -------------------------------------------------------------

    def _validate(self, envelope: EventEnvelope) -> tuple[EventHandler, dict[str, Any]]:
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
            codes = flatten_error_codes(error.get_codes())
            fields = {name: [item["code"] for item in items] for name, items in codes.items()}
            raise EventRejected(INVALID_PAYLOAD, {"fields": fields}) from None
        return handler, dict(serializer.validated_data)

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

    def _accept(
        self, envelope: EventEnvelope, handler: EventHandler, data: dict[str, Any]
    ) -> EventResult:
        try:
            with transaction.atomic():
                outcome = self._apply(envelope, handler, data)
                self._store(envelope, outcome)
        except IntegrityError as error:
            return self._replay_after_conflict(envelope, error)
        return outcome.result_for(envelope)

    def _apply(
        self, envelope: EventEnvelope, handler: EventHandler, data: dict[str, Any]
    ) -> Verdict:
        final_upload = self._final_upload_signal()
        clock = self.clock.review_signal(envelope.device_time)
        batch_signal = final_upload or clock
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
            handler.apply(context, data)
        except EventNeedsReview as needs_review:
            handler_signal = needs_review
        signal = final_upload or handler_signal or clock
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
