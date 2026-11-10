"""Plain data of the sync pipeline: the parsed event, the per-event result, the batch context."""

import hashlib
import json
import math
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from django.conf import settings

from accounts.models import Device, User
from field_sync.codes import EVENT_PAYLOAD_TOO_LARGE, INVALID_PAYLOAD
from field_sync.models import ACCEPTED_CODE, EventStatus
from organizations.models import Organization

# Event and send times outside this range are a broken phone clock or abuse, never real work.
MIN_PLAUSIBLE_TIME = datetime(2020, 1, 1, tzinfo=UTC)
MAX_PLAUSIBLE_TIME = datetime(2100, 1, 1, tzinfo=UTC)
MAX_PAYLOAD_DEPTH = 32  # a payload is a flat-ish record; deeper only comes from abuse
NULL_CHARACTER_REPLACEMENT = "�"


@dataclass(frozen=True)
class GpsFix:
    lat: float
    lng: float
    accuracy_m: float | None


@dataclass(frozen=True)
class PayloadInfo:
    """Facts about the raw JSON payload, computed once when the envelope is built.

    A payload that is too deep or cannot be stored (a lone surrogate or a non-finite number)
    is not serialized at all: `size_bytes` is 0 and `sha256` empty, and the pipeline rejects it
    before anything needs them.
    """

    size_bytes: int
    sha256: str
    has_null_character: bool
    depth: int
    is_unstorable: bool = False

    @property
    def is_too_deep(self) -> bool:
        return self.depth > MAX_PAYLOAD_DEPTH


def describe_payload(payload: dict[str, Any]) -> PayloadInfo:
    """Canonical size and SHA-256 of a payload, its nesting depth and what the database cannot hold.

    PostgreSQL's `jsonb` refuses `\\u0000` in strings, and JSON cannot carry lone surrogates or
    non-finite numbers (`1e400`): each would be a 500 that blocks the whole batch forever, so the
    pipeline rejects such an event up front instead. The walk is iterative: a hostile nesting
    depth cannot hit the recursion limit.
    """
    walk = _walk(payload)
    if walk.depth > MAX_PAYLOAD_DEPTH or walk.is_unstorable:
        return PayloadInfo(0, "", walk.has_null, walk.depth, walk.is_unstorable)
    canonical = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    sha256 = hashlib.sha256(canonical).hexdigest()
    return PayloadInfo(len(canonical), sha256, walk.has_null, walk.depth)


@dataclass
class _Walk:
    depth: int = 0
    has_null: bool = False
    is_unstorable: bool = False

    def see_text(self, text: str) -> None:
        self.has_null = self.has_null or "\x00" in text
        if not self.is_unstorable:
            try:
                text.encode("utf-8")
            except UnicodeEncodeError:
                self.is_unstorable = True


def _walk(root: object) -> _Walk:
    """Depth of a JSON document, and whether a key or string holds NUL or a lone surrogate, or a
    number is not finite."""
    walk = _Walk()
    pending = [(root, 1)]
    while pending:
        current, depth = pending.pop()
        walk.depth = max(walk.depth, depth)
        if isinstance(current, str):
            walk.see_text(current)
        elif isinstance(current, float) and not math.isfinite(current):
            walk.is_unstorable = True
        elif isinstance(current, dict):
            for key in current:
                if isinstance(key, str):
                    walk.see_text(key)
            pending.extend((value, depth + 1) for value in current.values())
        elif isinstance(current, list):
            pending.extend((item, depth + 1) for item in current)
    return walk


@dataclass(frozen=True)
class EventEnvelope:
    """One event of the batch as the phone sent it, validated for shape (not for meaning).

    `index` is its position in the request: results are returned in request order even though
    events are processed in `(device_time, id)` order.
    """

    index: int
    id: uuid.UUID
    type: str
    schema_version: int
    device_time: datetime
    payload: dict[str, Any]
    payload_info: PayloadInfo
    rules_version: str
    catalog_version: str
    manual_capture: bool
    shift_id: uuid.UUID | None = None
    gps: GpsFix | None = None
    voids_event_id: uuid.UUID | None = None

    @property
    def storable_payload(self) -> dict[str, Any]:
        """The payload as it is stored (decision 74).

        Exactly as received, except where it must not or cannot be kept: a payload that is too
        large, too deep or not storable is replaced by a marker (`_not_stored`: the reason it was
        not kept, named with the result codes but not necessarily the one the phone got, since an
        earlier check can win; `size_bytes`: its size when it was measured), so a hostile phone cannot fill
        the table with rejected junk; NUL characters become U+FFFD. All of these are rejected
        events, so nothing downstream reads them.
        """
        info = self.payload_info
        if info.is_too_deep or info.is_unstorable:
            return {"_not_stored": INVALID_PAYLOAD, "size_bytes": None}
        if info.size_bytes > settings.SYNC_MAX_EVENT_PAYLOAD_BYTES:
            return {"_not_stored": EVENT_PAYLOAD_TOO_LARGE, "size_bytes": info.size_bytes}
        if info.has_null_character:
            scrubbed: dict[str, Any] = _scrub_null_characters(self.payload)
            return scrubbed
        return self.payload


def is_plausible_time(value: datetime) -> bool:
    return MIN_PLAUSIBLE_TIME <= value < MAX_PLAUSIBLE_TIME


def _scrub_null_characters(value: Any) -> Any:  # noqa: ANN401
    """Recursive on purpose: it only ever sees payloads within `MAX_PAYLOAD_DEPTH`."""
    if isinstance(value, str):
        return value.replace("\x00", NULL_CHARACTER_REPLACEMENT)
    if isinstance(value, dict):
        return {
            _scrub_null_characters(key): _scrub_null_characters(item) for key, item in value.items()
        }
    if isinstance(value, list):
        return [_scrub_null_characters(item) for item in value]
    return value


@dataclass(frozen=True)
class EventResult:
    """What the phone is told about one event: status plus a machine code and its parameters."""

    id: uuid.UUID
    status: EventStatus
    code: str = ACCEPTED_CODE
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class BatchContext:
    """Who sent the batch and when. `received_at` is the server clock when the request arrived."""

    organization: Organization
    user: User
    device: Device
    sent_at: datetime
    received_at: datetime
    is_final_upload: bool = False
    observed_session_id: uuid.UUID | None = None
    observed_pair_id: uuid.UUID | None = None
    publication_authenticated: bool = False


@dataclass(frozen=True)
class CourierContext:
    """Feed ownership and locking need no fabricated device for web-origin writes."""

    organization: Organization
    user: User
