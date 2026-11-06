"""The event handler registry: how each epic teaches `/field/sync/` its event types.

An epic registers one `EventHandler` per `(event_type, schema_version)` from its
`AppConfig.ready()`::

    def ready(self) -> None:
        from field_sync.registry import EventHandler, register
        register(EventHandler("ovitrap.check", 1, OvitrapCheckPayload, apply_ovitrap_check))

Registering the same pair twice raises `ImproperlyConfigured`. The pipeline (`services.py`)
validates the payload with the handler's serializer, then calls `apply(ctx, data)` inside a
savepoint: a normal return means accepted, `EventRejected` rolls every write back and stores the
event `rejected`, `EventNeedsReview` rolls operational writes back and stores the immutable
source `in_review` with its original observations. A handler must
write only through the connection of the current transaction and call no external service (the
view holds row locks for the whole batch). See `docs/sync.md`.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any

from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers

from accounts.models import Device, User
from field_sync.codes import UNSUPPORTED_EVENT_TYPE, UNSUPPORTED_SCHEMA_VERSION
from field_sync.envelope import EventEnvelope
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from organizations.models import Organization
from rules.selectors import get_values_in_force

if TYPE_CHECKING:
    from reviews.contracts import ReviewAdapter, ReviewAuthorization


@dataclass(frozen=True)
class EventContext:
    """What a handler may use. `review_code` is set when the event will land `in_review` anyway
    (final upload, clock skew). Operational writes roll back; copied original observations remain."""

    organization: Organization
    user: User
    device: Device
    envelope: EventEnvelope
    server_received_at: datetime
    review_code: str | None = None
    review_authorization: ReviewAuthorization | None = None
    observed_facts: dict[str, Any] = field(default_factory=dict, compare=False)

    def acknowledges(self, code: str) -> bool:
        return self.review_authorization is not None and self.review_authorization.acknowledges(
            self, code
        )

    def rules_at(self, at: datetime) -> dict[str, int | float | None]:
        """The rule parameter values in force at `at` (usually the event's `device_time`).

        Lazy: nothing is queried unless a handler asks. `None` means "not configured".
        """
        return get_values_in_force(self.organization, at)


@dataclass(frozen=True)
class OrgScopedRequest:
    """Stand-in for `serializer.context["request"]`: it is all `OrgScopedPrimaryKeyRelatedField`
    reads, so payload serializers can use org-scoped relations without a real HTTP request."""

    organization: Organization


type ApplyEvent = Callable[[EventContext, dict[str, Any]], None]
type VoidHook = Callable[[EventContext, FieldEvent], None]


@dataclass(frozen=True)
class EventHandler:
    """One event type at one schema version.

    `codes` lists every result code the handler may raise (`EventRejected` / `EventNeedsReview`):
    the registry contract test requires each one in `docs/sync.md` and in both i18n locales.
    `payload_serializer` validates `payload` (it receives `context["request"]` with the
    organization). `on_void` runs when a `record.void` voids an event of this type, inside the
    same savepoint; it may raise `EventRejected` to refuse the void. `checks_shift` (default
    True): the pipeline runs the registered envelope checks on the event (`shifts` registers one that
    validates its `shift_id`: the shift must exist, be the sender's and not be closed before the
    event); only the shift events and `record.void` opt out.
    """

    event_type: str
    schema_version: int
    payload_serializer: type[serializers.Serializer[Any]]
    apply: ApplyEvent
    on_void: VoidHook | None = None
    codes: tuple[str, ...] = ()
    checks_shift: bool = True
    review_adapter: ReviewAdapter | None = None


HANDLERS: dict[tuple[str, int], EventHandler] = {}


def register(handler: EventHandler) -> None:
    """Register a handler (writes the process-wide registry). Call from `AppConfig.ready()`."""
    key = (handler.event_type, handler.schema_version)
    if key in HANDLERS:
        raise ImproperlyConfigured(
            f"An event handler for {handler.event_type!r} v{handler.schema_version} is already "
            "registered."
        )
    HANDLERS[key] = handler


type EnvelopeCheck = Callable[[Organization, User, EventEnvelope], EventNeedsReview | None]

ENVELOPE_CHECKS: list[EnvelopeCheck] = []


def register_envelope_check(check: EnvelopeCheck) -> None:
    """Register a check the pipeline runs on every event whose handler has `checks_shift=True`,
    after the payload is valid and before it is applied (writes the process-wide registry; call
    it from `AppConfig.ready()`). It reads (no writes), may raise `EventRejected` and may return an
    `EventNeedsReview` that retains the source for review without operational effects. With none registered
    the pipeline checks nothing. `shifts` uses it for the `shift_id` of events, so `field_sync`
    does not import `shifts`."""
    if check in ENVELOPE_CHECKS:
        raise ImproperlyConfigured(f"The envelope check {check.__name__!r} is already registered.")
    ENVELOPE_CHECKS.append(check)


def run_envelope_checks(
    organization: Organization, user: User, envelope: EventEnvelope
) -> EventNeedsReview | None:
    """Run every registered check, in order (reads). A rejection raised by any check wins over a
    review signal returned by an earlier one (rejected over in review); otherwise the first review
    signal is returned."""
    signal: EventNeedsReview | None = None
    for check in ENVELOPE_CHECKS:
        result = check(organization, user, envelope)
        signal = signal or result
    return signal


def get_handler(event_type: str, schema_version: int) -> EventHandler | None:
    """The registered handler for the pair, or None."""
    return HANDLERS.get((event_type, schema_version))


def find_handler(event_type: str, schema_version: int) -> EventHandler:
    """The handler for the pair, or `EventRejected` with the right code and `{type, schema_version}`."""
    handler = get_handler(event_type, schema_version)
    if handler is not None:
        return handler
    known_type = any(registered_type == event_type for registered_type, _ in HANDLERS)
    code = UNSUPPORTED_SCHEMA_VERSION if known_type else UNSUPPORTED_EVENT_TYPE
    raise EventRejected(code, {"type": event_type, "schema_version": schema_version})
