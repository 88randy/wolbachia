"""Two real shift-checked custody sources through the existing ingestion/review kernel."""

from dataclasses import replace
from decimal import Decimal
from typing import Any, cast

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from core.snapshots import snapshot_hash
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext, EventHandler, register
from inventory.allocations.evidence import source_evidence
from inventory.allocations.models import (
    OriginReleaseProof,
    ReleaseCancellationLine,
    SupplyEvent,
    SupplyLedgerSource,
    SupplyReceipt,
    SupplyReceiptLine,
    SupplySourceResult,
)
from inventory.allocations.review import (
    SUPPLY_REVIEW_CODES,
    SupplyReviewAdapter,
    authorize_source,
    capture_source_facts,
    require_original_facts,
)
from inventory.allocations.serializers import SupplyReceivePayload, SupplyReconcilePayload
from inventory.allocations.stock import SupplyStockLeg, append_supply_stock
from inventory.exceptions import InventoryConflictError
from inventory.transactions import require_inventory_lock
from inventory.transfers.policy import json_facts

SUPPLY_CODES = (
    "supply_inaccessible",
    "supply_void_blocked",
    *sorted(
        SUPPLY_REVIEW_CODES - {"clock_skew", "final_upload_after_revoke", "causal_parent_pending"}
    ),
)


def apply_source(ctx: EventContext, data: dict[str, Any]) -> SupplyEvent:
    require_inventory_lock(ctx.organization.pk)
    assignment = authorize_source(ctx, data)
    ctx.observed_facts["supplies"] = capture_source_facts(ctx, data)
    require_original_facts(ctx, data)
    old = SupplyEvent.objects.filter(
        organization=ctx.organization, command_id=data["command_id"]
    ).first()
    if old is not None:
        if (
            old.declared_source_uuid != ctx.envelope.id
            or old.input_hash != snapshot_hash(json_facts(data))
            or old.created_by_id != ctx.user.pk
        ):
            raise EventNeedsReview("supply_state_conflict")
        return cast(SupplyEvent, old)
    if ctx.review_code is not None and ctx.review_authorization is None:
        raise EventNeedsReview(ctx.review_code)
    from inventory.allocations.reconciliation import apply_reconciliation, current_revision

    revision = current_revision(assignment)
    if data["expected_revision"] != revision and not ctx.acknowledges("supply_state_conflict"):
        raise EventNeedsReview("supply_state_conflict")
    try:
        if ctx.envelope.type == "supplies.receive":
            event = _receive(ctx, data, revision + 1)
        else:
            event = apply_reconciliation(ctx, data, revision + 1)
    except InventoryConflictError as error:
        reason = error.blocked_by[0]["reason"]
        code = (
            "supply_evidence_required"
            if reason == "supply_evidence_required"
            else "supply_state_conflict"
        )
        raise EventNeedsReview(code) from error
    except ValidationError as error:
        from field_sync.services import rejection_params

        raise EventRejected("invalid_payload", rejection_params(error)) from error
    return event


def create_source_event(ctx: EventContext, data: dict[str, Any], revision: int) -> SupplyEvent:
    assignment = authorize_source(ctx, data)
    return SupplyEvent.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        assignment=assignment,
        revision=revision,
        kind=ctx.envelope.type.split(".")[1],
        command_id=data["command_id"],
        expected_revision=data["expected_revision"],
        canonical_input=json_facts(data),
        input_hash=snapshot_hash(json_facts(data)),
        declared_source_uuid=ctx.envelope.id,
        source_payload_hash=ctx.envelope.payload_info.sha256,
        device_time=ctx.envelope.device_time,
        server_received_at=ctx.server_received_at,
        original_proof=ctx.observed_facts["supplies"],
    )


