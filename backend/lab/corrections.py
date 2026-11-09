"""Same-Bag atomic void/replacement retains original facts and independent QA obligations."""

from typing import Any
from uuid import UUID

from django.http import Http404
from django.shortcuts import get_object_or_404

from core.exceptions import FieldValidationError
from core.void_reason import (
    ResolvedVoidReason,
    resolve_void_reason,
    validate_void_reason,
    visible_length,
)
from lab.access import scoped_bags, target_bag
from lab.commands import LabCommandInput, LabOutcome
from lab.counting import CountCreation, complete_count, count_projection, create_count
from lab.exceptions import LabConflictError
from lab.models import (
    LabCommand,
    LabResultRevision,
    LabResultVoid,
    RecountRequest,
    RecountRequestSupersession,
)
from lab.permissions import COUNT_VOID
from lab.queue import next_queue_snapshot
from lab.recounts import ensure_count_requests
from lab.rejections import RejectionCreation, create_rejection, rejection_projection
from reviews.effect_receipts import is_effective
from uploads.access import UploadActor


def lab_void_reason(values: dict[str, Any], organization_id: UUID) -> ResolvedVoidReason:
    reason = validate_void_reason(values["reason"], "reason", enforce_minimum=False)
    if visible_length(reason) < 10:
        raise FieldValidationError("reason", "void_reason_too_short", {"min_length": 10})
    return resolve_void_reason(organization_id, reason, values["reason_code"])


def void_result(actor: UploadActor, command: LabCommand, request: LabCommandInput) -> LabOutcome:
    bag = target_bag(actor, request.target, COUNT_VOID)
    if bag is None:
        raise Http404
    bag = get_object_or_404(
        scoped_bags(actor, COUNT_VOID).select_for_update(nowait=True, no_key=True), pk=bag.pk
    )
    previous = LabResultRevision.objects.filter(bag=bag).first()
    if (
        previous is None
        or previous.revision != request.values["expected_revision"]
        or request.target.identifier not in {previous.count_id, previous.rejection_id}
    ):
        raise LabConflictError("lab_state_conflict", 0 if previous is None else previous.revision)
    from lab.models import PaddleReuse

    if PaddleReuse.objects.filter(binding__bag=bag).exists():
        raise LabConflictError("lab_material_dependency")
    choice = lab_void_reason(request.values, actor.organization.pk)
    replacement = request.values.get("replacement")
    old_request = (
        None
        if previous.count_id is None
        else RecountRequest.objects.filter(count=previous.count).first()
    )
    if replacement and (
        not is_effective(bag.reading.event)
        or (old_request is not None and replacement["kind"] == "rejection")
    ):
        raise LabConflictError("lab_recount_dependency" if old_request else "no_reading")
    void = LabResultVoid.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command=command,
        count=previous.count,
        rejection=previous.rejection,
        reason_code=choice.code,
        reason=choice.reason,
    )
    count, rejection, causes = replacement_result(actor, command, (bag, previous, replacement))
    current = LabResultRevision.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        bag=bag,
        revision=previous.revision + 1,
        previous=previous,
        command=command,
        count=count,
        rejection=rejection,
        void=void,
    )
    if old_request is not None:
        successor = (
            None
            if count is None
            else ensure_count_requests(
                count,
                ("carried_obligation",),
                {
                    "predecessor_request_ids": [str(old_request.pk)],
                    "replacement_count_id": str(count.pk),
                },
            )
        )
        RecountRequestSupersession.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            request=old_request,
            void=void,
            replacement=successor,
        )
    from lab.history import publish_lab_fact

    if count is not None:
        complete_count(count, causes)
    if rejection is not None:
        publish_lab_fact(rejection)
    publish_lab_fact(void)
    if previous.count is not None:
        publish_lab_fact(previous.count)
    if previous.rejection is not None:
        publish_lab_fact(previous.rejection)
    return LabOutcome(
        200,
        {
            "void_id": str(void.pk),
            "current_revision": current.revision,
            "count": None if count is None else count_projection(count),
            "rejection": None if rejection is None else rejection_projection(rejection),
            **next_queue_snapshot(actor, bag, request.values),
        },
    )


def replacement_result(
    actor: UploadActor, command: LabCommand, facts: tuple[Any, Any, Any]
) -> tuple[Any, Any, tuple[str, ...]]:
    bag, previous, replacement = facts
    if replacement is None:
        return None, None, ()
    receipt = bag.lab_receipt
    if replacement["kind"] == "rejection":
        # The common rejection writer requires real physical material; replay happens upstream.
        rejection = create_rejection(RejectionCreation(actor, command, bag, receipt, replacement))
        return None, rejection, ()
    count, causes = create_count(
        CountCreation(actor, command, bag, receipt, replacement, previous.count)
    )
    return count, None, causes
