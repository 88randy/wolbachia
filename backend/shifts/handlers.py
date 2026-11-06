"""Registers `shift.open` and `shift.close` in the sync handler registry (from `AppConfig.ready`)."""

from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from shifts.codes import (
    CLOSE_CODES,
    OPEN_CODES,
    SHIFT_CLOSE_EVENT_TYPE,
    SHIFT_EVENT_NOT_VOIDABLE,
    SHIFT_OPEN_EVENT_TYPE,
)
from shifts.payloads import ShiftClosePayloadSerializer, ShiftOpenPayloadSerializer
from shifts.review import ShiftReviewAdapter
from shifts.services import close_shift, open_shift


def refuse_void(ctx: EventContext, voided_event: FieldEvent) -> None:
    """A shift event cannot be voided by its author: a wrong shift is corrected by a supervisor
    (#34), because voiding `shift.open` would leave the day's records without their shift."""
    raise EventRejected(SHIFT_EVENT_NOT_VOIDABLE)


def register_shift_handlers() -> None:
    register(
        EventHandler(
            SHIFT_OPEN_EVENT_TYPE,
            1,
            ShiftOpenPayloadSerializer,
            open_shift,
            on_void=refuse_void,
            codes=OPEN_CODES,
            checks_shift=False,
            review_adapter=ShiftReviewAdapter(),
        )
    )
    register(
        EventHandler(
            SHIFT_CLOSE_EVENT_TYPE,
            1,
            ShiftClosePayloadSerializer,
            close_shift,
            on_void=refuse_void,
            codes=CLOSE_CODES,
            checks_shift=False,
            review_adapter=ShiftReviewAdapter(),
        )
    )
