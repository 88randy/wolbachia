"""Actual signed custody, declared returns and separately accepted physical returns."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from django.db.models import Q, Sum
from django.http import Http404

from accounts.models import User
from core.snapshots import snapshot_hash
from core.void_reason import resolve_void_reason
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext
from inventory.allocations.commands import SupplyOutcome
from inventory.allocations.evidence import intent_evidence, source_evidence
from inventory.allocations.models import (
    InventoryIntent,
    ReconciliationLine,
    ReconciliationVersion,
    ReturnAcceptance,
    ReturnDeclaration,
    SupplyAssignment,
    SupplyAssignmentLine,
    SupplyDiscrepancy,
    SupplyDiscrepancyDecision,
    SupplyEvent,
    SupplyLedgerSource,
    SupplyReceiptLine,
    SupplyShrinkage,
    SupplySourceResult,
    SupplyUse,
    SupplyVoidAudit,
)
from inventory.allocations.policy import (
    QuantityFrame,
    reconciliation_equation,
    validate_supply_note,
)
from inventory.allocations.stock import SupplyStockLeg, append_supply_stock, assignment_balance
from inventory.exceptions import InventoryConflictError
from inventory.models import Location, StockOperation
from inventory.transactions import require_inventory_lock
from inventory.transfers.policy import json_facts, stock_quantity
from shifts.models import Shift
from uploads.access import UploadActor


@dataclass(frozen=True)
class FrameCause:
    source: SupplyEvent | None = None
    acceptance: ReturnAcceptance | None = None
    shift: Shift | None = None
    close_source_uuid: UUID | None = None
    void_audit: SupplyVoidAudit | None = None


def current_revision(assignment: SupplyAssignment) -> int:
    frame = ReconciliationVersion.objects.filter(reconciliation__assignment=assignment).first()
    return 0 if frame is None else frame.revision


def append_frame(
    assignment: SupplyAssignment, author: User, cause: FrameCause
) -> ReconciliationVersion:
    require_inventory_lock(assignment.organization_id)
    reconciliation = assignment.reconciliation
    previous = reconciliation.versions.first()
    rows = [
        _line_frame(line)
        for line in SupplyAssignmentLine.objects.filter(version__assignment=assignment).order_by(
            "pk"
        )
    ]
    facts = json_facts({"assignment_id": assignment.pk, "lines": rows})
    frame = ReconciliationVersion.objects.create(
        organization=assignment.organization,
        created_by=author,
        reconciliation=reconciliation,
        revision=1 if previous is None else previous.revision + 1,
        previous=previous,
        source_event=cause.source,
        acceptance=cause.acceptance,
        shift=cause.shift,
        close_source_uuid=cause.close_source_uuid,
        void_audit=cause.void_audit,
        frame=facts,
        frame_hash=snapshot_hash(facts),
    )
    reasons = []
    for row in rows:
        ReconciliationLine.objects.create(
            organization=assignment.organization,
            created_by=author,
            version=frame,
            **{key: value for key, value in row.items() if key != "plan_revision"},
        )
        if row["difference"] is None or row["difference"] != 0 or row["delivery_variance"] != 0:
            reasons.append(
                {
                    "assignment_line_id": str(row["assignment_line_id"]),
                    "reason": "receipt_unknown"
                    if row["credited"] is None
                    else "unexplained_difference",
                }
            )
    if reasons:
        SupplyDiscrepancy.objects.get_or_create(
            reconciliation=reconciliation,
            defaults={
                "organization": assignment.organization,
                "created_by": author,
                "frame": frame,
                "reasons": reasons,
            },
        )
    return frame


def _sum(query: Any) -> Decimal:  # noqa: ANN401 -- bounded real aggregate models
    return query.aggregate(total=Sum("quantity"))["total"] or Decimal(0)


def _line_frame(line: SupplyAssignmentLine) -> dict[str, Any]:
    receipts = SupplyReceiptLine.objects.filter(
        release_line__line=line, receipt__event__void_audit__isnull=True
    )
    credited = _sum(receipts) if receipts.exists() else None
    used = _sum(SupplyUse.objects.filter(receipt_line__in=receipts, event__void_audit__isnull=True))
    used += StockOperation.objects.filter(release_receipt_line__in=receipts).aggregate(
        total=Sum("release__quantity")
    )["total"] or Decimal(0)
    shrinkage = _sum(
        SupplyShrinkage.objects.filter(receipt_line__in=receipts, event__void_audit__isnull=True)
    )
    returned = _sum(ReturnAcceptance.objects.filter(declaration__receipt_line__in=receipts))
    equation = reconciliation_equation(
        QuantityFrame(line.quantity, credited, used, returned, shrinkage)
    )
    return {
        "assignment_line_id": line.pk,
        "plan_revision": line.version.revision,
        "planned": line.quantity,
        "credited": credited,
        "used": used,
        "returned": returned,
        "shrinkage": shrinkage,
        "difference": equation.remaining,
        "delivery_variance": equation.delivery_variance,
    }


def receipt_remaining(line: SupplyReceiptLine) -> Decimal:
    if hasattr(line.receipt.event, "void_audit"):
        raise InventoryConflictError("supply_receipt_voided")
    used = _sum(line.uses.filter(event__void_audit__isnull=True))
    used += StockOperation.objects.filter(release_receipt_line=line).aggregate(
        total=Sum("release__quantity")
    )["total"] or Decimal(0)
    lost = _sum(line.shrinkages.filter(event__void_audit__isnull=True))
    accepted = _sum(ReturnAcceptance.objects.filter(declaration__receipt_line=line))
    return line.quantity - used - lost - accepted


def _receipt_line(ctx: EventContext, row: dict[str, Any]) -> SupplyReceiptLine:
    line = (
        SupplyReceiptLine.objects.filter(
            organization=ctx.organization,
            pk=row["receipt_line_id"],
            receipt__event__assignment_id=ctx.envelope.payload["assignment_id"],
            receipt__event__source_link__source_event_id=row["receipt_source_event_id"],
            receipt__event__source_link__source_event__created_by=ctx.user,
        )
        .select_related(
            "receipt__event__assignment",
            "release_line__line__lot",
            "release_line__line__piece",
            "release_line__line__unit_version",
        )
        .first()
    )
    if line is None:
        raise EventRejected("supply_inaccessible")
    if line.release_line.line.piece_id is not None and row["quantity"] != 1:
        raise InventoryConflictError("supply_identity_conflict")
    if receipt_remaining(line) < row["quantity"] or assignment_balance(line) < row["quantity"]:
        raise InventoryConflictError("supply_insufficient_custody")
    return cast(SupplyReceiptLine, line)


def apply_reconciliation(ctx: EventContext, data: dict[str, Any], revision: int) -> SupplyEvent:
    from inventory.allocations.handlers import create_source_event

    photos = sorted(
        {identifier for row in data["used"] for identifier in row["transit_evidence_ids"]}
    )
    losses = sorted({identifier for row in data["shrinkage"] for identifier in row["evidence_ids"]})
    source_evidence(ctx, {"photo": [*photos, *losses]})
    if data["used"] and not ctx.acknowledges("supply_transit_unavailable"):
        raise EventNeedsReview("supply_transit_unavailable")
    event = create_source_event(ctx, data, revision)
    source = SupplyLedgerSource.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        kind="supply_reconcile",
        event=event,
        content_hash=event.input_hash,
    )
    legs: list[SupplyStockLeg] = []
    for row in data["used"]:
        line = _use_delta(ctx, event, row)
        legs.append(_custody_debit(line, row["quantity"], "used"))
    for row in data["shrinkage"]:
        line = _receipt_line(ctx, row)
        resolved = resolve_void_reason(
            ctx.organization.pk, row["reason"], row["reason_code"], allow_inactive=True
        )
        if not resolved.is_active:
            raise EventNeedsReview("void_reason_code_deactivated")
        SupplyShrinkage.objects.create(
            organization=ctx.organization,
            created_by=ctx.user,
            event=event,
            receipt_line=line,
            quantity=row["quantity"],
            reason_code=resolved.code,
            reason=validate_supply_note(resolved.reason),
            evidence_ids=json_facts(row["evidence_ids"]),
        )
        legs.append(_custody_debit(line, row["quantity"], "shrinkage"))
    for row in data["returned"]:
        line = _receipt_line(ctx, row)
        destination = Location.objects.filter(
            organization=ctx.organization, pk=row["destination_id"]
        ).first()
        if destination is None:
            raise EventRejected("supply_inaccessible")
        ReturnDeclaration.objects.create(
            organization=ctx.organization,
            created_by=ctx.user,
            event=event,
            receipt_line=line,
            destination=destination,
            quantity=row["quantity"],
        )
    append_supply_stock(source, legs)
    frame = append_frame(event.assignment, ctx.user, FrameCause(source=event))
    SupplySourceResult.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event=event,
        response={
            "assignment_id": str(event.assignment_id),
            "revision": frame.revision,
            "frame_id": str(frame.pk),
            "frame": frame.frame,
        },
    )
    return event


def _use_delta(ctx: EventContext, event: SupplyEvent, row: dict[str, Any]) -> SupplyReceiptLine:
    from inventory.allocations.review import work_point
    from inventory.allocations.transit import require_transit_use

    line = _receipt_line(ctx, row)
    policy, proof = require_transit_use(line, row)
    point = work_point(ctx, row["work_source_id"]) if row["work_kind"] == "field_event" else None
    SupplyUse.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event=event,
        receipt_line=line,
        quantity=row["quantity"],
        work_kind=row["work_kind"],
        work_source_id=row.get("work_source_id"),
        work_point=point,
        manual_reason=row.get("manual_reason", ""),
        transit_policy=policy,
        transit_proof=proof,
    )
    return line


def _custody_debit(line: SupplyReceiptLine, quantity: Decimal, kind: str) -> SupplyStockLeg:
    original = line.release_line.line
    return SupplyStockLeg(
        lot=original.lot,
        piece=original.piece,
        unit_version=original.unit_version,
        quantity=-quantity,
        kind=kind,
        assignment=line.receipt.event.assignment,
        assignment_line=original,
        receipt_line=line,
    )


def execute_reconciliation_intent(
    actor: UploadActor, intent: InventoryIntent, execution_id: UUID
) -> tuple[SupplyOutcome, int]:
    assignment = intent.assignment
    if assignment is None:
        raise Http404
    frame = assignment.reconciliation.versions.first()
    if frame is None or frame.revision != intent.expected_revision:
        raise InventoryConflictError(
            "supply_revision_conflict", 0 if frame is None else frame.revision
        )
    if intent.kind == "return_accept":
        return _accept_return(actor, intent, execution_id)
    evidence = intent_evidence(actor, intent)
    discrepancy = SupplyDiscrepancy.objects.filter(
        reconciliation=intent.reconciliation, pk=intent.canonical_input["discrepancy_id"]
    ).first()
    if discrepancy is None:
        raise Http404
    values = intent.canonical_input
    resolved = resolve_void_reason(actor.organization.pk, values["reason"], values["reason_code"])
    decision = SupplyDiscrepancyDecision.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        discrepancy=discrepancy,
        execution_id=execution_id,
        frame=frame,
        reason_code=resolved.code,
        reason=validate_supply_note(resolved.reason),
        evidence_ids=[str(upload.public_id) for upload in evidence.values()],
    )
    return SupplyOutcome(
        201, {"justification": {"id": str(decision.pk), "frame_id": str(frame.pk)}}
    ), frame.revision


def close_assignment_rows(ctx: EventContext) -> Any:  # noqa: ANN401 -- real scoped QuerySet[SupplyAssignment]
    from zoneinfo import ZoneInfo

    from field_sync.envelope import is_plausible_time

    rows = SupplyAssignment.objects.filter(organization=ctx.organization, courier=ctx.user)
    if ctx.envelope.shift_id is None or not is_plausible_time(ctx.envelope.device_time):
        return rows.none()
    day = ctx.envelope.device_time.astimezone(ZoneInfo(ctx.organization.timezone)).date()
    return rows.filter(
        Q(shift_id=ctx.envelope.shift_id) | Q(shift__isnull=True, date=day)
    ).order_by("pk")


def append_close_frames(ctx: EventContext, shift: Shift) -> None:
    for assignment in close_assignment_rows(ctx):
        append_frame(
            assignment, ctx.user, FrameCause(shift=shift, close_source_uuid=ctx.envelope.id)
        )


def shift_assignment_rows(shift: Shift) -> Any:  # noqa: ANN401 -- actual persistent field-work linkage
    return (
        SupplyAssignment.objects.filter(organization=shift.organization, courier=shift.courier)
        .filter(
            Q(shift=shift)
            | Q(events__source_link__source_event__shift_id=shift.pk)
            | Q(reconciliation__versions__shift=shift)
        )
        .distinct()
        .order_by("pk")
    )


def shift_supply_fingerprint(shift: Shift) -> dict[str, Any]:
    assignments = shift_assignment_rows(shift)
    return {
        "assignments": sorted(
            str(identifier) for identifier in assignments.values_list("pk", flat=True)
        ),
        "frames": sorted(
            (str(row.pk), row.frame_hash)
            for row in ReconciliationVersion.objects.filter(
                reconciliation__assignment__in=assignments
            )
        ),
        "justifications": sorted(
            str(identifier)
            for identifier in SupplyDiscrepancyDecision.objects.filter(
                discrepancy__reconciliation__assignment__in=assignments
            ).values_list("pk", flat=True)
        ),
    }


def _accept_return(
    actor: UploadActor, intent: InventoryIntent, execution_id: UUID
) -> tuple[SupplyOutcome, int]:
    declaration = intent.declaration
    assignment = intent.assignment
    if declaration is None or assignment is None:
        raise Http404
    line = declaration.receipt_line
    quantity = stock_quantity(intent.canonical_input["quantity"])
    if line.release_line.line.piece_id is not None and quantity != 1:
        raise InventoryConflictError("supply_identity_conflict")
    if (
        hasattr(declaration.event, "void_audit")
        or quantity > declaration.quantity - _sum(declaration.acceptances.all())
        or quantity > receipt_remaining(line)
        or quantity > assignment_balance(line)
    ):
        raise InventoryConflictError("supply_insufficient_custody")
    evidence = intent_evidence(actor, intent, ("signature",))
    acceptance = ReturnAcceptance.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        declaration=declaration,
        execution_id=execution_id,
        quantity=quantity,
        signature=evidence["signature"],
    )
    source = SupplyLedgerSource.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        kind="supply_return",
        execution_id=execution_id,
        content_hash=intent.input_hash,
    )
    debit = _custody_debit(line, quantity, "returned")
    original = line.release_line.line
    credit = SupplyStockLeg(
        lot=original.lot,
        piece=original.piece,
        unit_version=original.unit_version,
        quantity=quantity,
        kind="return_credit",
        location=declaration.destination,
        assignment_line=original,
        receipt_line=line,
    )
    append_supply_stock(source, [debit, credit])
    frame = append_frame(assignment, actor.user, FrameCause(acceptance=acceptance))
    return SupplyOutcome(
        201,
        {
            "acceptance": {
                "id": str(acceptance.pk),
                "declaration_id": str(declaration.pk),
                "quantity": str(quantity),
                "revision": frame.revision,
            }
        },
    ), frame.revision
