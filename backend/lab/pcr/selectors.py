"""PCR reads: derived status, eligible samples and display snapshots (names, never raw ids)."""

from typing import Any

from django.db.models import Exists, OuterRef, Q, QuerySet

from accounts.models import User
from lab.pcr.models import TRANSITIONS, PcrBatch, PcrBatchEvent, PcrResult
from lab.pcr.permissions import PCR_MANAGE
from lab.samples.models import WolbachiaSample
from lab.samples.selectors import filter_samples, scoped_samples
from uploads.access import UploadActor


def _live_transitions(events: list[PcrBatchEvent]) -> list[PcrBatchEvent]:
    undone = {event.undoes_id for event in events if event.kind == "undo"}
    return [event for event in events if event.kind in TRANSITIONS and event.pk not in undone]


def _events(batch: PcrBatch) -> list[PcrBatchEvent]:
    cached = getattr(batch, "_prefetched_objects_cache", {}).get("events")
    if cached is not None:
        return sorted(cached, key=lambda event: event.created_at)
    return list(batch.events.order_by("created_at"))


def batch_status(batch: PcrBatch) -> str:
    events = _events(batch)
    if any(event.kind == "void" for event in events):
        return "voided"
    status = "preparing"
    for event in _live_transitions(events):
        status = TRANSITIONS[event.kind][1]
    return status


def latest_live_transition(batch: PcrBatch) -> PcrBatchEvent | None:
    live = _live_transitions(_events(batch))
    return live[-1] if live else None


def current_results(batch: PcrBatch) -> list[PcrResult]:
    """The latest non-voided, non-superseded result per sample and target."""
    return list(
        PcrResult.objects.filter(batch=batch, void__isnull=True, superseded_by__isnull=True)
        .select_related("sample")
        .order_by("sample__code", "target")
    )


def live_batches(organization: Any) -> QuerySet[PcrBatch]:  # noqa: ANN401
    return PcrBatch.objects.filter(organization=organization).exclude(events__kind="void")


def eligible_samples(actor: UploadActor) -> QuerySet[WolbachiaSample]:
    """Collected, not voided, without a valid result and not in another live PCR batch."""
    rows = filter_samples(scoped_samples(actor, PCR_MANAGE), {"pending_result": True})
    in_batch = live_batches(actor.organization).filter(samples__sample_id=OuterRef("pk"))
    return rows.annotate(in_pcr=Exists(in_batch)).filter(in_pcr=False)


def batches(organization: Any) -> QuerySet[PcrBatch]:  # noqa: ANN401
    return (
        PcrBatch.objects.filter(organization=organization)
        .select_related("external_lab")
        .prefetch_related("events", "samples")
    )


STATUS_ORDER = (
    "preparing",
    "ready_to_ship",
    "shipped",
    "received_by_lab",
    "results_received",
    "closed",
    "voided",
)


def status_filter(rows: QuerySet[PcrBatch], status: str) -> list[PcrBatch]:
    return [row for row in rows if batch_status(row) == status]


def _user_names(identifiers: set[Any]) -> dict[Any, str]:
    return {
        user.pk: (user.get_full_name() or user.get_username())
        for user in User.objects.filter(pk__in={value for value in identifiers if value})
    }


def _shipping(batch: PcrBatch) -> PcrBatchEvent | None:
    return next(
        (event for event in reversed(_live_transitions(_events(batch))) if event.kind == "ship"),
        None,
    )


def batch_row(batch: PcrBatch) -> dict[str, Any]:
    shipped = _shipping(batch)
    return {
        "id": str(batch.pk),
        "code": batch.code,
        "external_lab_id": str(batch.external_lab_id),
        "external_lab_name": batch.external_lab.name,
        "targets": list(batch.targets),
        "sample_count": len(batch.samples.all()),
        "status": batch_status(batch),
        "shipped_at": shipped.occurred_at.isoformat() if shipped else None,
        "created_at": batch.created_at.isoformat(),
    }


