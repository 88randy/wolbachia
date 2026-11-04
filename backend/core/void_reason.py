"""The one place that decides whether a void reason is acceptable (issue #32).

Every void path goes through it: `POST .../void/` (`VoidSerializer`), the phone's `record.void`
event and `core.services.void_record` itself, so no caller can write a shorter reason.
Errors carry a machine code and params, never user-facing text.

What counts as a character is decided here once (the web mirrors it in `count-characters.ts`):
invisible text (zero-width, combining marks, spaces, filler glyphs) never reaches the minimum.
"""

import unicodedata
from typing import Any

from django.conf import settings
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from core.validation import params_message

VOID_REASON_MAX_LENGTH = 1000
VOID_REASON_TOO_SHORT = "void_reason_too_short"
VOID_REASON_INVALID_CHARACTERS = "void_reason_invalid_characters"
MAX_LENGTH_CODE = "max_length"

# Text that shows nothing: format (zero-width, joiners), combining marks, every space and line
# separator. They are not trimmed away, only ignored for the minimum.
_INVISIBLE_CATEGORIES = frozenset({"Cf", "Mn", "Me", "Zs", "Zl", "Zp"})
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


def validate_void_reason(reason: str, field: str | None = None) -> str:
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
    if visible_length(cleaned) < minimum:
        raise _refusal(VOID_REASON_TOO_SHORT, {"min_length": minimum}, field)
    if len(cleaned) > VOID_REASON_MAX_LENGTH:
        raise _refusal(MAX_LENGTH_CODE, {"max_length": VOID_REASON_MAX_LENGTH}, field)
    return cleaned


class VoidReasonField(serializers.CharField):
    """A void reason in a request body. Blank is allowed here so the one validator answers it
    (`void_reason_too_short`); a missing field stays `required`."""

    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401
        super().__init__(
            allow_blank=True, trim_whitespace=True, max_length=VOID_REASON_MAX_LENGTH, **kwargs
        )

    def run_validation(self, data: Any = serializers.empty) -> Any:  # noqa: ANN401
        value = super().run_validation(data)
        return validate_void_reason(value)


class VoidSerializer(serializers.Serializer[Any]):
    """Body of `POST .../void/`."""

    reason = VoidReasonField()
