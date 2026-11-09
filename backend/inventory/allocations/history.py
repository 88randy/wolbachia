"""Authentic post-store links and one existing typed history publisher, without synthetic FE."""

from typing import Any
from uuid import UUID

from core.models import OrgScopedModel
from field_sync.models import FieldEvent
from inventory.allocations.models import (
    BagDisposition,
    InventoryIntentExecution,
    OriginReleaseProof,
    ReleaseCancellation,
    ReturnAcceptance,
    SupplyAssignment,
    SupplyAssignmentVersion,
    SupplyDiscrepancyDecision,
    SupplyEvent,
    SupplySourceLink,
    SupplyVoidAudit,
    SupplyVoidSourceLink,
)
from inventory.allocations.scope import assignment_contexts
from reviews.effect_receipts import is_effective
from reviews.history import publish_history
from reviews.scope import SubjectFacts

type SupplyHistoryFact = (
    SupplyAssignmentVersion
    | OriginReleaseProof
    | ReleaseCancellation
    | ReturnAcceptance
    | SupplyDiscrepancyDecision
    | SupplyEvent
    | BagDisposition
)


def stored_source(source: FieldEvent, *, cause: OrgScopedModel | None = None) -> None:
    if not is_effective(source):
        return
    if source.type == "shift.close":
        from inventory.allocations.models import ReconciliationVersion

        frames = ReconciliationVersion.objects.filter(
            organization=source.organization,
            close_source_uuid=source.pk,
            shift__closed_event_id=source.pk,
            reconciliation__assignment__courier_id=source.created_by_id,
        ).select_related("reconciliation__assignment")
        for frame in frames.order_by("reconciliation__assignment_id"):
            _publish_assignment(frame.reconciliation.assignment)
    elif source.type in {"supplies.receive", "supplies.reconcile"}:
        event = SupplyEvent.objects.filter(
            organization=source.organization,
            declared_source_uuid=source.pk,
            source_payload_hash=source.payload_sha256,
            created_by=source.created_by,
        ).first()
        if event is None:
            return
        link, _ = SupplySourceLink.objects.get_or_create(
            event=event,
            defaults={
                "organization": source.organization,
                "created_by": source.created_by,
                "source_event": source,
            },
        )
        if link.source_event_id != source.pk:
            raise RuntimeError("Supply source linkage must preserve exact immutable identity")
        publish_fact(event, source if cause is None else cause)
        _invalidate_approved_shifts(event.assignment, source if cause is None else cause)
    elif source.type == "record.void":
        audit = (
            SupplyVoidAudit.objects.filter(
                organization=source.organization,
                declared_source_uuid=source.pk,
                source_payload_hash=source.payload_sha256,
            )
            .select_related("event")
            .first()
        )
        if audit is None:
            return
        void_link, _ = SupplyVoidSourceLink.objects.get_or_create(
            audit=audit,
            defaults={
                "organization": source.organization,
                "created_by": source.created_by,
                "source_event": source,
            },
        )
        if void_link.source_event_id != source.pk:
            raise RuntimeError("Supply void source linkage must preserve exact identity")
        publish_fact(audit.event, source if cause is None else cause)
        _invalidate_approved_shifts(audit.event.assignment, source if cause is None else cause)


def stored_execution(execution: InventoryIntentExecution) -> None:
    intent = execution.intent
    if intent.kind == "assignment_release":
        publish_fact(intent.release_effect, execution)
    elif intent.kind == "release_cancel":
        publish_fact(intent.cancellation_effect, execution)
    elif intent.kind == "return_accept":
        publish_fact(execution.return_effect, execution)
    elif intent.kind == "reconcile_justify":
        publish_fact(SupplyDiscrepancyDecision.objects.get(execution=execution), execution)
    elif intent.kind == "bag_disposal":
        publish_fact(execution.bag_effect, execution)
    if intent.kind in ("return_accept", "reconcile_justify") and intent.assignment is not None:
        _invalidate_approved_shifts(intent.assignment, execution)


def _invalidate_approved_shifts(assignment: SupplyAssignment, cause: OrgScopedModel) -> None:
    """Actual source/void/HTTP custody facts invalidate the same durable shift approval."""
    from inventory.allocations.models import ReconciliationVersion
    from reviews.history import publish_shift_decision
    from reviews.models import ShiftDecision

    shifts = set(
        ReconciliationVersion.objects.filter(
            reconciliation__assignment=assignment, shift_id__isnull=False
        ).values_list("shift_id", flat=True)
    )
    if assignment.shift_id is not None:
        shifts.add(assignment.shift_id)
    for identity in sorted(shifts):
        decision = (
            ShiftDecision.objects.filter(
                organization=assignment.organization,
                shift_id=identity,
                shift__courier_id=assignment.courier_id,
            )
            .select_related("shift__courier", "shift__organization", "closed_event")
            .order_by("-revision")
            .first()
        )
        if decision is not None and decision.kind == "approve":
            publish_shift_decision(decision, cause=cause)


