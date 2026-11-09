"""Current source-bound safety attestations; no synthetic fault, clearance or accepted effect."""

from dataclasses import dataclass
from typing import Any

from django.http import Http404

from core.exceptions import AlreadyVoidedError, FieldValidationError
from fleet.models import ServiceRecord
from reviews.contracts import SafetyDispositionRequest
from reviews.evaluation import ReviewEvaluation
from reviews.exceptions import ReviewBlockedError, SafetyDispositionRequiredError
from reviews.models import (
    ReviewDecision,
    ReviewEffectReceipt,
    ReviewSafetyDisposition,
    ReviewSourceSnapshot,
)
from reviews.scope import vector_allows
from shifts.models import Motorcycle, MotorcycleBlockEvent, Shift
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class SafetyProof:
    motorcycle: Motorcycle
    inspection: ServiceRecord


def prepare_safety_disposition(  # noqa: PLR0913 -- current actor, exact source evaluation and explicit proof request
    actor: UploadActor,
    evaluation: ReviewEvaluation,
    snapshot: ReviewSourceSnapshot,
    request: SafetyDispositionRequest | None,
) -> SafetyProof:
    if request is None:
        raise SafetyDispositionRequiredError
    subjects = evaluation.subjects
    if (
        not subjects.resolved
        or subjects.resource_kind != "motorcycle"
        or subjects.resource_id is None
        or snapshot.resource_id != subjects.resource_id
        or evaluation.legacy.state != "none"
    ):
        raise ReviewBlockedError(("safety_source_unavailable",))
    _require_new_unapplied(snapshot)
    if request.attest_safe_now is not True:
        raise FieldValidationError("safety_disposition", "current_attestation_required")
    _require_clearance_scope(actor, evaluation)
    motorcycle = (
        Motorcycle.objects.filter(organization=actor.organization, pk=subjects.resource_id)
        .select_for_update(nowait=True)
        .first()
    )
    if motorcycle is None:
        raise ReviewBlockedError(("safety_source_unavailable",))
    if motorcycle.voided_at is not None:
        raise AlreadyVoidedError
    # Allocation/grants are rechecked after the actual allocation arbiter.
    from reviews.inspection import original_source_envelope
    from reviews.scope import subject_facts

    current = subject_facts(actor.organization, original_source_envelope(snapshot.source_event))
    if not all(
        vector_allows(current_scope(actor), permission, current.contexts, current.resolved)
        for permission in ("review_item.decide", "motorcycle.service_clear")
    ):
        raise Http404
    inspection = (
        ServiceRecord.objects.filter(organization=actor.organization, pk=request.inspection_id)
        .select_for_update(nowait=True, no_key=True)
        .first()
    )
    if (
        inspection is None
        or inspection.kind != "inspection"
        or inspection.motorcycle_id != motorcycle.pk
        or inspection.voided_at is not None
    ):
        raise ReviewBlockedError(("safety_inspection_unavailable",))
    return SafetyProof(motorcycle, inspection)


def _require_new_unapplied(snapshot: ReviewSourceSnapshot) -> None:
    source = snapshot.source_event
    if (
        snapshot.policy_version != "reviews.v1"
        or source.type != "shift.open"
        or source.status != "in_review"
        or source.voided_at is not None
        or not snapshot.has_severe_observation
        or ReviewEffectReceipt.objects.filter(source_event=source).exists()
        or Shift.objects.filter(opened_event=source).exists()
        or MotorcycleBlockEvent.objects.filter(field_event=source).exists()
    ):
        raise ReviewBlockedError(("safety_source_unavailable",))


def _require_clearance_scope(actor: UploadActor, evaluation: ReviewEvaluation) -> None:
    if not all(
        vector_allows(
            current_scope(actor),
            permission,
            evaluation.subjects.contexts,
            evaluation.subjects.resolved,
        )
        for permission in ("review_item.decide", "motorcycle.service_clear")
    ):
        raise Http404


def record_safety_disposition(
    decision: ReviewDecision, proof: SafetyProof, evidence_ids: list[str]
) -> ReviewSafetyDisposition:
    from uploads.models import AttachmentLink, UploadVerification

    linked = AttachmentLink.objects.filter(
        organization=decision.organization,
        review_item=decision.review_item,
        upload__public_id__in=evidence_ids,
    )
    if (
        not evidence_ids
        or linked.count() != len(evidence_ids)
        or UploadVerification.objects.filter(upload__attachment__in=linked).count()
        != len(evidence_ids)
    ):
        raise ReviewBlockedError(("safety_evidence_required",))
    inspection = proof.inspection
    snapshot: dict[str, Any] = {
        "id": str(inspection.pk),
        "organization_id": str(inspection.organization_id),
        "motorcycle_id": str(inspection.motorcycle_id),
        "kind": inspection.kind,
        "performed_at": inspection.performed_at.isoformat(),
        "odometer_km": inspection.odometer_km,
        "created_by": None if inspection.created_by_id is None else str(inspection.created_by_id),
        "created_at": inspection.created_at.isoformat(),
        "due_metric_provenance": inspection.due_metric_provenance,
    }
    return ReviewSafetyDisposition.objects.create(
        organization=decision.organization,
        created_by=decision.created_by,
        source_event_id=decision.review_item.field_event_id,
        review_item=decision.review_item,
        decision=decision,
        motorcycle=proof.motorcycle,
        inspection=inspection,
        evidence_ids=evidence_ids,
        inspection_snapshot=snapshot,
        attest_safe_now=True,
    )
