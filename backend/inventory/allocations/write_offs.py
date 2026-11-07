"""Numeric lot loss, whole real Bag disposition and bounded current-custodian correction."""

from typing import Any
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import ValidationError

from core.void_reason import resolve_void_reason
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from inventory.allocations.bag_dependencies import disposal_assessment
from inventory.allocations.commands import SupplyOutcome
from inventory.allocations.evidence import intent_evidence
from inventory.allocations.models import (
    BagDisposition,
    InventoryIntent,
    LotWriteOff,
    ReturnAcceptance,
    ReturnDeclaration,
    SupplyEvent,
    SupplyLedgerSource,
    SupplyReceiptLine,
    SupplyVoidAudit,
)
from inventory.allocations.permissions import RECONCILE, SOURCE_PERMISSIONS
from inventory.allocations.policy import validate_supply_note
from inventory.allocations.reconciliation import receipt_remaining
from inventory.allocations.scope import allows_supply_vector, assignment_contexts
from inventory.allocations.stock import (
    SupplyStockLeg,
    append_supply_stock,
    assignment_balance,
    spendable_balance,
)
from inventory.exceptions import InventoryConflictError
from inventory.selectors import current_lot
from inventory.transactions import require_inventory_lock
from inventory.transfers.policy import stock_quantity
from lab.models import LabResultRevision
from reviews.inspection import ExistingEffect
from uploads.access import UploadActor, current_scope


def execute_write_off(
    actor: UploadActor, intent: InventoryIntent, execution_id: UUID
) -> tuple[SupplyOutcome, int]:
    require_inventory_lock(actor.organization.pk)
    if intent.kind == "bag_disposal":
        return _dispose_bag(actor, intent, execution_id)
    lot, location, unit = intent.lot, intent.location, intent.unit_version
    if lot is None or location is None or unit is None:
        raise Http404
    version = current_lot(lot)
    if version.revision != intent.expected_revision:
        raise InventoryConflictError("supply_revision_conflict", version.revision)
    quantity = stock_quantity(intent.canonical_input["quantity"])
    if (unit.identity_kind == "piece") != (intent.piece_id is not None) or (
        intent.piece_id is not None and quantity != 1
    ):
        raise InventoryConflictError("supply_identity_conflict")
    if spendable_balance(intent, location) < quantity:
        raise InventoryConflictError("supply_insufficient_stock")
    evidence = intent_evidence(
        actor, intent, ("rpbi",) if version.supply_version.is_biological else ()
    )
    values = intent.canonical_input
    reason = resolve_void_reason(actor.organization.pk, values["reason"], values["reason_code"])
    loss = LotWriteOff.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        execution_id=execution_id,
        lot=lot,
        location=location,
        piece=intent.piece,
        unit_version=unit,
        quantity=quantity,
        owner_id=values["owner_id"],
        date=values["date"],
        reason_code=reason.code,
        reason=validate_supply_note(reason.reason),
        rpbi=evidence.get("rpbi"),
    )
    source = SupplyLedgerSource.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        kind="lot_write_off",
        execution_id=execution_id,
        content_hash=intent.input_hash,
    )
    append_supply_stock(
        source,
        [
            SupplyStockLeg(
                lot=lot,
                piece=intent.piece,
                unit_version=unit,
                quantity=-quantity,
                kind="write_off",
                location=location,
            )
        ],
    )
    return SupplyOutcome(
        201,
        {
            "write_off": {
                "id": str(loss.pk),
                "kind": "lot",
                "lot_id": str(loss.lot_id),
                "location_id": str(loss.location_id),
                "quantity": str(quantity),
                "piece_id": None if loss.piece_id is None else str(loss.piece_id),
                "unit_version_id": str(loss.unit_version_id),
                **_audit_projection(loss),
            }
        },
    ), version.revision


def _dispose_bag(
    actor: UploadActor, intent: InventoryIntent, execution_id: UUID
) -> tuple[SupplyOutcome, int]:
    bag = intent.bag
    if bag is None:
        raise Http404
    current = LabResultRevision.objects.filter(bag=bag).first()
    revision = 0 if current is None else current.revision
    if revision != intent.expected_revision:
        raise InventoryConflictError("supply_revision_conflict", revision)
    proof = disposal_assessment(bag)
    evidence = intent_evidence(actor, intent, ("rpbi",))
    values = intent.canonical_input
    reason = resolve_void_reason(actor.organization.pk, values["reason"], values["reason_code"])
    disposition = BagDisposition.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        execution_id=execution_id,
        bag=bag,
        reading=bag.reading,
        source_event=bag.reading.event,
        owner_id=values["owner_id"],
        date=values["date"],
        reason_code=reason.code,
        reason=validate_supply_note(reason.reason),
        rpbi=evidence["rpbi"],
        dependency_proof=proof,
    )
    return SupplyOutcome(
        201,
        {
            "write_off": {
                "id": str(disposition.pk),
                "kind": "bag",
                "bag_id": str(bag.pk),
                "reading_id": str(bag.reading_id),
                "source_event_id": str(bag.reading.event_id),
                "collector_id": str(bag.collector_id),
                "dependency_proof": proof,
                **_audit_projection(disposition),
            }
        },
    ), revision


