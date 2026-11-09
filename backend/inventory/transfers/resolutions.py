"""Complete accountable outcomes; owned hold release and compensation commit together."""

from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

from django.db.models import Sum
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from core.snapshots import snapshot_hash
from core.void_reason import validate_void_reason
from inventory.exceptions import InventoryConflictError, InventoryInProgressError
from inventory.transactions import require_inventory_lock
from inventory.transfers.commands import (
    DispatchTransferCommand,
    ResolutionCommand,
    ResolutionIntent,
    SignedManifest,
    TransferAuthority,
    TransferTransitionResult,
)
from inventory.transfers.evidence import (
    EvidenceRequest,
    bind_evidence,
    evidence_manifest,
    verify_evidence,
)
from inventory.transfers.models import (
    Discrepancy,
    DiscrepancyLine,
    DiscrepancyResolution,
    ResolutionOutcome,
    Transfer,
    TransferEvent,
    TransferHoldResolution,
    TransferReceiptLine,
)
from inventory.transfers.policy import json_facts, partition_outcomes, stock_quantity
from inventory.transfers.scope import require_transfer_scope
from inventory.transfers.stock import StockLeg, append_stock, require_safety
from inventory.transfers.transitions import (
    _lock_lines,
    append_command_receipt,
    append_event,
    require_dispatch_source,
)
from uploads.access import UploadActor, current_scope
from uploads.models import Upload


def visible_discrepancy(actor: UploadActor, identifier: UUID) -> Discrepancy:
    if "discrepancy.close" not in current_scope(actor).permissions:
        raise PermissionDenied
    discrepancy = (
        Discrepancy.objects.filter(organization=actor.organization, pk=identifier)
        .select_related(
            "transfer__origin__center", "transfer__destination__center", "receipt_event"
        )
        .first()
    )
    if discrepancy is None:
        raise Http404
    require_transfer_scope(TransferAuthority(actor), "discrepancy.close", discrepancy.transfer)
    return cast(Discrepancy, discrepancy)


def apply_resolution_locked(command: ResolutionCommand) -> TransferTransitionResult:
    require_inventory_lock(command.actor.organization.pk)
    discrepancy = visible_discrepancy(command.actor, command.discrepancy_id)
    _receiving_authority(command.actor, discrepancy, command.values["resolution"]["outcomes"])
    reason = validate_void_reason(command.values["reason"])
    digest = snapshot_hash(
        json_facts(
            {
                "discrepancy_id": command.discrepancy_id,
                "actor_id": command.actor.user.pk,
                "values": {**command.values, "reason": reason},
            }
        )
    )
    previous = (
        DiscrepancyResolution.objects.filter(discrepancy=discrepancy)
        .select_related("event")
        .first()
    )
    if previous is not None:
        if previous.content_hash != digest:
            raise InventoryConflictError("transfer_command_conflict")
        return TransferTransitionResult(previous.event, True)
    from inventory.transfers.dependencies import resolution_references

    if not resolution_references(command.actor, discrepancy, command.values).issubset(
        command.source_references
    ):
        raise InventoryInProgressError
    if command.values["expected_revision"] != 0:
        raise InventoryConflictError("transfer_revision_conflict", 0)
    _lock_lines(discrepancy.transfer)
    Discrepancy.objects.select_for_update(nowait=True, no_key=True).get(pk=discrepancy.pk)
    return _resolve(command, discrepancy, ResolutionIntent(reason, digest))


def _resolve(
    command: ResolutionCommand, discrepancy: Discrepancy, intent: ResolutionIntent
) -> TransferTransitionResult:
    reason, digest = intent.reason, intent.digest
    outcomes = command.values["resolution"]["outcomes"]
    lines = {
        str(line.pk): line
        for line in discrepancy.lines.select_related(
            "line__lot", "line__unit_version", "line__piece"
        )
    }
    partition_outcomes({key: line.quantity for key, line in lines.items()}, outcomes)
    signatures = tuple(
        {
            row["signature_upload_id"]
            for row in outcomes
            if row["kind"] in {"recover_dest", "return_origin"}
        }
    )
    photos = tuple(command.values.get("evidence_ids", []))
    if signatures and not photos:
        raise InventoryConflictError("transfer_evidence_required")
    proofs = verify_evidence(
        TransferAuthority(command.actor),
        discrepancy.transfer,
        EvidenceRequest(signatures, photos, requires_signature=bool(signatures)),
    )
    request = DispatchTransferCommand(
        command.actor, discrepancy.transfer_id, {**command.values, "command_id": uuid4()}
    )
    manifest = json_facts(
        {
            "discrepancy_id": discrepancy.pk,
            "reason": reason,
            "outcomes": outcomes,
            "evidence": evidence_manifest(proofs),
        }
    )
    event = append_event(request, discrepancy.transfer, SignedManifest("resolution", manifest))
    resolution = DiscrepancyResolution.objects.create(
        organization=event.organization,
        created_by=event.created_by,
        discrepancy=discrepancy,
        event=event,
        expected_revision=0,
        content_hash=digest,
        reason=reason,
        evidence_ids=json_facts(photos),
    )
    legs = [_outcome(resolution, lines[str(row["line_id"])], row) for row in outcomes]
    _resolve_own_holds(resolution)
    actual_legs = [leg for leg in legs if leg is not None]
    for leg in actual_legs:
        require_safety(leg.line, leg.location)
    append_stock(event, actual_legs)
    bind_evidence(event, proofs)
    append_command_receipt(request, event, "resolution")
    return TransferTransitionResult(event)


