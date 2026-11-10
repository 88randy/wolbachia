"""Current complete action scope precedes sample filters, counts and paging."""

from typing import Any, cast

from django.db.models import Count, OuterRef, Prefetch, Q, QuerySet, Subquery

from inventory.transfers.scope import paired_query
from lab.methods import method_pin
from lab.samples.models import SampleReceipt, WolbachiaResultAttempt, WolbachiaSample
from lab.samples.sources import resolve_source
from reviews.effect_receipts import effective_effects, is_effective
from uploads.access import UploadActor, current_scope


def sample_pair_query(grant: Any, prefix: str = "") -> Q:  # noqa: ANN401 -- canonical paired WorkScope
    result = paired_query(grant, prefix + "center_id", prefix + "quadrant_id")
    for relation, center, quadrant in (
        (
            "reading",
            "reading__ovitrap__sampling_point__block__quadrant__center_id",
            "reading__ovitrap__sampling_point__block__quadrant_id",
        ),
        ("lot", "lot__center_id", "lot__quadrant_id"),
        (
            "release",
            "release__permit_version__permit__center_id",
            "release__permit_version__permit__quadrant_id",
        ),
    ):
        result &= Q(**{prefix + relation + "__isnull": True}) | paired_query(
            grant, prefix + center, prefix + quadrant
        )
    return result


def sample_rows(actor: UploadActor, permission: str) -> QuerySet[WolbachiaSample]:
    """One grant covers both retained sample scope and the actual source context."""
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if permission in codes:
            allowed |= sample_pair_query(grant)
    return (
        WolbachiaSample.objects.filter(organization=actor.organization)
        .filter(allowed)
        .select_related(
            "event",
            "method_version",
            "lot",
            "release__permit_version__permit",
            "reading__event",
            "reading__ovitrap__event",
        )
    )


def sample_contexts(sample: WolbachiaSample) -> list[dict[str, str | None]]:
    source = resolve_source(sample.organization, sample.event.payload["source_ref"])
    return [
        {
            "center_id": str(sample.center_id),
            "quadrant_id": str(sample.quadrant_id) if sample.quadrant_id else None,
        },
        {
            "center_id": str(source.center_id),
            "quadrant_id": str(source.quadrant_id) if source.quadrant_id else None,
        },
    ]


def scoped_samples(
    actor: UploadActor, permission: str = "sample.read"
) -> QuerySet[WolbachiaSample]:
    allowed = Q(pk__in=[])
    for codes, scope in current_scope(actor).grants:
        if permission not in codes:
            continue
        grant = Q(pk__isnull=False)
        if scope["centers"]["mode"] != "all":
            grant &= Q(
                center_id__in=scope["centers"]["ids"]
                if scope["centers"]["mode"] == "selected"
                else []
            )
        if scope["quadrants"]["mode"] != "all":
            grant &= Q(quadrant_id__isnull=True) | Q(
                quadrant_id__in=scope["quadrants"]["ids"]
                if scope["quadrants"]["mode"] == "selected"
                else []
            )
        allowed |= grant
    attempts = WolbachiaResultAttempt.objects.select_related(
        "method_version", "method_verification"
    ).order_by("revision")
    return (
        WolbachiaSample.objects.filter(organization=actor.organization)
        .filter(allowed)
        .select_related("event", "method_version", "receipt")
        .prefetch_related(Prefetch("attempts", queryset=attempts))
    )


def filter_samples(
    rows: QuerySet[WolbachiaSample], values: dict[str, Any]
) -> QuerySet[WolbachiaSample]:
    """Human code and ordering are owned by the shared table filters."""
    rows = rows.filter(
        **{f"{key}_id": values[key] for key in ("center", "quadrant") if key in values}
    )
    if not values.get("include_voided", False):
        rows = rows.filter(event__voided_at__isnull=True)
    if values.get("pending_result", False):
        latest = WolbachiaResultAttempt.objects.filter(sample_id=OuterRef("pk")).order_by(
            "-revision"
        )
        rows = rows.annotate(latest_status=Subquery(latest.values("status")[:1])).filter(
            Q(latest_status__isnull=True) | ~Q(latest_status="valid")
        )
    return rows


