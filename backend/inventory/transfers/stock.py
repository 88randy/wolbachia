"""Only server-proven signed transfer legs enter the one existing inventory ledger."""

from dataclasses import dataclass
from decimal import Decimal

from inventory.exceptions import InventoryConflictError
from inventory.models import Location, StockMovement, StockOperation
from inventory.selectors import current_location, current_lot, lot_safety
from inventory.transactions import require_inventory_lock
from inventory.transfers.models import TransferEvent, TransferLine, TransferStockEffect


@dataclass(frozen=True)
class StockLeg:
    line: TransferLine
    location: Location
    quantity: Decimal
    kind: str


def require_available(line: TransferLine, origin: Location) -> None:
    from inventory.allocations.stock import spendable_balance

    require_inventory_lock(line.organization_id)
    if spendable_balance(line, origin) < line.quantity:
        raise InventoryConflictError("transfer_insufficient_stock")


def require_safety(line: TransferLine, location: Location) -> None:
    require_inventory_lock(line.organization_id)
    if not location.center.is_active:
        raise InventoryConflictError("transfer_storage_unavailable")
    safety = lot_safety(current_lot(line.lot), location=location)
    if safety.status != "available":
        raise InventoryConflictError(
            safety.blocked_by[0] if safety.blocked_by else "inventory_not_dispatchable"
        )


def require_destination(line: TransferLine, destination: Location) -> None:
    if not destination.center.is_active:
        raise InventoryConflictError("transfer_storage_unavailable")
    version = current_lot(line.lot)
    if not version.supply_version.is_biological:
        return
    required = version.supply_version.requires_insecticide_free
    if required is None or (
        required and current_location(destination).is_insecticide_free is not True
    ):
        raise InventoryConflictError("storage_safety_not_configured")


def append_stock(event: TransferEvent, legs: list[StockLeg]) -> None:
    require_inventory_lock(event.organization_id)
    if not legs:
        return
    operation = StockOperation.objects.create(
        organization=event.organization,
        created_by=event.created_by,
        transfer_event=event,
        source_kind=f"transfer_{event.kind}",
        source_id=event.pk,
        content_hash=event.manifest_hash,
    )
    for number, leg in enumerate(legs, start=1):
        movement = StockMovement.objects.create(
            organization=event.organization,
            created_by=event.created_by,
            operation=operation,
            line_number=number,
            lot=leg.line.lot,
            location=leg.location,
            piece=leg.line.piece,
            quantity=leg.quantity,
            unit_version=leg.line.unit_version,
        )
        TransferStockEffect.objects.create(
            organization=event.organization,
            created_by=event.created_by,
            transfer=event.transfer,
            event=event,
            line=leg.line,
            kind=leg.kind,
            movement=movement,
        )
