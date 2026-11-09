"""B33 uses the shared typed history producer and its durable publication receipt."""

from typing import Any

from core.models import OrgScopedModel
from field_sync.models import FieldEvent
from geography.decisions.scope import context
from ovitraps.lifecycle.models import RelocationProposal
from reviews.effect_receipts import is_effective
from reviews.history import publish_history
from reviews.scope import SubjectFacts


def proposal_subjects(proposal: RelocationProposal) -> SubjectFacts:
    point = proposal.ovitrap.sampling_point
    return SubjectFacts(True, (context(point.block.quadrant),), "sampling_point", point.pk)


def proposal_payload(proposal: RelocationProposal) -> dict[str, Any]:
    decision = proposal.decisions.order_by("-created_at", "-pk").first()
    origin = getattr(proposal, "next_day_task", None)
    point = proposal.ovitrap.sampling_point
    return {
        "id": str(proposal.pk),
        "kind": "relocation_proposal",
        "proposal_event_id": str(proposal.event_id),
        "point_id": str(point.pk),
        "point_code": point.code,
        "status": "pending" if decision is None else decision.decision,
        "proposed_location": proposal.new_location,
        "decision": None
        if decision is None
        else {
            "id": str(decision.pk),
            "decision": decision.decision,
            "reason": decision.reason,
            "decided_at": None if decision.decided_at is None else decision.decided_at.isoformat(),
            "published_point_version": None
            if decision.published_point_version_id is None
            else str(decision.published_point_version_id),
        },
        "next_day_task": None
        if origin is None
        else {
            "id": str(origin.task_id),
            "code": origin.task.code,
            "due_date": origin.task.due_date.isoformat(),
        },
        "source_voided_at": None
        if proposal.event.voided_at is None
        else proposal.event.voided_at.isoformat(),
        "subjects": list(proposal_subjects(proposal).contexts),
    }


def publish_proposal(proposal: RelocationProposal, *, cause: OrgScopedModel) -> None:
    courier = proposal.event.created_by
    if courier is not None:
        publish_history("relocation_proposal", cause, courier, proposal_payload(proposal))


def stored_source(source: FieldEvent, *, cause: OrgScopedModel | None = None) -> None:
    """Run after the real source exists, including effective review and source voids."""
    if source.type not in {"ovitrap.relocate", "record.void"} or not is_effective(source):
        return
    from reviews.inspection import original_source_envelope

    identifier = (
        original_source_envelope(source).voids_event_id
        if source.type == "record.void"
        else source.pk
    )
    for proposal in RelocationProposal.objects.filter(
        organization=source.organization, event_id=identifier
    ).select_related("event__created_by", "ovitrap__sampling_point__block__quadrant"):
        publish_proposal(proposal, cause=source if cause is None else cause)
