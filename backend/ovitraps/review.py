"""Ovitrap review uses original actor, capture facts and the existing owner validators."""

from typing import Any

from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from reviews.contracts import ReviewAdapter
from reviews.inspection import ExistingEffect


class OvitrapReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "ovitrap_too_far",
            "ovitrap_speed_anomaly",
            "causal_parent_pending",
            "motorcycle_safety_hold",
            "ovitrap_evidence_required",
            "late_work_after_quadrant_close",
        }
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> None:
        from ovitraps.selectors import accessible_ovitrap, accessible_point

        if ctx.envelope.type == "ovitrap.place":
            accessible_point(ctx, data["sampling_point_id"])
        else:
            from field_sync.exceptions import EventNeedsReview
            from reviews.effect_receipts import is_effective

            physical = accessible_ovitrap(ctx, data["ovitrap_id"])
            if not is_effective(physical.event):
                raise EventNeedsReview("causal_parent_pending")

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        if "ovitrap" in ctx.observed_facts:
            return dict(ctx.observed_facts)
        # Causal quarantine cannot fabricate a physical parent. Independently known
        # immutable point/rule inputs can still be retained at this actual observation.
        from geography.models import SamplingPoint
        from ovitraps.capture import observed_capture_inputs
        from reviews.scope import subject_facts

        subjects = subject_facts(ctx.organization, ctx.envelope)
        point = (
            None
            if subjects.resource_id is None
            else SamplingPoint.objects.filter(
                organization=ctx.organization, pk=subjects.resource_id
            ).first()
        )
        if point is None:
            return {"ovitrap": {"version": 1, "available": False}}
        observed_capture_inputs(ctx, point)
        from geography.decisions.capture import observe_epoch

        observe_epoch(ctx, point)
        return dict(ctx.observed_facts)

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        from geography.decisions.capture import capture_epoch
        from geography.models import SamplingPoint
        from ovitraps.review_inspection import inspect_legacy_capture
        from reviews.scope import subject_facts

        subjects = subject_facts(ctx.organization, ctx.envelope)
        point = (
            None
            if subjects.resource_id is None
            else SamplingPoint.objects.filter(
                organization=ctx.organization, pk=subjects.resource_id
            )
            .select_related("block__quadrant")
            .first()
        )
        if point is not None:
            capture_epoch(ctx, point)

        legacy = inspect_legacy_capture(source)
        if legacy.state == "none":
            from reviews.exceptions import ReviewBlockedError

            original = (
                {}
                if ctx.review_authorization is None
                else ctx.review_authorization.owner_facts.get("ovitrap", {})
            )
            if original.get("version") != 1 or not original.get("available"):
                raise ReviewBlockedError(("capture_context_unavailable",))
        return legacy

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from ovitraps.lifecycle.services import apply_lifecycle
        from ovitraps.services import check_ovitrap, place_ovitrap

        apply = {"ovitrap.place": place_ovitrap, "ovitrap.check": check_ovitrap}.get(
            ctx.envelope.type, apply_lifecycle
        )
        apply(ctx, data)
        return _applied_materialization(ctx)


def _applied_materialization(ctx: EventContext) -> dict[str, Any]:
    from ovitraps.models import (
        Bag,
        Ovitrap,
        OvitrapIncidentLink,
        OvitrapReading,
        PhysicalOvitrapLineage,
        PlacementAttempt,
        RelocationProposal,
        RemovalAttempt,
    )

    facts = {}
    for key, model in (
        ("ovitrap_id", Ovitrap),
        ("placement_id", PlacementAttempt),
        ("reading_id", OvitrapReading),
        ("bag_id", Bag),
        ("lineage_id", PhysicalOvitrapLineage),
        ("relocation_id", RelocationProposal),
        ("removal_id", RemovalAttempt),
        ("incident_marker_id", OvitrapIncidentLink),
    ):
        row = model.objects.filter(organization=ctx.organization, event_id=ctx.envelope.id).first()
        if row is not None:
            facts[key] = str(row.pk)
    return facts
