"""Exactly-once recovery of a physical Piece, without reversing courier consumption."""

from decimal import Decimal

from django.db.models import Sum

from core.snapshots import snapshot_hash
from inventory.models import PaddleStockReturn, StockMovement, StockOperation
from inventory.transactions import require_inventory_lock
from inventory.transfers.custody import balance
from lab.exceptions import LabConflictError
from lab.models import PaddleReuse


def append_paddle_return(reuse: PaddleReuse, source: StockMovement) -> PaddleStockReturn:
    require_inventory_lock(reuse.organization_id)
    binding = reuse.binding
    piece = source.piece
    if (
        piece is None
        or source.piece_id != binding.paddle.piece_id
        or abs(source.quantity) != 1
        or source.unit_version.identity_kind != "piece"
    ):
        raise LabConflictError("lab_paddle_source_incoherent")
    total = StockMovement.objects.filter(
        organization=reuse.organization, piece=source.piece
    ).aggregate(total=Sum("quantity"))["total"] or Decimal(0)
    consumed = source.quantity == -1 and source.assignment_id is not None
    if consumed:
        if total != 0 or PaddleStockReturn.objects.filter(consumed_debit=source).exists():
            raise LabConflictError("lab_paddle_recovery_unavailable")
    elif (
        source.location_id is None
        or source.location_id != reuse.destination_id
        or source.quantity != 1
        or total != 1
        or source.location is None
        or balance(source, source.location) != 1
    ):
        raise LabConflictError("lab_paddle_custody_unavailable")
    proof = {
        "reuse_id": str(reuse.pk),
        "binding_id": str(binding.pk),
        "source_movement_id": str(source.pk),
        "piece_id": str(source.piece_id),
        "lot_id": str(source.lot_id),
        "unit_version_id": str(source.unit_version_id),
        "destination_id": str(reuse.destination_id),
        "quantity": "1",
        "kind": "consumed" if consumed else "custody",
    }
    returned = PaddleStockReturn.objects.create(
        organization=reuse.organization,
        created_by=reuse.created_by,
        reuse=reuse,
        source_movement=source,
        consumed_debit=source if consumed else None,
        piece=piece,
        lot=source.lot,
        unit_version=source.unit_version,
        source_location=None if consumed else source.location,
        destination=reuse.destination,
        kind=proof["kind"],
        content_hash=snapshot_hash(proof),
        source_proof=proof,
    )
    if not consumed:
        # Canonical return_accept ALREADY credited this exact Piece. Treatment
        # retains its genuine receipt; it does not create a second stock effect.
        return returned
    operation = StockOperation.objects.create(
        organization=reuse.organization,
        created_by=reuse.created_by,
        paddle_return=returned,
        source_kind="paddle_return",
        source_id=returned.pk,
        content_hash=returned.content_hash,
    )
    StockMovement.objects.create(
        organization=reuse.organization,
        created_by=reuse.created_by,
        operation=operation,
        line_number=1,
        lot=source.lot,
        piece=source.piece,
        unit_version=source.unit_version,
        location=reuse.destination,
        quantity=Decimal(1),
    )
    return returned
