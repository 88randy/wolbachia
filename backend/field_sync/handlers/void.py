"""`record.void`: the phone's correction of one of its own earlier events.

Nothing is deleted: the target event keeps its row and gets its void fields set; the void event
references it (`voids_event`) and carries the reason. Generic over every event type: when the
target's type registered an `on_void` hook, it runs in the same savepoint and may refuse.
"""

from typing import Any

from rest_framework.exceptions import ValidationError

from core.exceptions import AlreadyVoidedError
from core.services import void_locked_record
from core.void_reason import VOID_REASON_CODE_UNKNOWN, VoidSerializer, resolve_void_reason
from field_sync.codes import (
    ALREADY_VOIDED,
    INVALID_PAYLOAD,
    VOID_EVENT_TYPE,
    VOID_REASON_CODE_DEACTIVATED,
    VOID_TARGET_NOT_FOUND,
    VOID_TARGET_NOT_OWNED,
)
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import EventStatus, FieldEvent
from field_sync.registry import EventContext, EventHandler, get_handler, register
from field_sync.services import rejection_params


class VoidPayloadSerializer(VoidSerializer):
    """Schema version 1 uses the shared void body (issue #80)."""


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
    try:
        choice = resolve_void_reason(
            target.organization_id, data["reason"], data["reason_code"], allow_inactive=True
        )
    except ValidationError as error:
        params = rejection_params(error)
        code = (
            VOID_REASON_CODE_UNKNOWN
            if VOID_REASON_CODE_UNKNOWN in params["fields"].get("reason_code", [])
            else INVALID_PAYLOAD
        )
        raise EventRejected(code, params) from None
    if not choice.is_active:
        raise EventNeedsReview(VOID_REASON_CODE_DEACTIVATED)
    if ctx.review_code is not None and not ctx.acknowledges(ctx.review_code):
        return
    try:
        voided = void_locked_record(target, ctx.user, choice)
    except AlreadyVoidedError:
        raise EventRejected(ALREADY_VOIDED) from None
    target_handler = get_handler(target.type, target.schema_version)
    if target_handler is not None and target_handler.on_void is not None:
        target_handler.on_void(ctx, voided)


def register_void_handler() -> None:
    from reviews.void_adapter import VoidReviewAdapter

    register(
        EventHandler(
            VOID_EVENT_TYPE,
            1,
            VoidPayloadSerializer,
            apply_void,
            codes=(
                VOID_TARGET_NOT_FOUND,
                VOID_TARGET_NOT_OWNED,
                ALREADY_VOIDED,
                VOID_REASON_CODE_UNKNOWN,
                VOID_REASON_CODE_DEACTIVATED,
            ),
            checks_shift=False,
            review_adapter=VoidReviewAdapter(),
        )
    )
