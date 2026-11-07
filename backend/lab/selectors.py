"""Current action scope precedes state filters, count, order and page."""

from typing import Any
from uuid import UUID

from django.db.models import Case, CharField, Exists, OuterRef, QuerySet, Subquery, Value, When
from django.http import Http404

from lab.access import scoped_bags, scoped_readings
from lab.counting import count_projection
from lab.models import (
    BagReceipt,
    EggCountAttempt,
    LabRejection,
    LabResultRevision,
    ReceptionDiscrepancy,
    RecountRequest,
)
from lab.permissions import BAG_RECEIVE, COUNT_READ, COUNT_VOID
from lab.rejections import rejection_projection
from ovitraps.models import Bag
from reviews.effect_receipts import effective_effects
from uploads.access import UploadActor, current_scope

RESULT_FILTERS = {
    "author": "created_by_id",
    "method": "method_version_id",
    "created_from": "created_at__gte",
    "created_before": "created_at__lt",
}
BAG_FILTERS = {
    "center": "reading__ovitrap__sampling_point__block__quadrant__center_id",
    "quadrant": "reading__ovitrap__sampling_point__block__quadrant_id",
    "point": "reading__ovitrap__sampling_point_id",
    "week": "reading__epi_week",
    "code": "code",
}


def filter_bags(rows: QuerySet[Bag], values: dict[str, Any]) -> QuerySet[Bag]:
    return rows.filter(
        **{lookup: values[key] for key, lookup in BAG_FILTERS.items() if key in values}
    )


def result_rows(
    actor: UploadActor, model: type[EggCountAttempt] | type[LabRejection], values: dict[str, Any]
) -> QuerySet[Any]:
    rows = model.objects.filter(
        organization=actor.organization, bag__in=filter_bags(scoped_bags(actor, COUNT_READ), values)
    )
    if not values.get("include_voided", False):
        rows = rows.filter(void_fact__isnull=True)
    rows = rows.filter(
        **{lookup: values[key] for key, lookup in RESULT_FILTERS.items() if key in values}
    )
    if model is EggCountAttempt and (qa := values.get("qa_state")):
        if qa == "not_requested":
            rows = rows.filter(recount_request__isnull=True)
        elif qa == "superseded":
            rows = rows.filter(recount_request__supersession__isnull=False)
        else:
            rows = rows.filter(
                recount_request__isnull=False, recount_request__supersession__isnull=True
            )
    return rows.order_by(values.get("ordering", "-created_at"), "id")


def reception_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[BagReceipt]:
    readings = scoped_readings(actor, BAG_RECEIVE).filter(
        **{
            lookup.removeprefix("reading__"): values[key]
            for key, lookup in BAG_FILTERS.items()
            if key != "code" and key in values
        }
    )
    rows = BagReceipt.objects.filter(organization=actor.organization, reading__in=readings)
    if "code" in values:
        rows = rows.filter(bag__code=values["code"])
    if "kind" in values:
        rows = rows.filter(kind=values["kind"])
    rows = rows.filter(
        **{
            lookup: values[key]
            for key, lookup in RESULT_FILTERS.items()
            if key in values and key != "method"
        }
    )
    return rows.order_by(values.get("ordering", "-created_at"), "id")


def discrepancy_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[ReceptionDiscrepancy]:
    rows = ReceptionDiscrepancy.objects.filter(
        organization=actor.organization,
        bag__in=filter_bags(scoped_bags(actor, BAG_RECEIVE), values),
    )
    rows = rows.filter(
        **{
            lookup: values[key]
            for key, lookup in RESULT_FILTERS.items()
            if key in values and key != "method"
        }
    )
    if "kind" in values:
        rows = rows.filter(kind=values["kind"])
    if "configuration_pending" in values:
        rows = rows.filter(incident_link__isnull=values["configuration_pending"])
    return rows.order_by(values.get("ordering", "-created_at"), "id")


def discrepancy_projection(actor: UploadActor, discrepancy: ReceptionDiscrepancy) -> dict[str, Any]:
    link = getattr(discrepancy, "incident_link", None)
    quadrant = discrepancy.bag.reading.ovitrap.sampling_point.block.quadrant
    can_read = current_scope(actor).allows(
        "incident.read", center=str(quadrant.center_id), quadrant=str(quadrant.pk)
    )
    return {
        "id": str(discrepancy.pk),
        "bag_id": str(discrepancy.bag_id),
        "source_event_id": str(discrepancy.source_id),
        "kind": discrepancy.kind,
        "reason": discrepancy.reason,
        "source_proof": discrepancy.source_proof,
        "created_at": discrepancy.created_at.isoformat(),
        "incident_id": None if link is None else str(link.incident_id),
        "configuration_pending": link is None,
        "incident_link": None
        if link is None or not can_read
        else f"/api/v1/incidents/{link.incident_id}/?kind=reported",
    }


