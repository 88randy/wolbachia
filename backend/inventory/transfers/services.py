"""Public actor-first entry points; effects delegate to one retained locked writer."""

from dataclasses import replace
from typing import Any, cast
from uuid import uuid4

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from core.snapshots import snapshot_hash
from core.time import server_now
from inventory.exceptions import InventoryConflictError
from inventory.models import Location, Lot, Piece, SupplyTypeVersion
from inventory.selectors import current_location
from inventory.transfers.commands import (
    DispatchTransferCommand,
    PrepareTransferCommand,
    ReceiveTransferCommand,
    ResolutionCommand,
    TransferAuthority,
    TransferTransitionResult,
)
from inventory.transfers.custody import balance
from inventory.transfers.models import Transfer, TransferEvent, TransferLine
from inventory.transfers.policy import TransferPolicyError, json_facts, stock_quantity
from inventory.transfers.scope import allows_transfer_vector, require_transfer_scope
from inventory.transfers.transactions import transfer_transaction
from uploads.access import current_scope


def prepare_transfer(command: PrepareTransferCommand) -> TransferTransitionResult:
    _placements(command)
    with transfer_transaction(command.actor) as organization:
        origin, destination = _placements(command)
        values = json_facts(command.values)
        digest = snapshot_hash(values)
        existing = Transfer.objects.filter(organization=organization, code=values["code"]).first()
        if existing is not None:
            require_transfer_scope(TransferAuthority(command.actor), "transfer.create", existing)
            if existing.content_hash != digest or existing.created_by_id != command.actor.user.pk:
                raise InventoryConflictError("transfer_command_conflict")
            return TransferTransitionResult(existing.events.get(kind="prepared"), True)
        transfer = Transfer.objects.create(
            organization=organization,
            created_by=command.actor.user,
            code=values["code"],
            origin=origin,
            destination=destination,
            content_hash=digest,
        )
        lines = sorted(
            [_prepare_line(command, transfer, row) for row in command.values["lines"]],
            key=lambda row: row["id"],
        )
        event = TransferEvent.objects.create(
            organization=organization,
            created_by=command.actor.user,
            transfer=transfer,
            revision=1,
            kind="prepared",
            manifest={"lines": lines, "evidence": []},
            manifest_hash=snapshot_hash({"lines": lines, "evidence": []}),
            command_id=uuid4(),
            device_time=server_now(),
            server_received_at=server_now(),
        )
        return TransferTransitionResult(event)


def _placements(command: PrepareTransferCommand) -> tuple[Location, Location]:
    scope = current_scope(command.actor)
    if "transfer.create" not in scope.permissions:
        raise PermissionDenied
    locations = []
    for key in ("origin_id", "destination_id"):
        location = (
            Location.objects.filter(organization=command.actor.organization, pk=command.values[key])
            .select_related("center")
            .first()
        )
        if location is None:
            raise Http404
        locations.append(location)
    vector = tuple(
        {
            "center_id": str(row.center_id),
            "quadrant_id": str(row.quadrant_id) if row.quadrant_id else None,
        }
        for row in locations
    )
    if locations[0].pk == locations[1].pk or not allows_transfer_vector(
        scope, "transfer.create", vector
    ):
        raise Http404
    if any(not row.center.is_active for row in locations):
        raise InventoryConflictError("transfer_storage_unavailable")
    return locations[0], locations[1]


def _prepare_line(
    command: PrepareTransferCommand, transfer: Transfer, values: dict[str, Any]
) -> dict[str, Any]:
    lot = Lot.objects.filter(organization=transfer.organization, pk=values["lot_id"]).first()
    unit = SupplyTypeVersion.objects.filter(
        organization=transfer.organization, pk=values["unit_version_id"]
    ).first()
    piece = (
        None
        if values.get("piece_id") is None
        else Piece.objects.filter(
            organization=transfer.organization, pk=values["piece_id"], lot=lot
        ).first()
    )
    if lot is None or unit is None or unit.supply_type_id != lot.supply_id:
        raise Http404
    if values.get("piece_id") is not None and piece is None:
        raise Http404
    quantity = stock_quantity(values["quantity"])
    candidate = TransferLine(
        organization=transfer.organization,
        created_by=command.actor.user,
        transfer=transfer,
        lot=lot,
        piece=piece,
        unit_version=unit,
        quantity=quantity,
        origin_version=current_location(transfer.origin),
        destination_version=current_location(transfer.destination),
    )
    if balance(candidate, transfer.origin) <= 0:
        raise Http404
    if (unit.identity_kind == "piece") != (piece is not None) or (piece and quantity != 1):
        raise InventoryConflictError("transfer_identity_conflict")
    candidate.save(force_insert=True)
    return cast(
        dict[str, Any],
        json_facts(
            {
                "id": candidate.pk,
                "lot_id": lot.pk,
                "piece_id": piece.pk if piece else None,
                "unit_version_id": unit.pk,
                "quantity": quantity,
            }
        ),
    )


def dispatch_transfer(command: DispatchTransferCommand) -> TransferTransitionResult:
    return _transition(command, "dispatch")


def receive_transfer(command: ReceiveTransferCommand) -> TransferTransitionResult:
    return _transition(command, "receive")


def _transition(command: DispatchTransferCommand, kind: str) -> TransferTransitionResult:
    from inventory.transfers.transitions import apply_transfer_locked, visible_transition

    visible_transition(TransferAuthority(command.actor, command.source), command.transfer_id, kind)
    from inventory.transfers.dependencies import source_references

    references = tuple(
        source_references(
            command.actor.organization, {**command.values, "transfer_id": command.transfer_id}
        )
    )
    try:
        with transfer_transaction(command.actor, references):
            return apply_transfer_locked(command, kind)
    except TransferPolicyError as error:
        raise InventoryConflictError(str(error)) from error


def resolve_discrepancy(command: ResolutionCommand) -> TransferTransitionResult:
    from inventory.transfers.dependencies import resolution_references
    from inventory.transfers.resolutions import apply_resolution_locked, visible_discrepancy

    discrepancy = visible_discrepancy(command.actor, command.discrepancy_id)
    references = resolution_references(command.actor, discrepancy, command.values)
    try:
        with transfer_transaction(command.actor, tuple(sorted(references))):
            return apply_resolution_locked(
                replace(command, source_references=frozenset(references))
            )
    except TransferPolicyError as error:
        raise InventoryConflictError(str(error)) from error
