"""A named-method rejection is an authored result with verified evidence, never a zero count."""

from dataclasses import dataclass
from typing import Any

from django.http import Http404

from core.void_reason import validate_void_reason
from lab.access import reading_source_proof, scoped_bags
from lab.commands import LabCommandInput, LabOutcome
from lab.counting import disposition_context
from lab.evidence import bind_rejection_evidence, verified_rejection_evidence
from lab.exceptions import LabConflictError
from lab.methods import configured_method, method_pin
from lab.models import BagReceipt, LabCommand, LabRejection, LabResultRevision, RecountRequest
from lab.permissions import REJECTION_CREATE
from lab.queue import next_queue_snapshot
from ovitraps.models import Bag
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD


@dataclass(frozen=True)
class RejectionCreation:
    actor: UploadActor
    command: LabCommand
    bag: Bag
    receipt: BagReceipt
    values: dict[str, Any]


def record_rejection(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> LabOutcome:
    bag, receipt, previous = disposition_context(actor, request, REJECTION_CREATE)
    rejection = create_rejection(RejectionCreation(actor, command, bag, receipt, request.values))
    LabResultRevision.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        bag=bag,
        revision=1 if previous is None else previous.revision + 1,
        previous=previous,
        command=command,
        rejection=rejection,
    )
    from lab.history import publish_lab_fact

    publish_lab_fact(rejection)
    return LabOutcome(
        201,
        {
            "rejection": rejection_projection(rejection),
            **next_queue_snapshot(actor, bag, request.values),
        },
    )


def create_rejection(creation: RejectionCreation) -> LabRejection:
    actor, bag, values = creation.actor, creation.bag, creation.values
    if not scoped_bags(actor, FIELD_UPLOAD).filter(pk=bag.pk).exists():
        raise Http404
    if RecountRequest.objects.filter(
        count__bag=bag, supersession__isnull=False, supersession__replacement__isnull=True
    ).exists():
        raise LabConflictError("lab_recount_dependency")
    method, verification = configured_method(
        actor.organization.pk, values["method_version"], "rejection"
    )
    reason = validate_void_reason(values["reason"], "reason")
    evidence = verified_rejection_evidence(actor, values["evidence_ids"])
    rejection = LabRejection.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command=creation.command,
        bag=bag,
        receipt=creation.receipt,
        method_version=method,
        verification=verification,
        reason=reason,
        evidence_ids=[str(row.public_id) for row in evidence],
        source_proof=reading_source_proof(bag.reading),
    )
    bind_rejection_evidence(rejection, evidence)
    return rejection


def rejection_projection(rejection: LabRejection) -> dict[str, Any]:
    return {
        "id": str(rejection.pk),
        "bag_id": str(rejection.bag_id),
        "method_version": str(rejection.method_version_id),
        "method": method_pin(rejection.method_version),
        "verification_id": str(rejection.verification_id),
        "reason": rejection.reason,
        "evidence_ids": rejection.evidence_ids,
        "source_proof": rejection.source_proof,
        "created_at": rejection.created_at.isoformat(),
        "created_by": str(rejection.created_by_id),
        "voided": hasattr(rejection, "void_fact"),
        "expected_revision": rejection.result_revision.revision,
    }
