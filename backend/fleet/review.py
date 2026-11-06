"""Fuel review keeps original measured intervals and immutable provisional flags."""

from typing import Any

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from fleet.fuel_services import apply_fuel_load
from fleet.models import FuelLoad
from reviews.contracts import ReviewAdapter
from reviews.inspection import ExistingEffect, inspect_fuel
from shifts.codes import MOTORCYCLE_UNKNOWN
from shifts.models import Motorcycle, Shift


class FuelReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "odometer_decreased",
            "fuel_efficiency_review",
            "causal_parent_pending",
            "motorcycle_safety_hold",
        }
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        motorcycle = Motorcycle.objects.filter(
            organization=ctx.organization, code=data["motorcycle_id"], voided_at__isnull=True
        ).first()
        if motorcycle is None:
            raise EventRejected(MOTORCYCLE_UNKNOWN)
        Motorcycle.objects.select_for_update(nowait=True).get(pk=motorcycle.pk)
        if ctx.envelope.shift_id is not None:
            list(
                Shift.objects.filter(
                    organization=ctx.organization, pk=ctx.envelope.shift_id, courier=ctx.user
                ).select_for_update(nowait=True)
            )
        from fleet.review_facts import validate_original_comparison

        if ctx.review_authorization is not None:
            if not FuelLoad.objects.filter(event_id=ctx.envelope.id).exists():
                validate_original_comparison(ctx, motorcycle, data)
            return {}
        return {}

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        return dict(ctx.observed_facts) or {"fuel": {"version": 1, "available": False}}

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        legacy = inspect_fuel(source, ctx.envelope)
        if legacy.state == "none":
            from fleet.review_facts import frozen_comparison

            frozen_comparison(ctx)
        return legacy

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        try:
            apply_fuel_load(ctx, data)
        except EventNeedsReview as observation:
            if not ctx.acknowledges(observation.code):
                raise
        return inspect_fuel(
            FieldEvent.objects.get(pk=ctx.envelope.id), ctx.envelope
        ).materialization
