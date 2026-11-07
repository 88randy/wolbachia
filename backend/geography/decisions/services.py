"""Atomic authorized relocation decisions, never edits to source capture history."""

from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any, Literal, cast
from uuid import UUID

from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from core.exceptions import FieldValidationError
from core.void_reason import validate_void_reason
from field_sync.services import FanoutPublisher, FanoutScope, fanout_courier_changes
from geography.decisions.exceptions import GeographyDecisionConflictError
from geography.decisions.models import NextDayTask, QuadrantClosure
from geography.decisions.point_versions import append_relocation_point_version
from geography.decisions.scope import require_contexts
from geography.decisions.tasks import (
    anticipated_owner,
    member_for,
    publish_new_task,
    rejection_task,
)
from geography.decisions.transactions import WriteScope, geography_transaction
from geography.models import PointVersion, Quadrant, QuadrantVersion, SamplingPoint
from geography.selectors import quadrant_version_at
from geography.services import emit_point_projection
from ovitraps.lifecycle.models import RelocationDecision, RelocationProposal
from ovitraps.permissions import RELOCATION_DECIDE
from ovitraps.selectors import projected_ovitraps
from reviews.effect_receipts import is_effective
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class RelocationDecisionRequest:
    decision: Literal["approved", "rejected"]
    reason: str
    expected_revision: int


@dataclass(frozen=True)
class RelocationDecisionResult:
    decision: RelocationDecision
    point_version: PointVersion | None
    next_day_task: NextDayTask | None
    warnings: list[dict[str, Any]]


@dataclass(frozen=True)
class DecisionCommand:
    request: RelocationDecisionRequest
    instant: datetime


def proposal_for(actor: UploadActor, identifier: UUID) -> RelocationProposal:
    if not current_scope(actor).allows(RELOCATION_DECIDE):
        raise PermissionDenied
    row = (
        RelocationProposal.objects.filter(organization=actor.organization, pk=identifier)
        .select_related(
            "organization", "event", "ovitrap__sampling_point__block__quadrant", "point_version"
        )
        .first()
    )
    if row is None:
        raise Http404
    require_contexts(actor, RELOCATION_DECIDE, (row.ovitrap.sampling_point.block.quadrant,))
    return cast(RelocationProposal, row)


def current_epoch(quadrant: Quadrant) -> QuadrantVersion:
    epoch = quadrant_version_at(quadrant, timezone.now())
    if epoch is None:
        raise GeographyDecisionConflictError(
            [
                {
                    "reason": "geography_epoch_unavailable",
                    "permission": "quadrant.publish",
                    "link": "",
                }
            ]
        )
    return cast(QuadrantVersion, epoch)


def _lock_domain(proposal: RelocationProposal) -> None:
    point = proposal.ovitrap.sampling_point
    Quadrant.objects.select_for_update(nowait=True, no_key=True).get(pk=point.block.quadrant_id)
    SamplingPoint.objects.select_for_update(nowait=True, no_key=True).get(pk=point.pk)


def _require_decidable(proposal: RelocationProposal, request: RelocationDecisionRequest) -> None:
    if request.decision not in {"approved", "rejected"}:
        raise FieldValidationError("decision", "invalid_choice")
    if (
        request.expected_revision != 0
        or isinstance(request.expected_revision, bool)
        or proposal.decisions.exists()
    ):
        raise GeographyDecisionConflictError(
            [
                {
                    "reason": "relocation_revision_conflict",
                    "permission": RELOCATION_DECIDE,
                    "link": "",
                }
            ]
        )
    physical = projected_ovitraps(proposal.organization).filter(pk=proposal.ovitrap_id).first()
    if (
        proposal.event.type != "ovitrap.relocate"
        or not is_effective(proposal.event)
        or physical is None
        or physical.event.voided_at is not None
        or physical.is_replaced
        or physical.is_removed
    ):
        raise GeographyDecisionConflictError(
            [
                {
                    "reason": "proposal_source_unavailable",
                    "permission": "review_item.decide",
                    "link": "",
                }
            ]
        )
    if QuadrantClosure.objects.filter(
        quadrant_version=current_epoch(proposal.ovitrap.sampling_point.block.quadrant)
    ).exists():
        raise GeographyDecisionConflictError(
            [{"reason": "quadrant_closed", "permission": "quadrant.publish", "link": ""}]
        )
    latest = proposal.ovitrap.sampling_point.versions.order_by("-version").first()
    if latest is None or latest.is_retired:
        raise GeographyDecisionConflictError(
            [{"reason": "point_retired", "permission": "quadrant.publish", "link": ""}]
        )


def decide_relocation(
    actor: UploadActor, proposal_id: UUID, request: RelocationDecisionRequest
) -> RelocationDecisionResult:
    proposal = proposal_for(actor, proposal_id)
    request = replace(request, reason=validate_void_reason(request.reason, "reason"))
    instant = timezone.now()
    owner = (
        anticipated_owner(proposal, member_for(proposal, actor.user.pk), instant)
        if request.decision == "rejected"
        else None
    )
    quadrant = proposal.ovitrap.sampling_point.block.quadrant
    spec = WriteScope(
        RELOCATION_DECIDE,
        (quadrant,),
        (proposal.event_id,),
        True,
        () if owner is None else (owner,),
    )
    with (
        geography_transaction(actor, spec),
        fanout_courier_changes(
            FanoutScope(actor.organization, quadrant.center_id, quadrant.pk)
        ) as emit,
    ):
        proposal = proposal_for(actor, proposal_id)
        _lock_domain(proposal)
        _require_decidable(proposal, request)
        result = _append_decision(actor, proposal, DecisionCommand(request, instant))
        return _complete_decision(result, owner, emit)


def _append_decision(
    actor: UploadActor, proposal: RelocationProposal, command: DecisionCommand
) -> RelocationDecisionResult:
    request = command.request
    version, warnings = (
        (None, [])
        if request.decision == "rejected"
        else append_relocation_point_version(proposal, actor, command.instant)
    )
    decision = RelocationDecision.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        event=proposal.event,
        proposal=proposal,
        decision=request.decision,
        reason=request.reason,
        revision=1,
        decided_at=command.instant,
        published_point_version=version,
    )
    return RelocationDecisionResult(decision, version, None, warnings)


def _complete_decision(
    result: RelocationDecisionResult, owner: UUID | None, emit: FanoutPublisher
) -> RelocationDecisionResult:
    from geography.decisions.producers import publish_proposal

    decision = result.decision
    origin = None
    if decision.decision == "rejected":
        if decision.decided_at is None:
            raise GeographyDecisionConflictError(
                [
                    {
                        "reason": "decision_anchor_unavailable",
                        "permission": RELOCATION_DECIDE,
                        "link": "",
                    }
                ]
            )
        origin, created = rejection_task(decision, decision.decided_at, owner)
        if created:
            publish_new_task(origin, member_for(decision.proposal, decision.created_by_id), emit)
    elif result.point_version is not None:
        emit_point_projection(result.point_version, emit)
    publish_proposal(decision.proposal, cause=decision)
    return RelocationDecisionResult(decision, result.point_version, origin, result.warnings)
