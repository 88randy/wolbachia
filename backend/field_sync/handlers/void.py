"""`record.void`: the phone's correction of one of its own earlier events.

Nothing is deleted: the target event keeps its row and gets its void fields set; the void event
references it (`voids_event`) and carries the reason. Generic over every event type: when the
target's type registered an `on_void` hook, it runs in the same savepoint and may refuse.
"""

from typing import Any

from rest_framework import serializers

from core.exceptions import AlreadyVoidedError
from core.services import void_record
from field_sync.codes import (
    ALREADY_VOIDED,
    INVALID_PAYLOAD,
    VOID_EVENT_TYPE,
    VOID_TARGET_NOT_FOUND,
    VOID_TARGET_NOT_OWNED,
)
from field_sync.exceptions import EventRejected
from field_sync.models import EventStatus, FieldEvent
from field_sync.registry import EventContext, EventHandler, get_handler, register

VOID_REASON_MAX_LENGTH = 1000


class VoidPayloadSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(
        allow_blank=False, trim_whitespace=True, max_length=VOID_REASON_MAX_LENGTH
    )


def find_void_target(ctx: EventContext) -> FieldEvent:
    """The event this void points at, in the sender's organization (reads).

    An id that does not exist and an id of another organization give the same
    `void_target_not_found`, so nothing leaks. [ASSUMPTION] Rejected events and void events are
    not valid targets either (there is nothing to correct): same code.
    """
    target_id = ctx.envelope.voids_event_id
    if target_id is None:
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"voids_event_id": ["required"]}})
    target = FieldEvent.objects.for_org(ctx.organization).filter(pk=target_id).first()
    if target is None or target.status == EventStatus.REJECTED or target.type == VOID_EVENT_TYPE:
        raise EventRejected(VOID_TARGET_NOT_FOUND)
    if target.created_by_id != ctx.user.pk:
        raise EventRejected(VOID_TARGET_NOT_OWNED)
    return target


def apply_void(ctx: EventContext, data: dict[str, Any]) -> None:
    """Void the target (writes the void fields of the target); refused for another user's event,
    one already voided, or when the target type's `on_void` hook says no.

    When the void itself is going to be reviewed (`ctx.review_code`: a final upload or a skewed
    clock) the target is validated but **left intact**: the void event lands `in_review` and a
    supervisor applies it when they accept it (#22). A doubtful event must not change records
    (decision 73).
    """
    target = find_void_target(ctx)
    if target.voided_at is not None:
        raise EventRejected(ALREADY_VOIDED)
    if ctx.review_code is not None:
        return
    try:
        voided = void_record(target, ctx.user, data["reason"])
    except AlreadyVoidedError:
        raise EventRejected(ALREADY_VOIDED) from None
    target_handler = get_handler(target.type, target.schema_version)
    if target_handler is not None and target_handler.on_void is not None:
        target_handler.on_void(ctx, voided)


def register_void_handler() -> None:
    register(
        EventHandler(
            VOID_EVENT_TYPE,
            1,
            VoidPayloadSerializer,
            apply_void,
            codes=(VOID_TARGET_NOT_FOUND, VOID_TARGET_NOT_OWNED, ALREADY_VOIDED),
            checks_shift=False,
        )
    )
