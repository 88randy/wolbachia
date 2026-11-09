"""Lab facts use the public history publisher and the authentic prepared source recipient."""

from typing import Any, cast
from uuid import UUID

from lab.models import (
    BagReceipt,
    EggCountAttempt,
    LabRejection,
    LabResultVoid,
    PaddleReuse,
    ReceptionDiscrepancy,
    ReceptionIncidentLink,
    RecountAttempt,
    RecountResolution,
)
from lab.transactions import require_lab_lock, require_prepared_author, require_prepared_collector
from ovitraps.models import OvitrapReading
from reviews.history import publish_history
from reviews.scope import SubjectFacts

KINDS = {
    "bagreceipt": "lab_receipt",
    "receptiondiscrepancy": "lab_discrepancy",
    "eggcountattempt": "lab_count",
    "labresultvoid": "lab_void",
    "labrejection": "lab_rejection",
}
LabHistoryFact = (
    BagReceipt
    | EggCountAttempt
    | LabRejection
    | LabResultVoid
    | ReceptionDiscrepancy
    | RecountAttempt
    | RecountResolution
    | PaddleReuse
)
HISTORY_MODELS = {
    "lab_receipt": BagReceipt,
    "lab_discrepancy": ReceptionDiscrepancy,
    "lab_count": EggCountAttempt,
    "lab_void": LabResultVoid,
    "lab_rejection": LabRejection,
    "lab_recount": RecountAttempt,
    "lab_adjudication": RecountResolution,
    "lab_paddle_reuse": PaddleReuse,
}


def fact_reading(fact: LabHistoryFact) -> OvitrapReading:
    if isinstance(fact, (RecountAttempt, RecountResolution)):
        return fact.request.count.receipt.reading
    if isinstance(fact, PaddleReuse):
        return fact.binding.bag.reading
    if isinstance(fact, BagReceipt):
        return fact.reading
    if isinstance(fact, LabResultVoid):
        target = fact.count or fact.rejection
        if target is None:
            raise RuntimeError("A retained void requires its exact result")
        return target.bag.reading
    return fact.bag.reading


def qa_state(count: EggCountAttempt) -> str:
    request = getattr(count, "recount_request", None)
    if request is None:
        return "not_requested"
    return "superseded" if hasattr(request, "supersession") else "awaiting_independent_qa"


def fact_details(fact: LabHistoryFact) -> dict[str, Any]:
    details: dict[str, Any] = {
        "count_id": None,
        "rejection_id": None,
        "value": None,
        "viability_percent": None,
        "qa_state": "not_requested",
        "voided": False,
        "incident_id": None,
        "configuration_pending": False,
        "method_version_id": None,
        "reason": None,
    }
    if isinstance(fact, EggCountAttempt):
        details["count_id"] = str(fact.pk)
        details.update(
            value=fact.value,
            viability_percent=None
            if fact.viability_percent is None
            else str(fact.viability_percent),
            qa_state=qa_state(fact),
            voided=hasattr(fact, "void_fact"),
            method_version_id=None
            if fact.method_version_id is None
            else str(fact.method_version_id),
        )
    if isinstance(fact, (LabRejection, LabResultVoid, ReceptionDiscrepancy)):
        details["reason"] = fact.reason
    if isinstance(fact, LabRejection):
        details["rejection_id"] = str(fact.pk)
        details.update(
            voided=hasattr(fact, "void_fact"), method_version_id=str(fact.method_version_id)
        )
    if isinstance(fact, ReceptionDiscrepancy):
        link = ReceptionIncidentLink.objects.filter(discrepancy=fact).first()
        details.update(
            incident_id=None if link is None else str(link.incident_id),
            configuration_pending=link is None,
        )
    if isinstance(fact, LabResultVoid):
        details.update(
            count_id=None if fact.count_id is None else str(fact.count_id),
            rejection_id=None if fact.rejection_id is None else str(fact.rejection_id),
            voided=True,
        )
    return details


