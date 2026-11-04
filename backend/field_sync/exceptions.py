"""Errors of the sync pipeline.

`DomainError`s are batch-level answers (HTTP status). `EventRejected` and `EventNeedsReview` are
the two outcomes a handler may raise for one event; they are control flow, never HTTP responses:
the event gets a per-event result with a machine `code` and `params`, never user-facing text.
"""

from http import HTTPStatus
from typing import Any

from core.exceptions import DomainError


class DeviceMismatchError(DomainError):
    code = "device_mismatch"
    status_code = HTTPStatus.FORBIDDEN
    default_detail = "The device of the batch is not the device of the session."


class InvalidCursorError(DomainError):
    code = "invalid_cursor"
    status_code = HTTPStatus.BAD_REQUEST
    default_detail = "The cursor is not valid."


class EventOutcome(Exception):  # noqa: N818
    """Base of the per-event outcomes: a stable machine `code` and JSON `params`."""

    def __init__(self, code: str, params: dict[str, Any] | None = None) -> None:
        self.code = code
        self.params = params or {}
        super().__init__(code)


class EventRejected(EventOutcome):
    """The event is not applied: every write it made is rolled back and it is stored `rejected`."""


class EventNeedsReview(EventOutcome):
    """The event is applied but flagged: it is stored `in_review` and a supervisor must look.

    A handler raises it only after it has made the writes it wants to keep.
    """
