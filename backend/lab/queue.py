"""Count eligibility is a scoped effective-source SQL predicate, never a field count."""

from typing import Any, cast

from django.db.models import F, OuterRef, QuerySet, Subquery

from core.time import server_now
from lab.access import scoped_bags
from lab.models import LabResultRevision
from lab.permissions import COUNT_CREATE
from ovitraps.models import Bag
from reviews.effect_receipts import effective_effects
from uploads.access import UploadActor


def current_lab_queue(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Bag]:
    latest = LabResultRevision.objects.filter(bag=OuterRef("pk")).order_by("-revision")
    rows = (
        effective_effects(scoped_bags(actor, COUNT_CREATE), "reading__event")
        .filter(
            reading__paddle_present=True,
            lab_receipt__isnull=False,
            event_id=F("reading__event_id"),
            collector_id=F("reading__event__created_by_id"),
        )
        .annotate(
            current_count=Subquery(latest.values("count_id")[:1]),
            current_rejection=Subquery(latest.values("rejection_id")[:1]),
            current_revision=Subquery(latest.values("revision")[:1]),
        )
        .filter(current_count__isnull=True, current_rejection__isnull=True)
    )
    fields = {
        "center": "reading__ovitrap__sampling_point__block__quadrant__center_id",
        "quadrant": "reading__ovitrap__sampling_point__block__quadrant_id",
        "point": "reading__ovitrap__sampling_point_id",
        "week": "reading__epi_week",
        "code": "code",
    }
    rows = rows.filter(**{lookup: values[key] for key, lookup in fields.items() if key in values})
    ordering = values.get("ordering", "created_at")
    if ordering.removeprefix("-") not in {"created_at", "code"}:
        from core.exceptions import FieldValidationError

        raise FieldValidationError("ordering", "invalid_choice")
    return cast(QuerySet[Bag], rows.order_by(ordering, "id"))


def queue_candidate(bag: Bag) -> dict[str, Any]:
    return {
        "id": str(bag.pk),
        "code": bag.code,
        "reading_id": str(bag.reading_id),
        "expected_revision": getattr(bag, "current_revision", None) or 0,
        "has_eggs": bag.reading.has_eggs,
        "is_lagged": bag.reading.is_lagged,
        "is_index_excluded": bag.reading.is_index_excluded,
    }


def next_queue_snapshot(actor: UploadActor, bag: Bag, values: dict[str, Any]) -> dict[str, Any]:
    context = values.get("queue_context", {})
    candidate = current_lab_queue(actor, context).exclude(pk=bag.pk).first()
    return {
        "next_bag": None if candidate is None else queue_candidate(candidate),
        "queue_snapshot": {"as_of": server_now().isoformat(), "context": context},
    }
