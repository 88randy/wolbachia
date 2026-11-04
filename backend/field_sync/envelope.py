"""Plain data of the sync pipeline: the parsed event, the per-event result, the batch context."""

import hashlib
import json
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from accounts.models import Device, User
from field_sync.models import ACCEPTED_CODE, EventStatus
from organizations.models import Organization

MAX_PAYLOAD_DEPTH = 32  # a payload is a flat-ish record; deeper only comes from abuse
NULL_CHARACTER_REPLACEMENT = "�"


@dataclass(frozen=True)
class GpsFix:
    lat: float
    lng: float
    accuracy_m: float


@dataclass(frozen=True)
class PayloadInfo:
    """Facts about the raw JSON payload, computed once when the envelope is built.

    A payload deeper than `MAX_PAYLOAD_DEPTH` is not serialized at all (`size_bytes` is 0 and
    `sha256` empty): the pipeline rejects it before anything needs them.
    """

    size_bytes: int
    sha256: str
    has_null_character: bool
    depth: int

    @property
    def is_too_deep(self) -> bool:
        return self.depth > MAX_PAYLOAD_DEPTH


def describe_payload(payload: dict[str, Any]) -> PayloadInfo:
    """Canonical size and SHA-256 of a payload, its nesting depth and whether it holds NUL.

    PostgreSQL's `jsonb` refuses `\\u0000` in strings, which would be a 500 that blocks the whole
    batch forever, so the pipeline rejects such an event up front instead. The walk is iterative:
    a hostile nesting depth cannot hit the recursion limit.
    """
    depth, has_null = _walk(payload)
    if depth > MAX_PAYLOAD_DEPTH:
        return PayloadInfo(0, "", has_null, depth)
    canonical = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return PayloadInfo(len(canonical), hashlib.sha256(canonical).hexdigest(), has_null, depth)


def _walk(root: object) -> tuple[int, bool]:
    """Nesting depth of a JSON document and whether any key or string holds a NUL character."""
    deepest, has_null = 0, False
    pending = [(root, 1)]
    while pending:
        current, depth = pending.pop()
        deepest = max(deepest, depth)
        if isinstance(current, str):
            has_null = has_null or "\x00" in current
        elif isinstance(current, dict):
            has_null = has_null or any("\x00" in key for key in _string_keys(current))
            pending.extend((value, depth + 1) for value in current.values())
        elif isinstance(current, list):
            pending.extend((item, depth + 1) for item in current)
    return deepest, has_null


def _string_keys(mapping: dict[Any, Any]) -> Iterator[str]:
    return (key for key in mapping if isinstance(key, str))


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
        """The payload as it is stored: exactly as received, except where the database cannot
        hold it (NUL characters become U+FFFD; a too deep payload becomes a marker). Both are
        rejected events, so nothing downstream reads them."""
        if self.payload_info.is_too_deep:
            return {"_not_stored": "payload_too_deep"}
        if self.payload_info.has_null_character:
            scrubbed: dict[str, Any] = _scrub_null_characters(self.payload)
            return scrubbed
        return self.payload


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