def _receive(ctx: EventContext, data: dict[str, Any], revision: int) -> SupplyEvent:
    assignment = authorize_source(ctx, data)
    release = (
        OriginReleaseProof.objects.filter(
            organization=ctx.organization, pk=data["release_id"], version__assignment=assignment
        )
        .select_related("version")
        .first()
    )
    if release is None or release.version.revision != data["plan_revision"]:
        raise EventRejected("supply_inaccessible")
    current = assignment.versions.first()
    if (current is None or current.revision != data["plan_revision"]) and not ctx.acknowledges(
        "supply_assignment_changed"
    ):
        raise EventNeedsReview("supply_assignment_changed")
    from inventory.allocations.signature_mode import (
        delivery_signature_mode,
        receipt_signature_problem,
    )

    declared = data.get("signature_upload_id")
    problem = receipt_signature_problem(
        delivery_signature_mode(ctx.organization),
        declared is not None,
        bool((release.proof or {}).get("signature")),
    )
    if problem is not None:
        raise EventRejected(problem)
    evidence = source_evidence(ctx, {"signature": [] if declared is None else [declared]})
    event = create_source_event(ctx, data, revision)
    receipt = SupplyReceipt.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event=event,
        release=release,
        signature=evidence["signature"][0] if evidence["signature"] else None,
        observations=data["discrepancies"],
    )
    source = SupplyLedgerSource.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        kind="supply_receive",
        event=event,
        content_hash=event.input_hash,
    )
    legs = []
    for observed in data["actual_lines"]:
        line, quantity = _receipt_line(receipt, observed)
        if quantity:
            original = line.release_line.line
            credit = SupplyStockLeg(
                lot=original.lot,
                piece=original.piece,
                unit_version=original.unit_version,
                assignment_line=original,
                receipt_line=line,
                quantity=quantity,
                kind="courier_credit",
                assignment=assignment,
            )
            debit = replace(
                credit,
                quantity=-quantity,
                kind="origin_debit",
                assignment=None,
                location=assignment.origin,
            )
            legs.extend([debit, credit])
    append_supply_stock(source, legs)
    from inventory.allocations.reconciliation import FrameCause, append_frame

    frame = append_frame(assignment, ctx.user, FrameCause(source=event))
    SupplySourceResult.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event=event,
        response={
            "assignment_id": str(assignment.pk),
            "receipt_id": str(receipt.pk),
            "revision": frame.revision,
            "actual_lines": [
                {
                    "id": str(line.pk),
                    "release_line_id": str(line.release_line_id),
                    "quantity": str(line.quantity),
                }
                for line in receipt.lines.order_by("pk")
            ],
        },
    )
    return event


def _receipt_line(
    receipt: SupplyReceipt, observed: dict[str, Any]
) -> tuple[SupplyReceiptLine, Decimal]:
    release_line = (
        receipt.release.lines.filter(pk=observed["release_line_id"])
        .select_related("line__lot", "line__piece", "line__unit_version")
        .first()
    )
    if release_line is None:
        raise EventRejected("supply_inaccessible")
    if SupplyReceiptLine.objects.filter(pk=observed["id"]).exists():
        raise InventoryConflictError("supply_identity_conflict")
    credited = (
        SupplyReceiptLine.objects.filter(
            release_line=release_line, receipt__event__void_audit__isnull=True
        ).aggregate(total=Sum("quantity"))["total"]
        or 0
    )
    cancelled = (
        ReleaseCancellationLine.objects.filter(release_line=release_line).aggregate(
            total=Sum("quantity")
        )["total"]
        or 0
    )
    quantity = observed["quantity"]
    if quantity > release_line.quantity - credited - cancelled or (
        release_line.line.piece_id and quantity not in (0, 1)
    ):
        raise InventoryConflictError("supply_receipt_unbacked")
    line = SupplyReceiptLine.objects.create(
        id=observed["id"],
        organization=receipt.organization,
        created_by=receipt.created_by,
        receipt=receipt,
        release_line=release_line,
        quantity=quantity,
    )
    return line, quantity


def apply_supply_source(ctx: EventContext, data: dict[str, Any]) -> None:
    apply_source(ctx, data)


def register_supply_handlers() -> None:
    from inventory.allocations.write_offs import on_void

    for kind, serializer in (
        ("supplies.receive", SupplyReceivePayload),
        ("supplies.reconcile", SupplyReconcilePayload),
    ):
        register(
            EventHandler(
                kind,
                1,
                serializer,
                apply_supply_source,
                on_void=on_void,
                codes=SUPPLY_CODES,
                checks_shift=True,
                review_adapter=SupplyReviewAdapter(),
            )
        )