def publish_lab_fact(fact: LabHistoryFact) -> None:
    require_lab_lock(fact.organization_id)
    require_prepared_author(fact.created_by_id)
    reading = fact_reading(fact)
    collector = reading.event.created_by
    if collector is None:
        raise RuntimeError("A real prepared source collector is required")
    require_prepared_collector(collector.pk)
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    bag = getattr(reading, "bag", None)
    payload = {
        "id": str(fact.pk),
        "kind": KINDS[str(fact._meta.model_name)],
        "bag_id": None if bag is None else str(bag.pk),
        "reading_id": str(reading.pk),
        "source_event_id": str(reading.event_id),
        "recorded_at": fact.created_at.isoformat(),
        "author_id": str(fact.created_by_id),
        "source_device_time": reading.event.device_time.isoformat(),
        "source_server_received_at": reading.event.server_received_at.isoformat(),
        "subjects": [{"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)}],
        **fact_details(fact),
    }
    publish_history(KINDS[str(fact._meta.model_name)], fact, collector, payload)


def lab_history_subjects(
    organization_id: UUID, courier_id: UUID, identity: tuple[str, UUID]
) -> SubjectFacts:
    kind, identifier = identity
    model = HISTORY_MODELS.get(kind)
    if model is None:
        return SubjectFacts()
    fact = cast(
        LabHistoryFact | None,
        model.objects.filter(organization_id=organization_id, pk=identifier).first(),
    )
    if fact is None:
        return SubjectFacts()
    reading = fact_reading(fact)
    if reading.event.created_by_id != courier_id:
        return SubjectFacts()
    if isinstance(fact, PaddleReuse):
        from lab.independent_qa.paddles import fact_contexts
        from lab.permissions import PADDLE_REUSE

        return SubjectFacts(
            True,
            tuple(fact_contexts(fact)),
            "lab_paddle",
            fact.pk,
            {"own_permission": PADDLE_REUSE},
        )
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    return SubjectFacts(
        True,
        ({"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)},),
        "lab",
        reading.pk,
    )


def publish_qa_fact(fact: RecountAttempt | RecountResolution | PaddleReuse) -> None:
    require_lab_lock(fact.organization_id)
    require_prepared_author(fact.created_by_id)
    reading = (
        fact.request.count.receipt.reading
        if not isinstance(fact, PaddleReuse)
        else fact.binding.bag.reading
    )
    collector = reading.event.created_by
    if collector is None:
        raise RuntimeError("A retained source requires its authentic collector")
    require_prepared_collector(collector.pk)
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    request = None if isinstance(fact, PaddleReuse) else fact.request
    count_id = (
        fact.first_result.count_id if isinstance(fact, PaddleReuse) else fact.request.count_id
    )
    kind = (
        "lab_recount"
        if isinstance(fact, RecountAttempt)
        else "lab_adjudication"
        if isinstance(fact, RecountResolution)
        else "lab_paddle_reuse"
    )
    value = fact.value if isinstance(fact, RecountAttempt) else None
    if isinstance(fact, RecountResolution):
        selected = fact.selected_count if fact.selected_count is not None else fact.selected_attempt
        if selected is None:
            raise RuntimeError("A resolution requires its actual typed candidate")
        value = selected.value
    payload = {
        "id": str(fact.pk),
        "kind": kind,
        "bag_id": str(reading.bag.pk),
        "reading_id": str(reading.pk),
        "source_event_id": str(reading.event_id),
        "source_device_time": reading.event.device_time.isoformat(),
        "source_server_received_at": reading.event.server_received_at.isoformat(),
        "recorded_at": fact.created_at.isoformat(),
        "author_id": str(fact.created_by_id),
        "count_id": str(count_id),
        "request_id": None if request is None else str(request.pk),
        "value": value,
        "attempt_id": str(fact.pk) if isinstance(fact, RecountAttempt) else None,
        "resolution_id": str(fact.pk) if isinstance(fact, RecountResolution) else None,
        "reuse_id": str(fact.pk) if isinstance(fact, PaddleReuse) else None,
        "method_version_id": str(fact.method_version_id)
        if not isinstance(fact, RecountResolution)
        else None,
        "subjects": [{"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)}],
    }
    publish_history(kind, fact, collector, payload)
