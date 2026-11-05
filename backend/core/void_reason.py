"""The one place that decides whether a void reason is acceptable (issue #32).

Every void path goes through it: `POST .../void/` (`VoidSerializer`), the phone's `record.void`
event and `core.services.void_record` itself. The organization catalog selects the reason;
only Other requires the visible-character minimum (#80).
Errors carry a machine code and params, never user-facing text.

What counts as a character is decided here once (the web mirrors it in `count-characters.ts`):
invisible text (zero-width, combining marks, spaces, filler glyphs) never reaches the minimum.
"""

import unicodedata
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import connection
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from catalogs.models import CatalogItem
from core.models import OTHER_ITEM_CODE
from core.validation import params_message

VOID_REASON_MAX_LENGTH = 1000
VOID_REASON_TOO_SHORT = "void_reason_too_short"
VOID_REASON_INVALID_CHARACTERS = "void_reason_invalid_characters"
MAX_LENGTH_CODE = "max_length"
VOID_REASON_CATALOG_SLUG = "void-reason"
VOID_REASON_CODE_UNKNOWN = "void_reason_code_unknown"
VOID_REASON_REQUIRED_FOR_OTHER = "void_reason_required_for_other"

# Text that shows nothing: format (zero-width, joiners), combining marks, every space and line
# separator, private-use and unassigned code points (no font draws them). They are not trimmed away, only ignored for the minimum.
_INVISIBLE_CATEGORIES = frozenset({"Cf", "Mn", "Me", "Zs", "Zl", "Zp", "Co", "Cn"})
# Letters that render as blanks (Hangul fillers, braille blank).
_FILLERS = frozenset({0x115F, 0x1160, 0x3164, 0xFFA0, 0x2800})
# Bidirectional controls: embeddings, overrides and isolates can reorder text to hide it.
_BIDI_CONTROLS = frozenset({*range(0x202A, 0x202F), *range(0x2066, 0x206A)})
_ALLOWED_CONTROLS = frozenset({"\n"})


def void_reason_min_length() -> int:
    """Minimum visible characters (`VOID_REASON_MIN_LENGTH`, default 10), read per call.

    Kept between 1 (a reason is always required) and the maximum, so a bad setting cannot make
    every void impossible.
    """
    return min(max(1, int(settings.VOID_REASON_MIN_LENGTH)), VOID_REASON_MAX_LENGTH)


def _has_forbidden_characters(text: str) -> bool:
    for character in text:
        if ord(character) in _BIDI_CONTROLS:
            return True
        category = unicodedata.category(character)
        if category == "Cs" or (category == "Cc" and character not in _ALLOWED_CONTROLS):
            return True
    return False


def visible_length(text: str) -> int:
    """Characters that show something: whitespace (line feeds too), invisible text and filler
    glyphs are not counted."""
    return sum(
        1
        for character in text
        if unicodedata.category(character) not in _INVISIBLE_CATEGORIES
        and ord(character) not in _FILLERS
        and not character.isspace()  # a line feed is allowed in the text but shows nothing
    )


def _refusal(code: str, params: dict[str, Any], field: str | None) -> serializers.ValidationError:
    detail = [ErrorDetail(params_message(params), code=code)]
    return serializers.ValidationError({field: detail} if field else detail)


def validate_void_reason(
    reason: str, field: str | None = None, *, enforce_minimum: bool = True
) -> str:
    """Normalize (NFC, CRLF as LF) and trim `reason`; returns the text to store.

    Raises a DRF `ValidationError` (400 `validation_error`; the error handler keeps its `params`)
    with one of: `void_reason_invalid_characters` (control or bidi characters),
    `void_reason_too_short` with `{min_length}` (a blank reason too), `max_length` with
    `{max_length}`. `field` names the field when the error is raised outside a serializer.
    """
    cleaned = unicodedata.normalize("NFC", reason.replace("\r\n", "\n")).strip()
    if _has_forbidden_characters(cleaned):
        raise _refusal(VOID_REASON_INVALID_CHARACTERS, {}, field)
    minimum = void_reason_min_length()
    if enforce_minimum and visible_length(cleaned) < minimum:
        raise _refusal(VOID_REASON_TOO_SHORT, {"min_length": minimum}, field)
    if len(cleaned) > VOID_REASON_MAX_LENGTH:
        raise _refusal(MAX_LENGTH_CODE, {"max_length": VOID_REASON_MAX_LENGTH}, field)
    return cleaned


@dataclass(frozen=True)
class ResolvedVoidReason:
    organization_id: UUID
    code: str
    reason: str
    is_active: bool


def resolve_void_reason(  # noqa: PLR0913 -- the public void contract plus sync policy
    organization_id: UUID, reason: str, reason_code: str, *, allow_inactive: bool = False
) -> ResolvedVoidReason:
    """Lock the catalog item in the target's organization, then normalize the note.

    Requires the caller's active transaction to span resolution and the target write. Lock
    order everywhere: catalog item row, then target row. The item is locked with
    select_for_update(no_key=True, of=("self",)) before any target row lock, so deactivation
    cannot change is_active between resolution and writing. _set_item_active locks the item
    but no targets, so there is no cycle. An atomic block only inside this resolver would
    release the lock too early and reintroduce the snapshot race.

    Sync may inspect an inactive choice for review, but invalid text is always refused first.
    Unknown, foreign and missing catalogs share one error without echoing user input.
    """
    if not connection.in_atomic_block:
        raise RuntimeError("resolve_void_reason requires an active transaction spanning the void.")
    if not reason_code.strip():
        raise _refusal("required", {}, "reason_code")
    item = (
        CatalogItem.objects.filter(
            organization_id=organization_id,
            catalog__organization_id=organization_id,
            catalog__slug=VOID_REASON_CATALOG_SLUG,
            code=reason_code,
        )
        .select_for_update(no_key=True, of=("self",))
        .first()
    )
    if item is None or (not item.is_active and not allow_inactive):
        raise _refusal(VOID_REASON_CODE_UNKNOWN, {}, "reason_code")
    is_other = reason_code == OTHER_ITEM_CODE
    if is_other and not reason.strip():
        raise _refusal(VOID_REASON_REQUIRED_FOR_OTHER, {}, "reason")
    cleaned = validate_void_reason(reason, "reason", enforce_minimum=is_other)
    return ResolvedVoidReason(organization_id, reason_code, cleaned, item.is_active)


@extend_schema_field({"type": "string", "maxLength": VOID_REASON_MAX_LENGTH})
class VoidReasonField(serializers.CharField):
    """Text shape only; the resolver owns text checks and their #32 error codes."""

    def run_validators(self, value: str) -> None:
        return None


class VoidSerializer(serializers.Serializer[Any]):
    """Shared HTTP and sync body. The target-aware resolver validates the choice and text."""

    reason_code = serializers.CharField(allow_blank=True, max_length=64)
    reason = VoidReasonField(allow_blank=True, required=False, default="", trim_whitespace=False)
