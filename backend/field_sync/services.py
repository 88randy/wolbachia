"""Sync batch ingest: idempotent, one savepoint per event, nothing stored half-way.

Order of work for a batch (`ingest_batch`), all in one transaction:

1. An advisory lock serializes the batches of one device (not a row lock: see
   `lock_device_batches`).
2. Events are processed in `(device_time, id)` order; results go back in request order.
3. Per event: a stored event with the same id returns its stored result (or
   `event_id_conflict` when it belongs to another organization, device or user); otherwise the
   payload is validated, the handler applies the event and the `FieldEvent` is inserted, all in
   one savepoint. The primary key arbitrates a race: the loser's INSERT fails, its savepoint
   (domain writes included) rolls back and it returns the winner's result.
4. `EventRejected` rolls the savepoint back and the rejected event is stored in a second step,
   with its raw payload and its `ReviewItem`. Precedence: rejected, in review, accepted.

Nothing here calls an external service: the view may hold the user and session locks of a
final upload for the whole batch (accounts/README.md, "For #5").
"""

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any, Self

from django.conf import settings
from django.db import IntegrityError, connection, transaction
from rest_framework.exceptions import ValidationError

from accounts.models import Device
from core.exception_handler import flatten_error_codes
from field_sync.clock import ClockPolicy, build_clock_policy
from field_sync.codes import (
    EVENT_ID_CONFLICT,
    EVENT_PAYLOAD_TOO_LARGE,
    FINAL_UPLOAD_AFTER_REVOKE,
    INVALID_PAYLOAD,
    VOID_EVENT_TYPE,
)
from field_sync.envelope import BatchContext, EventEnvelope, EventResult
from field_sync.exceptions import EventNeedsReview, EventOutcome, EventRejected
from field_sync.models import ACCEPTED_CODE, EventStatus, FieldEvent
from field_sync.registry import EventContext, EventHandler, OrgScopedRequest, find_handler
from field_sync.selectors import StoredEvent, find_stored_event
from reviews.services import create_review_item

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Outcome:
    """The final status of one event: what is stored and what the phone is told."""

    status: EventStatus
    code: str = ACCEPTED_CODE
    params: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_signal(cls, status: EventStatus, signal: EventOutcome) -> Self:
        return cls(status, signal.code, signal.params)

    def result_for(self, event: EventEnvelope) -> EventResult:
        return EventResult(event.id, self.status, self.code, self.params)


def lock_device_batches(device: Device) -> None:
    """Make concurrent batches of one device run one after the other (waits; no writes).

    A PostgreSQL advisory transaction lock, released at commit or rollback. It is not a row lock
    on purpose: a final upload already holds the `DeviceSession` lock, and taking the `Device`
    row after it would run against the global lock order (User, Device, DeviceSession), while the
    row lock would also block the device bookkeeping that authentication does on every request.
    A hash collision between two devices only serializes them, it never breaks anything.
    """
    digest = hashlib.sha256(f"field_sync:{device.pk}".encode()).digest()
    key = int.from_bytes(digest[:8], "big", signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [key])


def ingest_batch(batch: BatchContext, envelopes: list[EventEnvelope]) -> list[EventResult]:
    """Apply the events of one batch (writes FieldEvent, ReviewItem and whatever handlers write).

    Returns one result per event in request order. Runs in its own transaction (a savepoint
    when the caller already has one, as in a final upload).
    """
    with transaction.atomic():
        lock_device_batches(batch.device)
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
        if info.size_bytes > settings.SYNC_MAX_EVENT_PAYLOAD_BYTES:
            raise EventRejected(
                EVENT_PAYLOAD_TOO_LARGE, {"max_bytes": settings.SYNC_MAX_EVENT_PAYLOAD_BYTES}
            )
        if info.has_null_character:
            raise EventRejected(INVALID_PAYLOAD, {"fields": {"payload": ["null_character"]}})
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
    ) -> Outcome:
        batch_signal = self._final_upload_signal() or self.clock.review_signal(envelope.device_time)
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
        signal = self._final_upload_signal() or handler_signal or batch_signal
        if signal is None:
            return Outcome(EventStatus.ACCEPTED)
        return Outcome.from_signal(EventStatus.IN_REVIEW, signal)

    def _final_upload_signal(self) -> EventNeedsReview | None:
        if not self.batch.is_final_upload:
            return None
        return EventNeedsReview(FINAL_UPLOAD_AFTER_REVOKE)

    # --- rejected events --------------------------------------------------------------------

    def _reject(self, envelope: EventEnvelope, rejection: EventRejected) -> EventResult:
        outcome = Outcome.from_signal(EventStatus.REJECTED, rejection)
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

    def _store(self, envelope: EventEnvelope, outcome: Outcome) -> None:
        """Insert the event and, unless it is plainly accepted, its review item (writes both)."""
        event = FieldEvent.objects.create(**self._event_fields(envelope, outcome))
        if outcome.status != EventStatus.ACCEPTED:
            create_review_item(event)

    def _event_fields(self, envelope: EventEnvelope, outcome: Outcome) -> dict[str, Any]:
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
