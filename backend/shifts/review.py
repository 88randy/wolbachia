"""Shift-owned preparation, exact legacy inspection and supported reviewed execution."""

from typing import Any

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from reviews.contracts import ReviewAdapter
from reviews.inspection import ExistingEffect, inspect_shift
from shifts.codes import MOTORCYCLE_UNKNOWN, SHIFT_NOT_OPEN
from shifts.models import Motorcycle, Shift


class ShiftReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "severe_check",
            "odometer_decreased",
            "causal_parent_pending",
        }
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> None:
        from shifts.services import (
            _ensure_odometer_in_range,
            _has_motorcycle_scope,
            _lock_motorcycle,
            _require_shift_id,
        )

        _require_shift_id(ctx)
        if ctx.envelope.type == "shift.open":
            _lock_motorcycle(ctx, data["motorcycle_code"])
            _ensure_odometer_in_range(data["odometer_km"])
            return
        if ctx.envelope.shift_id is None:
            raise EventRejected(SHIFT_NOT_OPEN)
        candidate = (
            Shift.objects.filter(
                organization=ctx.organization, pk=ctx.envelope.shift_id, courier=ctx.user
            )
            .select_related("motorcycle")
            .first()
        )
        if candidate is None:
            raise EventRejected(SHIFT_NOT_OPEN)
        if not _has_motorcycle_scope(ctx, candidate.motorcycle):
            raise EventRejected(MOTORCYCLE_UNKNOWN)
        motorcycle = Motorcycle.objects.select_for_update(nowait=True).get(
            pk=candidate.motorcycle_id
        )
        if not _has_motorcycle_scope(ctx, motorcycle):
            raise EventRejected(MOTORCYCLE_UNKNOWN)
        locked = Shift.objects.select_for_update(nowait=True).get(pk=candidate.pk)
        if locked.courier_id != ctx.user.pk or locked.motorcycle_id != motorcycle.pk:
            raise EventRejected(SHIFT_NOT_OPEN)
        _ensure_odometer_in_range(data["odometer_km"])

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        return inspect_shift(source, ctx.envelope)

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from shifts.services import close_shift, open_shift

        try:
            (open_shift if ctx.envelope.type == "shift.open" else close_shift)(ctx, data)
        except EventNeedsReview as observation:
            if not ctx.acknowledges(observation.code):
                raise
        return inspect_shift(
            FieldEvent.objects.get(pk=ctx.envelope.id), ctx.envelope
        ).materialization
