"""The one place that decides whether a void reason is acceptable (issue #32).

Every void path goes through it: `POST .../void/` (`VoidSerializer`), the phone's `record.void`
event and `core.services.void_record` itself, so no caller can write a shorter reason.
Errors carry a machine code and params, never user-facing text.
"""

from typing import Any

from django.conf import settings
from rest_framework import serializers

from core.exceptions import FieldValidationError

VOID_REASON_FIELD = "reason"
VOID_REASON_MAX_LENGTH = 1000
VOID_REASON_TOO_SHORT = "void_reason_too_short"


def void_reason_min_length() -> int:
    """Minimum characters after trimming (`VOID_REASON_MIN_LENGTH`, default 10), read per call.

    Kept between 1 (a reason is always required) and the maximum, so a bad setting cannot make
    every void impossible.
    """
    return min(max(1, int(settings.VOID_REASON_MIN_LENGTH)), VOID_REASON_MAX_LENGTH)


def validate_void_reason(reason: str, field: str = VOID_REASON_FIELD) -> str:
    """Trim `reason` and enforce the minimum length; returns the trimmed text.

    Raises `FieldValidationError` (400 `validation_error`) with code `void_reason_too_short` and
    params `{min_length}`. A blank reason is too short as well. The maximum is a plain
    `max_length` check on the serializer field, which runs on the raw text first.
    """
    cleaned = reason.strip()
    minimum = void_reason_min_length()
    if len(cleaned) < minimum:
        raise FieldValidationError(field, VOID_REASON_TOO_SHORT, {"min_length": minimum})
    return cleaned


class VoidReasonField(serializers.CharField):
    """A void reason in a request body: required, trimmed, at most 1000 and at least the minimum."""

    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401
        super().__init__(
            allow_blank=False,
            trim_whitespace=True,
            max_length=VOID_REASON_MAX_LENGTH,
            **kwargs,
        )

    def run_validation(self, data: Any = serializers.empty) -> Any:  # noqa: ANN401
        value = super().run_validation(data)
        return validate_void_reason(value, self.field_name or VOID_REASON_FIELD)


class VoidSerializer(serializers.Serializer[Any]):
    """Body of `POST .../void/`."""

    reason = VoidReasonField()
