"""A scan never manufactures a parent; authorized discrepancies commit before their response."""

from typing import Any

from django.shortcuts import get_object_or_404

from core.snapshots import snapshot_hash
from lab.access import reading_source_proof, scoped_readings, target_bag
from lab.commands import LabCommandInput, LabOutcome
from lab.exceptions import LabConflictError
from lab.incidents import link_reception_incident
from lab.models import BagReceipt, LabCommand, ReceptionDiscrepancy
from lab.permissions import BAG_RECEIVE
from ovitraps.models import Bag
from reviews.effect_receipts import is_effective
from uploads.access import UploadActor


def record_reception(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> LabOutcome:
    bag = target_bag(actor, request.target, BAG_RECEIVE)
    reading = (
        bag.reading
        if bag is not None
        else get_object_or_404(scoped_readings(actor, BAG_RECEIVE), pk=request.target.identifier)
    )
    effective = is_effective(reading.event)
    if bag is not None and not effective:
        return record_discrepancy(command, bag, ("no_reading", request.values.get("reason", "")))
    if not effective:
        raise LabConflictError("lab_source_ineffective")
    if request.action == "missing":
        if bag is None or BagReceipt.objects.filter(reading=reading).exists():
            raise LabConflictError("lab_state_conflict")
        return record_discrepancy(command, bag, ("missing", request.values["reason"]))
    if BagReceipt.objects.filter(reading=reading).exists():
        raise LabConflictError("already_received")
    if (bag is None) == reading.paddle_present:
        raise LabConflictError("lab_state_conflict")
    receipt = BagReceipt.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command=command,
        reading=reading,
        bag=bag,
        source=reading.event,
        kind="no_paddle" if bag is None else "bag",
    )
    from lab.history import publish_lab_fact

    publish_lab_fact(receipt)
    return LabOutcome(
        200,
        {
            "bag": None if bag is None else {"id": str(bag.pk), "code": bag.code},
            "reading": {"id": str(reading.pk), "paddle_present": reading.paddle_present},
            "receipt": receipt_projection(receipt),
        },
    )


def record_discrepancy(command: LabCommand, bag: Bag, observation: tuple[str, str]) -> LabOutcome:
    kind, reason = observation
    proof = {**reading_source_proof(bag.reading), "effective": is_effective(bag.reading.event)}
    digest = snapshot_hash({"kind": kind, "proof": proof})
    discrepancy, created = ReceptionDiscrepancy.objects.get_or_create(
        bag=bag,
        kind=kind,
        source_hash=digest,
        defaults={
            "organization": command.organization,
            "created_by": command.created_by,
            "source": bag.reading.event,
            "source_proof": proof,
            "reason": reason,
        },
    )
    was_pending = not hasattr(discrepancy, "incident_link")
    link = link_reception_incident(discrepancy)
    if created or (was_pending and link is not None):
        from lab.history import publish_lab_fact

        publish_lab_fact(discrepancy)
    code = (
        "lab_configuration_unavailable"
        if link is None
        else ("no_reading" if kind == "no_reading" else "lab_missing")
    )
    return LabOutcome(
        409,
        {
            "code": code,
            "detail": "Reception discrepancy retained.",
            "discrepancy_id": str(discrepancy.pk),
            "incident_id": None if link is None else str(link.incident_id),
            "blocked_by": [
                {
                    "reason": code,
                    "unblocked_by_role": "supervisor",
                    "link": f"/api/v1/lab-reception-discrepancies/{discrepancy.pk}/",
                }
            ],
        },
    )


def receipt_projection(receipt: BagReceipt) -> dict[str, Any]:
    return {
        "id": str(receipt.pk),
        "reading_id": str(receipt.reading_id),
        "bag_id": None if receipt.bag_id is None else str(receipt.bag_id),
        "bag_code": None if receipt.bag is None else receipt.bag.code,
        "kind": receipt.kind,
        "created_at": receipt.created_at.isoformat(),
        "created_by": str(receipt.created_by_id),
    }
