"""The one retained writer for dispatch and actual receipt, including exact old replay."""

from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from django.db.models import Max
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from core.snapshots import snapshot_hash
from core.time import server_now
from inventory.exceptions import InventoryConflictError
from inventory.models import Location, Lot, Piece, SupplyType, SupplyTypeVersion
from inventory.transactions import require_inventory_lock
from inventory.transfers.commands import (
    DispatchTransferCommand,
    SignedManifest,
    TransferAuthority,
    TransferTransitionResult,
)
from inventory.transfers.custody import balance
from inventory.transfers.evidence import (
    EvidenceRequest,
    bind_evidence,
    evidence_manifest,
    verify_evidence,
)
from inventory.transfers.models import (
    Discrepancy,
    DiscrepancyLine,
    Transfer,
    TransferCommandReceipt,
    TransferEvent,
    TransferHold,
    TransferLine,
    TransferReceiptLine,
)
from inventory.transfers.policy import json_facts, reconcile_scans, stock_quantity
from inventory.transfers.scope import require_transfer_scope
from inventory.transfers.stock import (
    StockLeg,
    append_stock,
    require_available,
    require_destination,
    require_safety,
)
from uploads.access import current_scope


def visible_transition(authority: TransferAuthority, identifier: UUID, kind: str) -> Transfer:
    capability = (
        None
        if authority.source is None or authority.source.review_context is None
        else authority.source.review_context.review_authorization
    )
    scope = capability.historical_scope if capability else current_scope(authority.actor)
    permission = f"transfer.{kind}"
    if permission not in scope.permissions:
        raise PermissionDenied
    transfer = (
        Transfer.objects.filter(organization=authority.actor.organization, pk=identifier)
        .select_related("organization", "origin__center", "destination__center")
        .first()
    )
    if transfer is None:
        raise Http404
    require_transfer_scope(authority, permission, transfer)
    return cast(Transfer, transfer)


def command_digest(command: DispatchTransferCommand, kind: str) -> str:
    source = command.source
    return snapshot_hash(
        json_facts(
            {
                "kind": kind,
                "transfer_id": command.transfer_id,
                "actor_id": command.actor.user.pk if source is None else source.original_actor_id,
                "source_id": None if source is None else source.event_id,
                "source_hash": None if source is None else source.payload_hash,
                "values": command.values,
            }
        )
    )


def apply_transfer_locked(command: DispatchTransferCommand, kind: str) -> TransferTransitionResult:
    require_inventory_lock(command.actor.organization.pk)
    transfer = visible_transition(
        TransferAuthority(command.actor, command.source), command.transfer_id, kind
    )
    digest = command_digest(command, kind)
    replay = _command_replay(command, transfer, digest)
    if replay is not None:
        return TransferTransitionResult(replay.event, True)
    lines = _lock_lines(transfer)
    revision = transfer.events.aggregate(last=Max("revision"))["last"] or 0
    if command.values["expected_revision"] != revision:
        raise InventoryConflictError("transfer_revision_conflict", revision)
    if transfer.events.filter(kind=kind).exists():
        raise InventoryConflictError("transfer_state_conflict")
    return (
        _dispatch(command, transfer, lines)
        if kind == "dispatch"
        else _receive(command, transfer, lines)
    )


def _command_replay(
    command: DispatchTransferCommand, transfer: Transfer, digest: str
) -> TransferCommandReceipt | None:
    previous = (
        TransferCommandReceipt.objects.filter(
            organization=transfer.organization, command_id=command.values["command_id"]
        )
        .select_related("event")
        .first()
    )
    if previous is not None and (
        previous.content_hash != digest or previous.transfer_id != transfer.pk
    ):
        raise InventoryConflictError("transfer_command_conflict")
    return previous


def _lock_lines(transfer: Transfer) -> list[TransferLine]:
    lines = list(
        transfer.lines.select_related("lot__organization", "piece", "unit_version").order_by("pk")
    )
    groups = (
        (Location, {transfer.origin_id, transfer.destination_id}),
        (SupplyType, {line.lot.supply_id for line in lines}),
        (Lot, {line.lot_id for line in lines}),
        (Piece, {line.piece_id for line in lines if line.piece_id}),
    )
    for model, identifiers in groups:
        list(
            model.objects.filter(organization=transfer.organization, pk__in=identifiers)
            .order_by("pk")
            .select_for_update(nowait=True, no_key=True)
        )
    Transfer.objects.select_for_update(nowait=True, no_key=True).get(pk=transfer.pk)
    return lines