def _assignment(fact: SupplyHistoryFact) -> SupplyAssignment | None:
    if isinstance(fact, SupplyAssignmentVersion | SupplyEvent):
        return fact.assignment
    if isinstance(fact, OriginReleaseProof):
        return fact.version.assignment
    if isinstance(fact, ReleaseCancellation):
        return fact.release.version.assignment
    if isinstance(fact, ReturnAcceptance):
        return fact.declaration.event.assignment
    if isinstance(fact, SupplyDiscrepancyDecision):
        return fact.discrepancy.reconciliation.assignment
    return None


def _kind(fact: SupplyHistoryFact) -> str:
    if isinstance(fact, SupplyEvent):
        return "receipt" if fact.kind == "receive" else "reconcile"
    kinds = {
        SupplyAssignmentVersion: "plan",
        OriginReleaseProof: "release",
        ReleaseCancellation: "cancel",
        ReturnAcceptance: "return",
        SupplyDiscrepancyDecision: "justify",
        BagDisposition: "bag_disposal",
    }
    return kinds[type(fact)]


def publish_fact(fact: SupplyHistoryFact, cause: OrgScopedModel) -> None:
    assignment = _assignment(fact)
    bag = fact.bag if isinstance(fact, BagDisposition) else None
    contexts: list[dict[str, str | None]]
    if bag is not None:
        courier = bag.collector
        point = bag.reading.ovitrap.sampling_point
        contexts = [
            {
                "center_id": str(point.block.quadrant.center_id),
                "quadrant_id": str(point.block.quadrant_id),
            }
        ]
    elif assignment is not None:
        courier = assignment.courier
        contexts = assignment_contexts(assignment)
    else:
        raise RuntimeError("A supply history fact requires an authentic assignment or Bag")
    source = (
        fact.source_link.source_event
        if isinstance(fact, SupplyEvent)
        else (bag.reading.event if bag else None)
    )
    payload = {
        "id": str(fact.pk),
        "kind": f"supply_{_kind(fact)}",
        "source_kind": _kind(fact),
        "assignment_id": None if assignment is None else str(assignment.pk),
        "bag_id": None if bag is None else str(bag.pk),
        "actor_id": str(fact.created_by_id),
        "at": fact.created_at.isoformat(),
        "subjects": contexts,
        "source_event_id": None if source is None else str(source.pk),
        "source_status": None if source is None else source.status,
        "source_code": None if source is None else source.status_code,
        "voided_at": None
        if source is None or source.voided_at is None
        else source.voided_at.isoformat(),
    }
    publish_history("supply_custody", cause, courier, payload)
    if assignment is not None:
        _publish_assignment(assignment)


def _publish_assignment(assignment: SupplyAssignment) -> None:
    from core.snapshots import snapshot_hash
    from field_sync.envelope import CourierContext
    from field_sync.services import ChangeInput, append_courier_change
    from inventory.allocations.producers import supply_projection

    payload = supply_projection(assignment)
    append_courier_change(
        CourierContext(assignment.organization, assignment.courier),
        ChangeInput(
            kind="supplies",
            resource_type="supply_assignment",
            resource_id=str(assignment.pk),
            resource_version=snapshot_hash(payload),
            scope=assignment_contexts(assignment)[0],
            action="upsert",
            payload=payload,
        ),
    )


def history_subjects(row: Any) -> SubjectFacts:  # noqa: ANN401 -- actual CourierChange, explicit persisted source discriminator
    kind = row.payload.get("source_kind")
    if row.resource_type != f"history.supply_{kind}" or row.payload.get("kind") != f"supply_{kind}":
        return SubjectFacts()
    models = {
        "plan": SupplyAssignmentVersion,
        "release": OriginReleaseProof,
        "cancel": ReleaseCancellation,
        "return": ReturnAcceptance,
        "justify": SupplyDiscrepancyDecision,
        "receipt": SupplyEvent,
        "reconcile": SupplyEvent,
        "bag_disposal": BagDisposition,
    }
    model = models.get(kind)
    if model is None:
        return SubjectFacts()
    fact = model.objects.filter(
        organization_id=row.organization_id, pk=UUID(row.resource_id)
    ).first()
    if fact is None or _kind(fact) != kind:
        return SubjectFacts()
    assignment = _assignment(fact)
    if assignment is not None and assignment.courier_id == row.courier_id:
        return SubjectFacts(
            True,
            tuple(assignment_contexts(assignment)),
            "supply_assignment",
            assignment.pk,
            {
                "own_permission": "supply_assignment.receive"
                if kind in ("plan", "release", "cancel", "receipt")
                else "supply_assignment.reconcile"
            },
        )
    if isinstance(fact, BagDisposition) and fact.bag.collector_id == row.courier_id:
        point = fact.bag.reading.ovitrap.sampling_point
        return SubjectFacts(
            True,
            (
                {
                    "center_id": str(point.block.quadrant.center_id),
                    "quadrant_id": str(point.block.quadrant_id),
                },
            ),
            "supply_assignment",
            None,
            {"own_permission": "field_event.sync"},
        )
    return SubjectFacts()