def void_context(actor: UploadActor, identity: tuple[str, UUID]) -> dict[str, Any]:
    kind, identifier = identity
    model = EggCountAttempt if kind == "count" else LabRejection
    target = model.objects.filter(
        organization=actor.organization, bag__in=scoped_bags(actor, COUNT_VOID), pk=identifier
    ).first()
    if target is None:
        raise Http404
    latest = LabResultRevision.objects.filter(bag=target.bag).first()
    current = latest is not None and identifier in {latest.count_id, latest.rejection_id}
    proof = target.source_proof
    return {
        "id": str(target.pk),
        "kind": kind,
        "bag_id": str(target.bag_id),
        "reading_id": proof["reading_id"],
        "source_event_id": proof["source_event_id"],
        "current_revision": 0 if latest is None else latest.revision,
        "is_current": current,
        "value": target.value if isinstance(target, EggCountAttempt) else None,
        "reason": target.reason if isinstance(target, LabRejection) else None,
        "method_version": None
        if target.method_version_id is None
        else str(target.method_version_id),
        "method_name": None if target.method_version is None else target.method_version.name,
        "evidence_ids": target.evidence_ids if isinstance(target, LabRejection) else [],
        "has_recount_obligation": isinstance(target, EggCountAttempt)
        and hasattr(target, "recount_request"),
        "blocked_by": []
        if current
        else [{"reason": "lab_state_conflict", "unblocked_by_role": "entomologist", "link": ""}],
    }


def recount_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[RecountRequest]:
    rows = RecountRequest.objects.filter(
        organization=actor.organization,
        count__in=result_rows(actor, EggCountAttempt, {**values, "include_voided": True}),
    )
    if "superseded" in values:
        rows = rows.filter(supersession__isnull=not values["superseded"])
    return rows.order_by(values.get("ordering", "-created_at"), "id")


def annotate_lab_bags(rows: QuerySet[Bag]) -> QuerySet[Bag]:
    latest = LabResultRevision.objects.filter(bag=OuterRef("pk")).order_by("-revision")
    effective = effective_effects(Bag.objects.filter(pk=OuterRef("pk")), "reading__event")
    rows = rows.annotate(
        lab_effective=Exists(effective),
        lab_current_count=Subquery(latest.values("count_id")[:1]),
        lab_current_rejection=Subquery(latest.values("rejection_id")[:1]),
        lab_revision=Subquery(latest.values("revision")[:1]),
    )
    return rows.annotate(
        lab_has_qa=Exists(RecountRequest.objects.filter(count_id=OuterRef("lab_current_count"))),
        lab_missing=Exists(
            ReceptionDiscrepancy.objects.filter(bag_id=OuterRef("pk"), kind="missing")
        ),
    ).annotate(
        lab_status=Case(
            When(lab_effective=False, then=Value("no_effective_reading")),
            When(
                lab_current_count__isnull=False,
                lab_has_qa=True,
                then=Value("awaiting_independent_qa"),
            ),
            When(lab_current_count__isnull=False, then=Value("counted")),
            When(lab_current_rejection__isnull=False, then=Value("rejected")),
            When(lab_receipt__isnull=False, lab_revision__isnull=False, then=Value("voided")),
            When(lab_receipt__isnull=False, then=Value("pending_count")),
            When(lab_missing=True, then=Value("missing")),
            default=Value("expected"),
            output_field=CharField(),
        )
    )


def bag_lab_projection(bag: Bag) -> dict[str, Any]:
    receipt = getattr(bag, "lab_receipt", None)
    latest = LabResultRevision.objects.filter(bag=bag).first()
    if not effective_effects(Bag.objects.filter(pk=bag.pk), "reading__event").exists():
        status = "no_effective_reading"
    elif latest is not None and latest.count is not None:
        status = (
            "awaiting_independent_qa" if hasattr(latest.count, "recount_request") else "counted"
        )
    elif latest is not None and latest.rejection_id is not None:
        status = "rejected"
    elif receipt is not None:
        status = "voided" if latest is not None else "pending_count"
    else:
        status = "missing" if bag.lab_discrepancies.filter(kind="missing").exists() else "expected"
    return {
        "status": status,
        "revision": 0 if latest is None else latest.revision,
        "receipt_id": None if receipt is None else str(receipt.pk),
        "count_id": None if latest is None or latest.count_id is None else str(latest.count_id),
        "rejection_id": None
        if latest is None or latest.rejection_id is None
        else str(latest.rejection_id),
    }


def result_projection(result: EggCountAttempt | LabRejection) -> dict[str, Any]:
    projection = (
        count_projection(result)
        if isinstance(result, EggCountAttempt)
        else rejection_projection(result)
    )
    latest = LabResultRevision.objects.filter(bag=result.bag).first()
    return {
        **projection,
        "current_revision": 0 if latest is None else latest.revision,
        "is_current": latest is not None and result.pk in {latest.count_id, latest.rejection_id},
    }