def _audit_projection(fact: LotWriteOff | BagDisposition) -> dict[str, Any]:
    rpbi = fact.rpbi
    return {
        "owner_id": str(fact.owner_id),
        "date": str(fact.date),
        "reason_code": fact.reason_code,
        "reason": fact.reason,
        "created_at": fact.created_at.isoformat(),
        "created_by": str(fact.created_by_id),
        "rpbi_upload_id": None if rpbi is None else str(rpbi.public_id),
    }


def _void_authority(ctx: EventContext, target: FieldEvent, event: SupplyEvent) -> None:
    contexts = assignment_contexts(event.assignment)
    capability = ctx.review_authorization
    scope = (
        capability.historical_scope
        if capability
        else current_scope(UploadActor(ctx.user, ctx.organization, ctx.device.pk))
    )
    if (
        target.created_by_id != ctx.user.pk
        or event.assignment.courier_id != ctx.user.pk
        or any(
            not allows_supply_vector(scope, code, contexts)
            for code in (SOURCE_PERMISSIONS[target.type], "field_event.sync")
        )
    ):
        raise EventRejected("supply_inaccessible")
    if capability is not None:
        if capability.reviewer_actor is None:
            raise EventRejected("supply_inaccessible")
        reviewer = current_scope(capability.reviewer_actor)
        if any(
            not allows_supply_vector(reviewer, code, contexts)
            for code in (RECONCILE, "review_item.decide")
        ):
            raise EventRejected("supply_inaccessible")


def on_void(ctx: EventContext, target: FieldEvent) -> None:
    require_inventory_lock(ctx.organization.pk)
    try:
        reason = validate_supply_note(target.void_reason, field="reason")
    except ValidationError as error:
        from field_sync.services import rejection_params

        raise EventRejected("invalid_payload", rejection_params(error)) from error
    event = (
        SupplyEvent.objects.filter(
            organization=ctx.organization,
            declared_source_uuid=target.pk,
            source_payload_hash=target.payload_sha256,
        )
        .select_related("assignment__origin")
        .first()
    )
    if event is None:
        return
    _void_authority(ctx, target, event)
    if event.kind == "reconcile":
        if (
            event.uses.exists()
            or event.shrinkages.exists()
            or ReturnAcceptance.objects.filter(declaration__event=event).exists()
        ):
            raise EventRejected("supply_void_blocked")
        legs = []
    else:
        legs = _receipt_compensation(event)
    audit = SupplyVoidAudit.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        event=event,
        declared_source_uuid=ctx.envelope.id,
        source_payload_hash=ctx.envelope.payload_info.sha256,
        reason_code=target.void_reason_code,
        reason=reason,
        compensation_proof={
            "source_id": str(target.pk),
            "source_hash": target.payload_sha256,
            "kind": event.kind,
            "receipt_line_ids": [
                str(row.pk) for row in SupplyReceiptLine.objects.filter(receipt__event=event)
            ],
        },
    )
    if legs:
        source = SupplyLedgerSource.objects.create(
            organization=ctx.organization,
            created_by=ctx.user,
            kind="supply_compensation",
            compensation=audit,
            content_hash=ctx.envelope.payload_info.sha256,
        )
        append_supply_stock(source, legs)
    from inventory.allocations.reconciliation import FrameCause, append_frame

    append_frame(event.assignment, ctx.user, FrameCause(void_audit=audit))


def _receipt_compensation(event: SupplyEvent) -> list[SupplyStockLeg]:
    lines = SupplyReceiptLine.objects.filter(receipt__event=event).select_related(
        "release_line__line__lot", "release_line__line__piece", "release_line__line__unit_version"
    )
    legs: list[SupplyStockLeg] = []
    for line in lines:
        if (
            receipt_remaining(line) != line.quantity
            or assignment_balance(line) < line.quantity
            or ReturnDeclaration.objects.filter(
                receipt_line=line, event__void_audit__isnull=True
            ).exists()
        ):
            raise EventRejected("supply_void_blocked")
        if not line.quantity:
            continue
        original = line.release_line.line
        facts = {
            "lot": original.lot,
            "piece": original.piece,
            "unit_version": original.unit_version,
            "assignment_line": original,
            "receipt_line": line,
        }
        legs.extend(
            [
                SupplyStockLeg(
                    **facts, assignment=event.assignment, quantity=-line.quantity, kind="void_debit"
                ),
                SupplyStockLeg(
                    **facts,
                    location=event.assignment.origin,
                    quantity=line.quantity,
                    kind="void_credit",
                ),
            ]
        )
    return legs


def inspect_supply_void(source: FieldEvent, target: FieldEvent) -> ExistingEffect:
    audit = SupplyVoidAudit.objects.filter(
        organization=source.organization,
        declared_source_uuid=source.pk,
        source_payload_hash=source.payload_sha256,
        event__declared_source_uuid=target.pk,
        reason=target.void_reason,
        reason_code=target.void_reason_code,
    ).first()
    if audit is None:
        return ExistingEffect("partial", blockers=("supply_void_blocked",))
    return ExistingEffect(
        "complete_owned", {"supply_void_audit_id": str(audit.pk), "target_event_id": str(target.pk)}
    )
