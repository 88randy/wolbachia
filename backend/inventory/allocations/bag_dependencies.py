"""Whole real Bag disposal uses actual retained Lab obligations and closed-day proofs."""

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from inventory.allocations.intents import IntentSubjects

from django.http import Http404

from core.snapshots import snapshot_hash
from inventory.allocations.models import BagDisposition
from inventory.allocations.permissions import BAG_DISPOSE
from inventory.allocations.scope import require_contexts
from inventory.allocations.transactions import SupplyParticipants
from inventory.exceptions import InventoryConflictError
from lab.access import LabTarget, prepare_lab_subject, scoped_bags
from lab.models import (
    BagReceipt,
    DailyRecountSample,
    DailyRecountSampleMember,
    EggCountAttempt,
    LabRejection,
    LabResultRevision,
    LabResultVoid,
    RecountRequest,
)
from lab.recounts import daily_population, population_fingerprint
from organizations.models import Membership
from ovitraps.models import Bag
from uploads.access import UploadActor


def bag_intent_subjects(actor: UploadActor, values: dict[str, Any]) -> "IntentSubjects":
    from inventory.allocations.intents import IntentSubjects

    prepared = prepare_lab_subject(actor, LabTarget("bag", values["bag_id"]), BAG_DISPOSE)
    bag = (
        scoped_bags(actor, BAG_DISPOSE)
        .select_related("reading__event", "reading__ovitrap__sampling_point__block__quadrant")
        .filter(pk=values["bag_id"])
        .first()
    )
    if bag is None:
        raise Http404
    owner = (
        Membership.objects.filter(
            organization=actor.organization,
            user_id=values["owner_id"],
            is_active=True,
            user__is_active=True,
        )
        .select_related("user")
        .first()
    )
    if owner is None:
        raise Http404
    contexts = [{"center_id": str(prepared.center_id), "quadrant_id": str(prepared.quadrant_id)}]
    require_contexts(UploadActor(owner.user, actor.organization), BAG_DISPOSE, contexts)
    humans = {prepared.collector_id, owner.user_id, *prepared.author_ids, *bag_authors(bag)}
    return IntentSubjects(
        {"bag": bag},
        contexts,
        SupplyParticipants(tuple(sorted(humans)), (prepared.source_id,), (prepared.collector_id,)),
    )


def bag_authors(bag: Bag) -> set[Any]:
    humans = {bag.collector_id, bag.created_by_id, bag.reading.event.created_by_id}
    for model in (BagReceipt, EggCountAttempt, LabRejection, LabResultRevision):
        humans.update(model.objects.filter(bag=bag).values_list("created_by_id", flat=True))
    humans.update(
        LabResultVoid.objects.filter(count__bag=bag).values_list("created_by_id", flat=True)
    )
    humans.update(
        LabResultVoid.objects.filter(rejection__bag=bag).values_list("created_by_id", flat=True)
    )
    humans.update(
        RecountRequest.objects.filter(count__bag=bag).values_list("first_counter_id", flat=True)
    )
    if None in humans:
        raise InventoryConflictError("supply_author_unavailable")
    return humans


def disposal_assessment(bag: Bag) -> dict[str, Any]:
    """No absent request/open day is clearance; the SAME canonical population owns the hash."""
    if BagDisposition.objects.filter(bag=bag).exists():
        raise InventoryConflictError("bag_already_disposed")
    receipt = BagReceipt.objects.filter(
        bag=bag, reading=bag.reading, source=bag.reading.event, kind="bag"
    ).first()
    current = LabResultRevision.objects.filter(bag=bag).first()
    if receipt is None or current is None or current.count_id is None:
        raise InventoryConflictError("lab_disposal_unassessed")
    if RecountRequest.objects.filter(count__bag=bag, supersession__isnull=True).exists():
        raise InventoryConflictError("lab_recount_pending")
    count = current.count
    sample = (
        DailyRecountSample.objects.filter(
            organization=bag.organization,
            timezone=bag.organization.timezone,
            utc_from__lte=count.created_at,
            utc_before__gt=count.created_at,
        )
        .order_by("-created_at", "-revision")
        .first()
    )
    if sample is None or sample.rules.get("organization_revision") != bag.organization.revision:
        raise InventoryConflictError("lab_draw_unassessed")
    population = daily_population((bag.organization, sample.utc_from, sample.utc_before))
    fingerprint, size = population_fingerprint(population, sample.rules)
    member = DailyRecountSampleMember.objects.filter(sample=sample, count=count).first()
    if (
        sample.frame_hash != fingerprint
        or sample.population != size
        or member is None
        or member.selected
    ):
        raise InventoryConflictError("lab_draw_unassessed")
    proof = {
        "bag_id": str(bag.pk),
        "reading_id": str(bag.reading_id),
        "source_event_id": str(bag.reading.event_id),
        "source_hash": bag.reading.event.payload_sha256,
        "receipt_id": str(receipt.pk),
        "result_revision_id": str(current.pk),
        "count_id": str(count.pk),
        "sample_id": str(sample.pk),
        "sample_frame_hash": sample.frame_hash,
        "sample_member_id": str(member.pk),
        "selected": False,
        "pending_request_ids": [],
    }
    return {**proof, "proof_hash": snapshot_hash(proof)}


def material_availability(bag: Bag) -> dict[str, Any]:
    disposition = BagDisposition.objects.filter(bag=bag).first()
    return {
        "available": disposition is None,
        "disposition_id": None if disposition is None else str(disposition.pk),
        "reason": None if disposition is None else "bag_disposed",
    }
