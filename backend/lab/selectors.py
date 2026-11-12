"""Current action scope precedes state filters, count, order and page."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import (
    Case,
    CharField,
    Exists,
    OuterRef,
    Prefetch,
    QuerySet,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce
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
    rows: QuerySet[Any] = model.objects.select_related(
        "bag", "method_version", "result_revision", "void_fact"
    ).filter(
        organization=actor.organization, bag__in=filter_bags(scoped_bags(actor, COUNT_READ), values)
    )
    if model is EggCountAttempt:
        from lab.independent_qa.selectors import blind_visible_counts

        rows = blind_visible_counts(actor, rows)
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
    return rows.select_related("bag").order_by(values.get("ordering", "-created_at"), "id")


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
        "bag_code": discrepancy.bag.code,
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
    if isinstance(target, EggCountAttempt):
        from lab.independent_qa.services import NumericPublication, publish_numeric_access

        publish_numeric_access(actor, target, NumericPublication(COUNT_VOID, "void_context"))
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
    from lab.independent_qa.selectors import matching_cause_rows
    from lab.models import RecountAttempt, RecountResolution, RecountRevision

    rows = RecountRequest.objects.filter(
        organization=actor.organization,
        count__in=result_rows(actor, EggCountAttempt, {**values, "include_voided": True}),
    )
    if "superseded" in values:
        rows = rows.filter(supersession__isnull=not values["superseded"])
    current = LabResultRevision.objects.filter(bag_id=OuterRef("count__bag_id")).order_by(
        "-revision"
    )
    revisions = RecountRevision.objects.filter(request_id=OuterRef("pk"))
    latest_resolution = RecountResolution.objects.filter(
        request_id=OuterRef("request_id")
    ).order_by("-qa_revision__revision")
    resolutions = matching_cause_rows(
        RecountResolution.objects.filter(pk=Subquery(latest_resolution.values("pk")[:1])),
        "comparison_proof",
    )
    return cast(
        QuerySet[RecountRequest],
        rows.annotate(
            _current_count=Subquery(current.values("count_id")[:1]),
            _qa_revision=Coalesce(Subquery(revisions.values("revision")[:1]), Value(0)),
        )
        .select_related(
            "count__method_version",
            "count__receipt__reading",
            "count__result_revision",
            "supersession",
        )
        .prefetch_related(
            "causes",
            Prefetch(
                "attempts",
                queryset=RecountAttempt.objects.select_related("method_version", "claim").order_by(
                    "role"
                ),
                to_attr="read_attempts",
            ),
            Prefetch(
                "resolutions",
                queryset=resolutions.select_related("qa_revision"),
                to_attr="read_resolutions",
            ),
        )
        .order_by(values.get("ordering", "-created_at"), "id"),
    )


def independent_request_projection(request: Any) -> dict[str, Any] | None:  # noqa: ANN401 -- actual annotated/prefetched RecountRequest, bounded real candidates.
    """Called only after COUNT_READ plus central numeric publication authorization."""
    from lab.methods import method_pin

    if hasattr(request, "supersession") or request._current_count != request.count_id:
        return None
    first_result = request.count.result_revision
    attempts = [
        attempt
        for attempt in request.read_attempts
        if attempt.claim.first_result_id == first_result.pk
    ]
    candidates = []
    for candidate in (request.count, *attempts):
        candidates.append(
            {
                "candidate_kind": "first"
                if isinstance(candidate, EggCountAttempt)
                else candidate.role,
                "id": str(candidate.pk),
                "value": candidate.value,
                "viable_eggs": candidate.viable_eggs,
                "total_examined": candidate.total_examined,
                "viability_percent": None
                if candidate.viability_percent is None
                else str(candidate.viability_percent),
                "viability_reason": candidate.viability_reason,
                "method_version": None
                if candidate.method_version_id is None
                else str(candidate.method_version_id),
                "method": method_pin(candidate.method_version),
                "verification_id": None
                if candidate.verification_id is None
                else str(candidate.verification_id),
                "created_at": candidate.created_at.isoformat(),
                "created_by": str(candidate.created_by_id),
            }
        )
    causes = sorted(str(cause.pk) for cause in request.causes.all())
    resolution = next(
        (
            row
            for row in request.read_resolutions
            if row.first_result_id == first_result.pk
            and row.comparison_proof.get("cause_ids") == causes
        ),
        None,
    )
    chosen_kind = (
        None
        if resolution is None
        else "first"
        if resolution.selected_count_id is not None
        else next(
            candidate["candidate_kind"]
            for candidate in candidates
            if candidate["id"] == str(resolution.selected_attempt_id)
            and candidate["candidate_kind"] != "first"
        )
    )
    return {
        "first_result_id": str(first_result.pk),
        "expected_result_revision": first_result.revision,
        "expected_revision": request._qa_revision,
        "candidates": candidates,
        "resolution": None
        if resolution is None
        else {
            "id": str(resolution.pk),
            "candidate_kind": chosen_kind,
            "final_attempt_id": str(resolution.selected_count_id or resolution.selected_attempt_id),
            "revision": resolution.qa_revision.revision,
            "reason_code": resolution.reason_code,
            "reason": resolution.reason,
            "created_at": resolution.created_at.isoformat(),
            "created_by": str(resolution.created_by_id),
        },
    }


def annotate_lab_bags(rows: QuerySet[Bag]) -> QuerySet[Bag]:
    from lab.independent_qa.selectors import matching_cause_rows
    from lab.models import RecountResolution

    latest = LabResultRevision.objects.filter(bag=OuterRef("pk")).order_by("-revision")
    effective = effective_effects(Bag.objects.filter(pk=OuterRef("pk")), "reading__event")
    rows = rows.annotate(
        lab_effective=Exists(effective),
        lab_current_count=Subquery(latest.values("count_id")[:1]),
        lab_current_rejection=Subquery(latest.values("rejection_id")[:1]),
        lab_revision=Subquery(latest.values("revision")[:1]),
    )
    return rows.annotate(
        lab_has_qa=Exists(
            RecountRequest.objects.filter(
                count_id=OuterRef("lab_current_count"), supersession__isnull=True
            ).exclude(
                pk__in=matching_cause_rows(
                    RecountResolution.objects.all(), "comparison_proof"
                ).values("request_id")
            )
        ),
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


@dataclass(frozen=True)
class BagLabFacts:
    """Facts `bag_lab_projection` reads for a set of bags, loaded in constant queries."""

    latest: dict[UUID, LabResultRevision]
    effective: set[UUID]
    missing: set[UUID]
    material: dict[UUID, dict[str, Any]]


def bag_lab_facts(bags: Sequence[Bag]) -> BagLabFacts:
    from inventory.allocations.models import BagDisposition
    from lab.models import PaddleReuse

    ids = [bag.pk for bag in bags]
    latest: dict[UUID, LabResultRevision] = {}
    revisions = (
        LabResultRevision.objects.filter(bag_id__in=ids)
        .select_related("count__recount_request")
        .order_by("bag_id", "-revision")
    )
    for revision in revisions:
        latest.setdefault(revision.bag_id, revision)
    dispositions: dict[UUID, Any] = {}
    for disposition in BagDisposition.objects.filter(bag_id__in=ids).order_by(
        *(BagDisposition._meta.ordering or ["pk"])
    ):
        dispositions.setdefault(disposition.bag_id, disposition)
    reused = set(
        PaddleReuse.objects.filter(binding__bag_id__in=ids).values_list(
            "binding__bag_id", flat=True
        )
    )
    return BagLabFacts(
        latest=latest,
        effective=set(
            effective_effects(Bag.objects.filter(pk__in=ids), "reading__event").values_list(
                "pk", flat=True
            )
        ),
        missing=set(
            ReceptionDiscrepancy.objects.filter(bag_id__in=ids, kind="missing").values_list(
                "bag_id", flat=True
            )
        ),
        material={
            identifier: _material(dispositions.get(identifier), identifier in reused)
            for identifier in ids
        },
    )


def _material(disposition: Any, reused: bool) -> dict[str, Any]:  # noqa: ANN401 -- BagDisposition row
    """Same shape and rules as `inventory.allocations.bag_dependencies.material_availability`."""
    return {
        "available": disposition is None and not reused,
        "disposition_id": None if disposition is None else str(disposition.pk),
        "reason": "bag_disposed"
        if disposition is not None
        else "paddle_reused"
        if reused
        else None,
    }


def bag_lab_projection(bag: Bag, facts: BagLabFacts | None = None) -> dict[str, Any]:
    facts = facts or bag_lab_facts([bag])
    receipt = getattr(bag, "lab_receipt", None)
    latest = facts.latest.get(bag.pk)
    if bag.pk not in facts.effective:
        status = "no_effective_reading"
    elif latest is not None and latest.count is not None:
        from lab.independent_qa.selectors import obligation_resolution

        request = getattr(latest.count, "recount_request", None)
        status = (
            "awaiting_independent_qa"
            if request is not None and obligation_resolution(request, latest) is None
            else "counted"
        )
    elif latest is not None and latest.rejection_id is not None:
        status = "rejected"
    elif receipt is not None:
        status = "voided" if latest is not None else "pending_count"
    else:
        status = "missing" if bag.pk in facts.missing else "expected"
    return {
        "material": facts.material[bag.pk],
        "status": status,
        "revision": 0 if latest is None else latest.revision,
        "receipt_id": None if receipt is None else str(receipt.pk),
        "count_id": None if latest is None or latest.count_id is None else str(latest.count_id),
        "rejection_id": None
        if latest is None or latest.rejection_id is None
        else str(latest.rejection_id),
    }


def published_bag_lab_page(
    actor: UploadActor, bags: Sequence[Bag]
) -> dict[UUID, dict[str, Any] | None]:
    """The `lab` block of every bag of a page: None when the actor may not read it.

    Same rules as reading each bag alone (action scope, then blind visibility of the current
    count, then a recorded disclosure), but with one lock, one visibility query per permission
    and one disclosure insert for the page.
    """
    from lab.independent_qa.selectors import blind_visible_counts
    from lab.independent_qa.services import (
        NumericPublication,
        numeric_read_transaction,
        publish_numeric_access_batch,
    )

    page: dict[UUID, dict[str, Any] | None] = {bag.pk: None for bag in bags}
    if not bags:
        return page
    ids = [bag.pk for bag in bags]
    permission_by_bag: dict[UUID, str] = {}
    for code in (BAG_RECEIVE, COUNT_READ):
        for identifier in scoped_bags(actor, code).filter(pk__in=ids).values_list("pk", flat=True):
            permission_by_bag.setdefault(identifier, code)
    granted = [bag for bag in bags if bag.pk in permission_by_bag]
    if not granted:
        return page
    with numeric_read_transaction(actor):
        facts = bag_lab_facts(granted)
        counts: dict[UUID, EggCountAttempt] = {}
        for bag in granted:
            revision = facts.latest.get(bag.pk)
            if revision is not None and revision.count is not None:
                counts[bag.pk] = revision.count
        visible = set(
            blind_visible_counts(
                actor, EggCountAttempt.objects.filter(pk__in={c.pk for c in counts.values()})
            ).values_list("pk", flat=True)
        )
        readable = [bag for bag in granted if bag.pk not in counts or counts[bag.pk].pk in visible]
        for code in (BAG_RECEIVE, COUNT_READ):
            published = [
                counts[bag.pk]
                for bag in readable
                if bag.pk in counts and permission_by_bag[bag.pk] == code
            ]
            publish_numeric_access_batch(actor, published, NumericPublication(code, "result"))
        for bag in readable:
            page[bag.pk] = bag_lab_projection(bag, facts)
    return page


def result_projection(
    result: EggCountAttempt | LabRejection, facts: BagLabFacts | None = None
) -> dict[str, Any]:
    """`facts` (from `result_page_facts`) spares the per-result lookups when listing a page."""
    facts = facts or bag_lab_facts([result.bag])
    projection = (
        count_projection(result)
        if isinstance(result, EggCountAttempt)
        else rejection_projection(result)
    )
    latest = facts.latest.get(result.bag_id)
    return {
        **projection,
        "material": facts.material[result.bag_id],
        "current_revision": 0 if latest is None else latest.revision,
        "is_current": latest is not None and result.pk in {latest.count_id, latest.rejection_id},
    }


def result_page_facts(results: Sequence[EggCountAttempt | LabRejection]) -> BagLabFacts:
    return bag_lab_facts([result.bag for result in results])


def published_result_projection(
    actor: UploadActor, result: EggCountAttempt | LabRejection
) -> dict[str, Any]:
    if isinstance(result, EggCountAttempt):
        from lab.independent_qa.services import NumericPublication, publish_numeric_access

        publish_numeric_access(actor, result, NumericPublication(COUNT_READ, "result"))
    return result_projection(result)


def publish_result_page(
    actor: UploadActor, results: Sequence[EggCountAttempt | LabRejection]
) -> None:
    """Record the numeric disclosure of every count of a page (rejections carry no number)."""
    from lab.independent_qa.services import NumericPublication, publish_numeric_access_batch

    counts = [result for result in results if isinstance(result, EggCountAttempt)]
    publish_numeric_access_batch(actor, counts, NumericPublication(COUNT_READ, "result"))