def attempt_snapshot(attempt: WolbachiaResultAttempt) -> dict[str, Any]:
    return {
        "id": str(attempt.pk),
        "command_id": str(attempt.command_id),
        "revision": attempt.revision,
        "status": attempt.status,
        "result": attempt.result,
        "method_version_id": str(attempt.method_version_id),
        "method": method_pin(attempt.method_version),
        "method_verification_id": str(attempt.method_verification_id),
        "repeat_of": None if attempt.repeat_of_id is None else str(attempt.repeat_of_id),
        "author_id": str(attempt.created_by_id),
        "created_at": attempt.created_at.isoformat(),
    }


def receipt_snapshot(receipt: SampleReceipt) -> dict[str, Any]:
    return {
        "id": str(receipt.pk),
        "command_id": str(receipt.command_id),
        "receiver_id": str(receipt.created_by_id),
        "created_at": receipt.created_at.isoformat(),
    }


def valid_results(rows: QuerySet[WolbachiaSample]) -> QuerySet[WolbachiaSample]:
    """Additive read for the dashboards: same valid-result rule as `prevalence_inputs`.

    Effective samples whose latest attempt is valid, annotated with `selected_result`.
    """
    latest = WolbachiaResultAttempt.objects.filter(sample_id=OuterRef("pk")).order_by("-revision")
    return cast(
        "QuerySet[WolbachiaSample]",
        effective_effects(rows, "event")
        .annotate(
            selected_status=Subquery(latest.values("status")[:1]),
            selected_result=Subquery(latest.values("result")[:1]),
        )
        .filter(selected_status="valid", selected_result__in=["positive", "negative"]),
    )


def prevalence_inputs(rows: QuerySet[WolbachiaSample]) -> dict[str, int | float | None]:
    """Return the valid-positive / valid-tested fraction; an empty denominator is unknown."""
    latest = WolbachiaResultAttempt.objects.filter(sample_id=OuterRef("pk")).order_by("-revision")
    tested = (
        effective_effects(rows, "event")
        .annotate(
            selected_status=Subquery(latest.values("status")[:1]),
            selected_result=Subquery(latest.values("result")[:1]),
        )
        .filter(selected_status="valid", selected_result__in=["positive", "negative"])
    )
    totals = tested.aggregate(
        tested=Count("pk", distinct=True),
        positive=Count("pk", distinct=True, filter=Q(selected_result="positive")),
    )
    return {
        **totals,
        "prevalence": None if totals["tested"] == 0 else totals["positive"] / totals["tested"],
    }


def sample_snapshot(sample: WolbachiaSample) -> dict[str, Any]:
    """An invalid, disputed, absent or voided result contributes neither numerator nor denominator."""
    attempts = [attempt_snapshot(attempt) for attempt in sample.attempts.all()]
    latest = attempts[-1] if attempts else None
    selected = latest if latest is not None and latest["status"] == "valid" else None
    eligible = selected is not None and is_effective(sample.event)
    receipt = getattr(sample, "receipt", None)
    result_status = (
        "missing" if latest is None else (latest["result"] if selected else latest["status"])
    )
    return {
        "id": str(sample.pk),
        "code": sample.code,
        "event_id": str(sample.event_id),
        "origin_snapshot": sample.origin_snapshot,
        "other_text": sample.other_text,
        "center_id": str(sample.center_id),
        "quadrant_id": None if sample.quadrant_id is None else str(sample.quadrant_id),
        "reading_id": None if sample.reading_id is None else str(sample.reading_id),
        "lot_id": None if sample.lot_id is None else str(sample.lot_id),
        "release_id": None if sample.release_id is None else str(sample.release_id),
        "method_version_id": str(sample.method_version_id),
        "method": method_pin(sample.method_version),
        "location": sample.location,
        "source_provenance": sample.source_provenance,
        "device_time": sample.device_time.isoformat(),
        "server_received_at": sample.server_received_at.isoformat(),
        "collector_id": str(sample.created_by_id),
        "created_at": sample.created_at.isoformat(),
        "voided": sample.event.voided_at is not None,
        "receipt": None if receipt is None else receipt_snapshot(receipt),
        "attempts": attempts,
        "selected_valid_result": selected,
        "result_status": result_status,
        "numerator_eligible": eligible and cast(dict[str, Any], selected)["result"] == "positive",
        "denominator_eligible": eligible,
    }
