"""B10 effects use the one signed ledger and one shared release reservation view."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from django.db.models import Sum

from inventory.allocations.models import (
    LotWriteOff,
    OriginReleaseLine,
    ReleaseCancellationLine,
    ReturnAcceptance,
    SupplyAssignment,
    SupplyAssignmentLine,
    SupplyLedgerSource,
    SupplyReceiptLine,
    SupplyStockEffect,
)
from inventory.exceptions import InventoryConflictError
from inventory.models import Location, Lot, Piece, StockMovement, StockOperation, SupplyTypeVersion
from inventory.transactions import require_inventory_lock
from inventory.transfers.custody import balance


def release_reservations(line: Any, origin: Location) -> Decimal:  # noqa: ANN401 -- actual typed ledger-line models
    """Derive exact uncredited, uncancelled release quantities; never another balance."""
    line_filter = {
        "organization": line.organization,
        "line__lot_id": line.lot_id,
        "line__piece_id": line.piece_id,
        "line__unit_version_id": line.unit_version_id,
        "release__version__assignment__origin": origin,
    }
    releases = OriginReleaseLine.objects.filter(**line_filter)
    released = releases.aggregate(total=Sum("quantity"))["total"] or Decimal(0)
    cancelled = ReleaseCancellationLine.objects.filter(
        organization=line.organization, release_line__in=releases
    ).aggregate(total=Sum("quantity"))["total"] or Decimal(0)
    credited = SupplyReceiptLine.objects.filter(
        organization=line.organization,
        release_line__in=releases,
        receipt__event__void_audit__isnull=True,
    ).aggregate(total=Sum("quantity"))["total"] or Decimal(0)
    reserved = released - cancelled - credited
    if reserved < 0:
        raise InventoryConflictError("supply_reservation_incoherent")
    return cast(Decimal, reserved)


def spendable_balance(line: Any, origin: Location) -> Decimal:  # noqa: ANN401 -- same real ledger-line seam as106
    """Operational availability requires the SAME retained cross-domain Organization lock."""
    require_inventory_lock(line.organization_id)
    return balance(line, origin) - release_reservations(line, origin)


def assignment_balance(receipt_line: SupplyReceiptLine) -> Decimal:
    source = receipt_line.release_line.line
    assignment = receipt_line.receipt.event.assignment
    return cast(
        Decimal,
        StockMovement.objects.filter(
            organization=receipt_line.organization,
            assignment=assignment,
            lot=source.lot,
            piece=source.piece,
            unit_version=source.unit_version,
        ).aggregate(total=Sum("quantity"))["total"]
        or Decimal(0),
    )


@dataclass(frozen=True)
class SupplyStockLeg:
    lot: Lot
    piece: Piece | None
    unit_version: SupplyTypeVersion
    quantity: Decimal
    kind: str
    location: Location | None = None
    assignment: SupplyAssignment | None = None
    assignment_line: SupplyAssignmentLine | None = None
    receipt_line: SupplyReceiptLine | None = None


def append_supply_stock(source: SupplyLedgerSource, legs: list[SupplyStockLeg]) -> None:
    """Only a completed typed B10 source can append real signed nonzero custody legs."""
    require_inventory_lock(source.organization_id)
    if not legs:
        return
    operation = StockOperation.objects.create(
        organization=source.organization,
        created_by=source.created_by,
        supply_source=source,
        source_kind=source.kind,
        source_id=source_identifier(source),
        content_hash=source.content_hash,
    )
    for number, leg in enumerate(legs, start=1):
        _append_leg(operation, (number, leg))


def source_identifier(source: SupplyLedgerSource) -> UUID:
    if source.event_id is not None:
        return source.event_id
    if source.compensation_id is not None:
        return source.compensation_id
    if source.execution_id is None:
        raise InventoryConflictError("supply_source_incoherent")
    if source.kind == "supply_return":
        return cast(
            UUID,
            ReturnAcceptance.objects.get(
                organization=source.organization, execution_id=source.execution_id
            ).pk,
        )
    if source.kind == "lot_write_off":
        return cast(
            UUID,
            LotWriteOff.objects.get(
                organization=source.organization, execution_id=source.execution_id
            ).pk,
        )
    raise InventoryConflictError("supply_source_incoherent")


def _append_leg(operation: StockOperation, item: tuple[int, SupplyStockLeg]) -> None:
    number, leg = item
    if not leg.quantity or (leg.location is None) == (leg.assignment is None):
        raise InventoryConflictError("supply_source_incoherent")
    movement = StockMovement.objects.create(
        organization=operation.organization,
        created_by=operation.created_by,
        operation=operation,
        line_number=number,
        lot=leg.lot,
        location=leg.location,
        assignment=leg.assignment,
        piece=leg.piece,
        quantity=leg.quantity,
        unit_version=leg.unit_version,
    )
    source = operation.supply_source
    if source is None:
        raise InventoryConflictError("supply_source_required")
    SupplyStockEffect.objects.create(
        organization=operation.organization,
        created_by=operation.created_by,
        source=source,
        movement=movement,
        assignment_line=leg.assignment_line,
        receipt_line=leg.receipt_line,
        kind=leg.kind,
    )