def line_manifest(lines: list[TransferLine]) -> list[dict[str, Any]]:
    return [
        json_facts(
            {
                "id": line.pk,
                "lot_id": line.lot_id,
                "piece_id": line.piece_id,
                "quantity": line.quantity,
                "unit_version_id": line.unit_version_id,
            }
        )
        for line in lines
    ]


def _dispatch(
    command: DispatchTransferCommand, transfer: Transfer, lines: list[TransferLine]
) -> TransferTransitionResult:
    if not lines or not transfer.events.filter(kind="prepared").exists():
        raise InventoryConflictError("transfer_state_conflict")
    for line in lines:
        require_available(line, transfer.origin)
        require_safety(line, transfer.origin)
        require_destination(line, transfer.destination)
    proof = verify_evidence(
        TransferAuthority(command.actor, command.source),
        transfer,
        EvidenceRequest((command.values["signature_upload_id"],)),
    )
    event = append_event(
        command,
        transfer,
        SignedManifest(
            "dispatch", {"lines": line_manifest(lines), "evidence": evidence_manifest(proof)}
        ),
    )
    append_stock(
        event, [StockLeg(line, transfer.origin, -line.quantity, "dispatch") for line in lines]
    )
    bind_evidence(event, proof)
    append_command_receipt(command, event, "dispatch")
    return TransferTransitionResult(event)


def require_dispatch_source(transfer: Transfer) -> TransferEvent:
    dispatch = transfer.events.filter(kind="dispatch").first()
    if dispatch is None or not dispatch.evidence_refs.filter(role="signature").exists():
        raise InventoryConflictError("transfer_state_conflict")
    if dispatch.declared_source_uuid is not None:
        from inventory.transfers.models import TransferSourceLink
        from reviews.effect_receipts import is_effective

        link = (
            TransferSourceLink.objects.filter(event=dispatch).select_related("source_event").first()
        )
        if link is None or not is_effective(link.source_event):
            raise InventoryConflictError("transfer_state_conflict")
    return cast(TransferEvent, dispatch)


def _receive(
    command: DispatchTransferCommand, transfer: Transfer, lines: list[TransferLine]
) -> TransferTransitionResult:
    dispatch = require_dispatch_source(transfer)
    declared = command.values.get("dispatch_source_event_id")
    if declared is not None and str(declared) != str(dispatch.declared_source_uuid):
        raise InventoryConflictError("transfer_source_conflict")
    expected_ids = {str(line.pk) for line in lines}
    if any(
        row["kind"] == "expected" and str(row["line_id"]) not in expected_ids
        for row in command.values["scanned"]
    ):
        raise Http404
    _identified_extras(command, transfer)
    reconciliation = reconcile_scans(line_manifest(lines), command.values["scanned"])
    evidence = _missing_evidence(command, reconciliation.missing)
    proof = verify_evidence(TransferAuthority(command.actor, command.source), transfer, evidence)
    for line in lines:
        require_safety(line, transfer.destination)
    manifest = json_facts(
        {
            "dispatch_event_id": dispatch.pk,
            "lines": line_manifest(lines),
            "scanned": command.values["scanned"],
            "received": reconciliation.received,
            "missing": command.values["missing"],
            "extras": reconciliation.extras,
            "duplicates": reconciliation.duplicates,
            "evidence": evidence_manifest(proof),
        }
    )
    event = append_event(command, transfer, SignedManifest("receive", manifest))
    legs = _receipt_lines(event, lines, reconciliation.received)
    append_stock(event, legs)
    _discrepancies(event, lines, reconciliation)
    bind_evidence(event, proof)
    append_command_receipt(command, event, "receive")
    return TransferTransitionResult(event)


def _identified_extras(command: DispatchTransferCommand, transfer: Transfer) -> None:
    for scan in command.values["scanned"]:
        if scan["kind"] != "identified_extra":
            continue
        lot = Lot.objects.filter(organization=transfer.organization, pk=scan["lot_id"]).first()
        unit = SupplyTypeVersion.objects.filter(
            organization=transfer.organization, pk=scan["unit_version_id"]
        ).first()
        piece = (
            None
            if scan.get("piece_id") is None
            else Piece.objects.filter(
                organization=transfer.organization, pk=scan["piece_id"], lot=lot
            ).first()
        )
        if (
            lot is None
            or unit is None
            or unit.supply_type_id != lot.supply_id
            or (scan.get("piece_id") and piece is None)
        ):
            raise Http404
        probe = TransferLine(
            organization=transfer.organization, lot=lot, unit_version=unit, piece=piece
        )
        if balance(probe, transfer.destination) <= 0:
            raise Http404
        if transfer.lines.filter(lot=lot, piece=piece, unit_version=unit).exists():
            raise InventoryConflictError("transfer_scan_conflict")