def _receiving_authority(
    actor: UploadActor, discrepancy: Discrepancy, outcomes: list[dict[str, Any]]
) -> None:
    if any(row["kind"] in {"recover_dest", "return_origin"} for row in outcomes):
        require_transfer_scope(TransferAuthority(actor), "transfer.receive", discrepancy.transfer)


def _outcome(
    resolution: DiscrepancyResolution, line: DiscrepancyLine, values: dict[str, Any]
) -> StockLeg | None:
    kind = values["kind"]
    if (
        line.line is not None
        and line.line.piece_id is not None
        and stock_quantity(values["quantity"]) != 1
    ):
        raise InventoryConflictError("transfer_resolution_incomplete")
    fields: dict[str, Any] = {}
    leg = None
    if kind == "reference_signed_correction":
        fields = _correction(resolution, line, values)
    else:
        if line.kind != "missing" or line.line is None:
            raise InventoryConflictError("transfer_resolution_incomplete")
        if kind in {"recover_dest", "return_origin"}:
            fields = _receiving_proof(resolution, values)
            place = (
                resolution.discrepancy.transfer.destination
                if kind == "recover_dest"
                else resolution.discrepancy.transfer.origin
            )
            leg = StockLeg(line.line, place, stock_quantity(values["quantity"]), kind)
    ResolutionOutcome.objects.create(
        organization=resolution.organization,
        created_by=resolution.created_by,
        resolution=resolution,
        line=line,
        kind=kind,
        quantity=stock_quantity(values["quantity"]),
        proof=json_facts(values),
        **fields,
    )
    return leg


def _receiving_proof(resolution: DiscrepancyResolution, values: dict[str, Any]) -> dict[str, Any]:
    discrepancy = resolution.discrepancy
    dispatch = require_dispatch_source(discrepancy.transfer)
    if str(values["dispatch_event_id"]) != str(dispatch.pk) or str(
        values["receipt_event_id"]
    ) != str(discrepancy.receipt_event_id):
        raise InventoryConflictError("transfer_source_conflict")
    signature = Upload.objects.get(
        organization=resolution.organization, public_id=values["signature_upload_id"]
    )
    return {
        "dispatch_event": dispatch,
        "receipt_event": discrepancy.receipt_event,
        "signature_upload": signature,
    }


def _correction(
    resolution: DiscrepancyResolution, line: DiscrepancyLine, values: dict[str, Any]
) -> dict[str, Any]:
    if line.kind == "missing":
        raise InventoryConflictError("transfer_resolution_incomplete")
    transfer = (
        Transfer.objects.filter(
            organization=resolution.organization, pk=values["correction_transfer_id"]
        )
        .select_related("origin", "destination")
        .first()
    )
    if transfer is None or transfer.pk == resolution.discrepancy.transfer_id:
        raise Http404
    author = resolution.created_by
    if author is None:
        raise InventoryConflictError("transfer_source_conflict")
    actor = UploadActor(author, resolution.organization)
    require_transfer_scope(TransferAuthority(actor), "transfer.read", transfer)
    require_dispatch_source(transfer)
    if transfer.destination_id != resolution.discrepancy.transfer.destination_id:
        raise InventoryConflictError("transfer_source_conflict")
    receipt = _effective_receipt(transfer, values["receipt_event_id"])
    candidates = receipt.receipt_lines.select_related("line__lot", "line__piece")
    matching = [row for row in candidates if _matches_observation(line.observation, row)]
    if len(matching) != 1:
        raise InventoryConflictError("transfer_source_conflict")
    received = matching[0]
    if not receipt.stock_effects.filter(
        line=received.line, kind="receive", movement__quantity=received.quantity
    ).exists():
        raise InventoryConflictError("transfer_source_conflict")
    allocated = ResolutionOutcome.objects.filter(correction_receipt_line=received).aggregate(
        total=Sum("quantity")
    )["total"] or Decimal(0)
    if allocated + stock_quantity(values["quantity"]) > received.quantity:
        raise InventoryConflictError("transfer_resolution_incomplete")
    return {
        "correction_transfer": transfer,
        "receipt_event": receipt,
        "correction_receipt_line": received,
    }


def _effective_receipt(transfer: Transfer, identifier: UUID) -> TransferEvent:
    from inventory.transfers.models import TransferSourceLink
    from reviews.effect_receipts import is_effective

    receipt = transfer.events.filter(pk=identifier, kind="receive").first()
    if receipt is None:
        raise InventoryConflictError("transfer_source_conflict")
    if receipt.declared_source_uuid is not None:
        link = (
            TransferSourceLink.objects.filter(event=receipt).select_related("source_event").first()
        )
        if link is None or not is_effective(link.source_event):
            raise InventoryConflictError("transfer_source_conflict")
    return cast(TransferEvent, receipt)


def _matches_observation(observation: dict[str, Any], receipt: TransferReceiptLine) -> bool:
    line = receipt.line
    if observation["kind"] == "unidentified_extra":
        return observation["unidentified_code"] in {
            line.lot.code,
            str(line.piece_id) if line.piece_id else "",
        }
    return (
        str(observation["lot_id"]) == str(line.lot_id)
        and str(observation.get("piece_id")) == str(line.piece_id)
        and str(observation["unit_version_id"]) == str(line.unit_version_id)
    )


def _resolve_own_holds(resolution: DiscrepancyResolution) -> None:
    for hold in resolution.discrepancy.holds.order_by("pk"):
        TransferHoldResolution.objects.create(
            organization=resolution.organization,
            created_by=resolution.created_by,
            hold=hold,
            resolution=resolution,
        )