def _sample_entry(sample: WolbachiaSample) -> dict[str, Any]:
    quadrant = sample.quadrant
    reading = sample.reading
    return {
        "id": str(sample.pk),
        "code": sample.code,
        "quadrant_code": quadrant.code if quadrant else None,
        "quadrant_name": quadrant.name if quadrant else None,
        "center_name": sample.center.name,
        "epi_week": reading.epi_week if reading else None,
        "collected_at": sample.device_time.isoformat(),
    }


def eligible_sample_row(sample: WolbachiaSample) -> dict[str, Any]:
    return _sample_entry(sample)


def batch_detail(batch: PcrBatch) -> dict[str, Any]:
    events = _events(batch)
    undone = {event.undoes_id for event in events if event.kind == "undo"}
    results = list(
        PcrResult.objects.filter(batch=batch)
        .select_related("void", "sample")
        .order_by("created_at")
    )
    reports = list(batch.reports.select_related("document").order_by("created_at"))
    names = _user_names(
        {batch.created_by_id}
        | {event.created_by_id for event in events}
        | {result.created_by_id for result in results}
        | {report.created_by_id for report in reports}
    )
    superseded = {result.supersedes_id for result in results if result.supersedes_id}
    entries = batch.samples.select_related(
        "sample__quadrant", "sample__center", "sample__reading"
    ).order_by("sample__code")
    return {
        **batch_row(batch),
        "external_lab": {
            "id": str(batch.external_lab_id),
            "name": batch.external_lab.name,
            "contact": batch.external_lab.contact,
            "address": batch.external_lab.address,
        },
        "notes": batch.notes,
        "author_name": names.get(batch.created_by_id, ""),
        "samples": [_sample_entry(entry.sample) for entry in entries],
        "events": [
            {
                "id": str(event.pk),
                "kind": event.kind,
                "occurred_at": event.occurred_at.isoformat(),
                "created_at": event.created_at.isoformat(),
                "author_name": names.get(event.created_by_id, ""),
                "carrier": event.carrier,
                "tracking_number": event.tracking_number,
                "has_evidence": event.evidence_id is not None,
                "evidence_type": event.evidence.content_type if event.evidence_id else None,
                "undone": event.pk in undone,
                "reason": event.reason,
            }
            for event in events
        ],
        "results": [
            {
                "id": str(result.pk),
                "sample_id": str(result.sample_id),
                "sample_code": result.sample.code,
                "target": result.target,
                "outcome": result.outcome,
                "serotype": result.serotype,
                "ct_value": None if result.ct_value is None else str(result.ct_value),
                "author_name": names.get(result.created_by_id, ""),
                "created_at": result.created_at.isoformat(),
                "current": not hasattr(result, "void") and result.pk not in superseded,
                "voided": hasattr(result, "void"),
                "void_reason": result.void.reason if hasattr(result, "void") else "",
                "superseded": result.pk in superseded,
            }
            for result in results
        ],
        "reports": [
            {
                "id": str(report.pk),
                "content_type": report.document.content_type,
                "size_bytes": report.document.size_bytes,
                "author_name": names.get(report.created_by_id, ""),
                "created_at": report.created_at.isoformat(),
            }
            for report in reports
        ],
    }


def batch_summary(organization: Any) -> dict[str, int]:  # noqa: ANN401
    """Lab home: batches in progress, and batches waiting for the external lab's results."""
    in_process = pending = 0
    for batch in batches(organization):
        status = batch_status(batch)
        if status in {"preparing", "ready_to_ship", "shipped", "received_by_lab"}:
            in_process += 1
        if status in {"shipped", "received_by_lab"}:
            pending += 1
    return {"in_process": in_process, "pending_results": pending}


def search_batches(rows: QuerySet[PcrBatch], search: str) -> QuerySet[PcrBatch]:
    if not search:
        return rows
    return rows.filter(Q(code__icontains=search) | Q(external_lab__name__icontains=search))
