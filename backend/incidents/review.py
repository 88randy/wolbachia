"""Reviewed capture retains its source author and explicit historical capability."""

from typing import Any

from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from incidents.handlers import apply_incident
from incidents.models import Incident
from reviews.contracts import ReviewAdapter
from reviews.inspection import ExistingEffect


class IncidentReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "causal_parent_pending",
            "motorcycle_safety_hold",
            "incident_configuration_unavailable",
            "incident_scope_unavailable",
            "incident_evidence_required",
        }
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> None:
        if ctx.review_code is not None and ctx.review_authorization is None:
            return
        from incidents.handlers import _source_context

        _source_context(ctx, data)

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        if Incident.objects.filter(source_event=source).exists():
            return ExistingEffect("partial", blockers=("legacy_materialization_unavailable",))
        return ExistingEffect()

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        apply_incident(ctx, data)
        incident = Incident.objects.get(
            organization=ctx.organization, source_event_id=ctx.envelope.id
        )
        return {
            "incident_id": str(incident.pk),
            "report_event_id": str(incident.events.get(revision=1).pk),
            "blocker_ids": sorted(
                str(value) for value in incident.blockers.values_list("pk", flat=True)
            ),
        }
