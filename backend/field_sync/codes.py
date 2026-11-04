"""The machine codes of per-event results (`results[].code`). One list, documented in docs/sync.md.

The phone translates each code with `packages/i18n` (keys `sync.result.*`); the API never
returns user-facing text. `ACCEPTED_CODE` lives in `models` because it is stored on events.
"""

from field_sync.models import EventStatus

VOID_EVENT_TYPE = "record.void"

UNSUPPORTED_EVENT_TYPE = "unsupported_event_type"
UNSUPPORTED_SCHEMA_VERSION = "unsupported_schema_version"
INVALID_PAYLOAD = "invalid_payload"
EVENT_PAYLOAD_TOO_LARGE = "event_payload_too_large"
EVENT_ID_CONFLICT = "event_id_conflict"
VOID_TARGET_NOT_FOUND = "void_target_not_found"
VOID_TARGET_NOT_OWNED = "void_target_not_owned"
ALREADY_VOIDED = "already_voided"
CLOCK_SKEW = "clock_skew"
FINAL_UPLOAD_AFTER_REVOKE = "final_upload_after_revoke"

REJECTED_CODES = (
    UNSUPPORTED_EVENT_TYPE,
    UNSUPPORTED_SCHEMA_VERSION,
    INVALID_PAYLOAD,
    EVENT_PAYLOAD_TOO_LARGE,
    EVENT_ID_CONFLICT,
    VOID_TARGET_NOT_FOUND,
    VOID_TARGET_NOT_OWNED,
    ALREADY_VOIDED,
)
IN_REVIEW_CODES = (CLOCK_SKEW, FINAL_UPLOAD_AFTER_REVOKE)
STATUS_BY_CODE = {
    **dict.fromkeys(REJECTED_CODES, EventStatus.REJECTED),
    **dict.fromkeys(IN_REVIEW_CODES, EventStatus.IN_REVIEW),
}