def _missing_evidence(
    command: DispatchTransferCommand, missing: dict[str, Decimal]
) -> EvidenceRequest:
    declared: dict[str, Decimal] = {}
    coverage: dict[str, list[str]] = {}
    photos = tuple(command.values.get("evidence_ids", []))
    for row in command.values["missing"]:
        key = str(row["line_id"])
        if (
            key in declared
            or not row.get("evidence_ids")
            or not set(row["evidence_ids"]).issubset(photos)
        ):
            raise InventoryConflictError("transfer_evidence_required")
        declared[key] = stock_quantity(row["quantity"])
        for identifier in row["evidence_ids"]:
            coverage.setdefault(str(identifier), []).append(key)
    if declared != missing:
        raise InventoryConflictError("transfer_receipt_assertion_conflict")
    return EvidenceRequest((command.values["signature_upload_id"],), photos, coverage)


def _receipt_lines(
    event: TransferEvent, lines: list[TransferLine], received: dict[str, Decimal]
) -> list[StockLeg]:
    legs = []
    for line in lines:
        quantity = received.get(str(line.pk), Decimal(0))
        if quantity:
            TransferReceiptLine.objects.create(
                organization=event.organization,
                created_by=event.created_by,
                event=event,
                line=line,
                quantity=quantity,
            )
            legs.append(StockLeg(line, event.transfer.destination, quantity, "receive"))
    return legs


def _discrepancies(event: TransferEvent, lines: list[TransferLine], reconciliation: Any) -> None:  # noqa: ANN401 -- pure reconciliation result
    if not reconciliation.missing and not reconciliation.extras:
        return
    discrepancy = Discrepancy(
        organization=event.organization,
        created_by=event.created_by,
        transfer=event.transfer,
        receipt_event=event,
    )
    discrepancy.code = f"D-{discrepancy.pk.hex}"
    discrepancy.save(force_insert=True)
    index = {str(line.pk): line for line in lines}
    for key, quantity in reconciliation.missing.items():
        line = index[key]
        DiscrepancyLine.objects.create(
            organization=event.organization,
            created_by=event.created_by,
            discrepancy=discrepancy,
            kind="missing",
            line=line,
            quantity=quantity,
        )
        TransferHold.objects.get_or_create(
            organization=event.organization,
            discrepancy=discrepancy,
            lot=line.lot,
            location=event.transfer.destination,
            piece=line.piece,
            defaults={"created_by": event.created_by},
        )
    for observation in reconciliation.extras:
        DiscrepancyLine.objects.create(
            organization=event.organization,
            created_by=event.created_by,
            discrepancy=discrepancy,
            kind=observation["kind"],
            quantity=stock_quantity(observation["quantity"]),
            observation=json_facts(observation),
        )


def append_event(
    command: DispatchTransferCommand, transfer: Transfer, intent: SignedManifest
) -> TransferEvent:
    manifest, kind = intent.values, intent.kind
    source = command.source
    if source is not None and source.review_context is not None:
        context = source.review_context
        original = (
            context.review_authorization.owner_facts
            if context.review_authorization
            else context.observed_facts
        )
        manifest = {**manifest, "source_facts": original.get("transfer", {})}
    now = server_now()
    revision = (transfer.events.aggregate(last=Max("revision"))["last"] or 0) + 1
    return TransferEvent.objects.create(
        organization=transfer.organization,
        created_by=command.actor.user,
        transfer=transfer,
        kind=kind,
        revision=revision,
        manifest=manifest,
        manifest_hash=snapshot_hash(manifest),
        command_id=command.values["command_id"],
        declared_source_uuid=None if source is None else source.event_id,
        source_payload_hash="" if source is None else source.payload_hash,
        device_time=now if source is None else source.device_time,
        server_received_at=now if source is None else source.server_received_at,
    )


def append_command_receipt(
    command: DispatchTransferCommand, event: TransferEvent, kind: str
) -> None:
    TransferCommandReceipt.objects.create(
        organization=event.organization,
        created_by=event.created_by,
        command_id=command.values["command_id"],
        kind=kind,
        transfer=event.transfer,
        event=event,
        expected_revision=command.values["expected_revision"],
        content_hash=command_digest(command, kind),
        original_actor_id=command.actor.user.pk
        if command.source is None
        else command.source.original_actor_id,
        declared_source_uuid=None if command.source is None else command.source.event_id,
    )
