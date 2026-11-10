"""Lot revisions/admission and locked safety checks; no editable balance API."""

from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.http import Http404

from core.exceptions import FieldValidationError
from core.snapshots import snapshot_hash
from inventory.access import require_action, require_scope
from inventory.exceptions import InventoryConflictError
from inventory.masters import MasterChange, identity, require_revision, revision_values
from inventory.models import (
    BiologicalProtocolVersion,
    Location,
    Lot,
    LotAdmission,
    LotVersion,
    Piece,
    StockMovement,
    StockOperation,
    SupplyType,
    SupplyTypeVersion,
)
from inventory.policy import SQL_BATCH_SIZE, LotSafety, validate_piece_quantity
from inventory.selectors import (
    current_location,
    current_lot,
    current_supply,
    lot_safety,
    missing_fields,
    protocol_ready,
)
from inventory.transactions import inventory_transaction, require_inventory_lock
from organizations.models import Center
from uploads.access import UploadActor

if TYPE_CHECKING:
    from lab.shipments.models import DeliveryReceipt


@dataclass(frozen=True)
class LotChange(MasterChange):
    pass


def revise_lot(command: LotChange) -> LotVersion:
    permission = "lot.update" if command.identifier else "lot.create"
    with inventory_transaction(command.actor) as organization:
        require_action(command.actor, permission)
        placement = _lot_placement(command) if command.identifier is None else None
        target = identity(Lot, command, permission)
        previous = current_lot(target) if target else None
        require_revision(previous, command.expected_revision)
        target = target or _create_lot(command, placement)
        _require_lot_identity_references(command.actor, command.values, permission)
        _retain_lot_identity(target, command.values)
        values = revision_values(previous) if previous else {}
        values.update(
            {
                key: value
                for key, value in command.values.items()
                if key not in {"code", "supply_id", "center_id", "quadrant_id"}
            }
        )
        if "expires_at" in command.values and "expiry_date" not in command.values:
            values["expiry_date"] = None
        if "supply_version_id" in command.values and "protocol_id" not in command.values:
            values.pop("protocol_id", None)
        _bind_lot_references(command.actor, target, values)
        _retain_admission(target, values)
        values.update(
            lot=target,
            revision=command.expected_revision + 1,
            timezone=organization.timezone,
        )
        try:
            _resolve_expiry(values)
        except OverflowError as error:
            raise FieldValidationError("expires_at", "out_of_range") from error
        version = LotVersion.objects.create(
            organization=organization, created_by=command.actor.user, **values
        )
        _admit_if_complete(command.actor, version)
        return cast(LotVersion, version)


def _lot_placement(command: LotChange) -> tuple[Center, Location | None]:
    """Authorize actual storage context before any code-existence lookup."""
    location = _location(command.actor, command.values.get("initial_location_id"), "lot.create")
    center_id = command.values.get("center_id")
    if location is None and center_id is None:
        raise FieldValidationError("center_id", "required")
    center = (
        location.center
        if location
        else Center.objects.filter(
            organization=command.actor.organization,
            pk=cast(UUID, center_id),
            is_active=True,
        ).first()
    )
    if center is None:
        raise Http404
    require_scope(command.actor, "lot.create", location or center)
    if command.values.get("center_id") and command.values["center_id"] != center.pk:
        raise Http404
    return cast(Center, center), location


def _create_lot(command: LotChange, placement: tuple[Center, Location | None] | None) -> Lot:
    if placement is None:
        raise ValueError("A known storage placement is required.")
    center, location = placement
    supply = SupplyType.objects.filter(
        organization=command.actor.organization, pk=command.values["supply_id"]
    ).first()
    if supply is None:
        raise Http404
    if not current_supply(supply).is_active:
        raise InventoryConflictError("supply_type_inactive")
    return cast(
        Lot,
        Lot.objects.create(
            organization=command.actor.organization,
            created_by=command.actor.user,
            code=command.values["code"],
            supply=supply,
            center=center,
            quadrant_id=location.quadrant_id if location else None,
        ),
    )


def _location(actor: UploadActor, identifier: UUID | None, permission: str) -> Location | None:
    if identifier is None:
        return None
    location = Location.objects.filter(organization=actor.organization, pk=identifier).first()
    if location is None or not location.center.is_active:
        raise Http404
    require_scope(actor, permission, location)
    return cast(Location, location)


def _bind_lot_references(actor: UploadActor, lot: Lot, values: dict[str, Any]) -> None:
    location = _location(
        actor,
        values.get("initial_location_id"),
        "lot.update" if lot.versions.exists() else "lot.create",
    )
    if location and (
        location.center_id != lot.center_id or location.quadrant_id != lot.quadrant_id
    ):
        raise Http404
    current = current_supply(lot.supply)
    if not current.is_active:
        raise InventoryConflictError("supply_type_inactive")
    supply = SupplyTypeVersion.objects.filter(
        organization=actor.organization,
        supply_type=lot.supply,
        pk=values.get("supply_version_id", current.pk),
    ).first()
    if supply is None:
        raise Http404
    protocol = _lot_protocol(supply, values)
    values.update(
        supply_version=supply,
        protocol=protocol,
        location_version=current_location(location) if location else None,
    )
    for key in ("supply_version_id", "protocol_id", "location_version_id"):
        values.pop(key, None)


def _lot_protocol(
    supply: SupplyTypeVersion, values: dict[str, Any]
) -> BiologicalProtocolVersion | None:
    if "protocol_id" in values and values["protocol_id"] is None:
        return None
    query = BiologicalProtocolVersion.objects.filter(supply_version=supply)
    if "protocol_id" in values:
        protocol = query.filter(pk=values["protocol_id"]).first()
        if protocol is None:
            raise Http404
        return cast(BiologicalProtocolVersion, protocol)
    return cast(BiologicalProtocolVersion | None, query.first())


def _require_lot_identity_references(
    actor: UploadActor, values: dict[str, Any], permission: str
) -> None:
    if (
        "supply_id" in values
        and not SupplyType.objects.filter(
            organization=actor.organization, pk=values["supply_id"]
        ).exists()
    ):
        raise Http404
    if "center_id" in values:
        center = Center.objects.filter(
            organization=actor.organization, pk=values["center_id"]
        ).first()
        if center is None:
            raise Http404
        require_scope(actor, permission, center)


def _retain_lot_identity(target: Lot, values: dict[str, Any]) -> None:
    for field in ("code", "supply_id", "center_id", "quadrant_id"):
        if field in values and values[field] != getattr(target, field):
            raise InventoryConflictError("inventory_identity_conflict")


def _retain_admission(lot: Lot, values: dict[str, Any]) -> None:
    admission = LotAdmission.objects.filter(lot=lot).first()
    if admission and (
        values.get("quantity") != admission.quantity
        or values.get("initial_location_id") != admission.location_id
    ):
        raise InventoryConflictError("inventory_has_dependents")


def _resolve_expiry(values: dict[str, Any]) -> None:
    zone = ZoneInfo(values["timezone"])
    expiry_date = values.get("expiry_date")
    if expiry_date:
        values["expires_at"] = datetime.combine(expiry_date + timedelta(days=1), time.min, zone)
    protocol = values["protocol"]
    if (
        protocol
        and protocol.shelf_life_seconds
        and protocol.expiry_basis == "laid_on"
        and values.get("laid_on")
    ):
        maximum = datetime.combine(values["laid_on"], time.min, zone).astimezone(UTC) + timedelta(
            seconds=protocol.shelf_life_seconds
        )
        if values.get("expires_at") and values["expires_at"] > maximum:
            raise FieldValidationError("expires_at", "expiry_exceeds_protocol")
        values["expires_at"] = values.get("expires_at") or maximum


def _admit_if_complete(actor: UploadActor, version: LotVersion) -> None:
    require_inventory_lock(actor.organization.pk)
    if LotAdmission.objects.filter(lot=version.lot).exists() or missing_fields(version):
        return
    if version.supply_version.is_biological and (
        not protocol_ready(version.protocol)
        or version.supply_version.requires_insecticide_free is None
    ):
        return
    quantity = version.quantity
    if quantity is None or quantity <= 0 or version.initial_location is None:
        raise FieldValidationError("quantity", "min_value")
    count = _piece_count(version, quantity)
    admission = LotAdmission.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        lot=version.lot,
        lot_version=version,
        location=version.initial_location,
        quantity=quantity,
    )
    _opening_movements(actor, admission, count)


def _piece_count(version: LotVersion, quantity: Decimal) -> int | None:
    if version.supply_version.identity_kind != "piece":
        return None
    try:
        return validate_piece_quantity(quantity)
    except ValueError as error:
        raise FieldValidationError("quantity", "piece_quantity_limit") from error


def _opening_movements(actor: UploadActor, admission: LotAdmission, count: int | None) -> None:
    version = admission.lot_version
    operation = StockOperation.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        admission=admission,
        source_kind="lot_admission",
        source_id=admission.pk,
        content_hash=snapshot_hash(
            {
                "lot": str(admission.lot_id),
                "location": str(admission.location_id),
                "quantity": str(admission.quantity),
                "version": str(version.pk),
            }
        ),
    )
    pieces = [
        Piece(
            organization=actor.organization,
            created_by=actor.user,
            lot=admission.lot,
            admission=admission,
        )
        for _ in range(count or 0)
    ]
    if pieces:
        Piece.objects.bulk_create(pieces, batch_size=SQL_BATCH_SIZE)
    movements = [
        StockMovement(
            organization=actor.organization,
            created_by=actor.user,
            operation=operation,
            line_number=index + 1,
            lot=admission.lot,
            location=admission.location,
            piece=piece,
            quantity=Decimal(1) if piece else admission.quantity,
            unit_version=version.supply_version,
        )
        for index, piece in enumerate(pieces or [None])
    ]
    StockMovement.objects.bulk_create(movements, batch_size=SQL_BATCH_SIZE)


def require_dispatchable(
    lot: Lot, actor: UploadActor, location: Location | None = None
) -> LotSafety:
    """Future debits must call this gate while retaining the same transaction/arbiter."""
    require_inventory_lock(lot.organization_id)
    require_scope(actor, "lot.read", location if location is not None else lot)
    safety = lot_safety(current_lot(lot), location=location)
    if safety.status != "available":
        raise InventoryConflictError("inventory_not_dispatchable")
    return safety


def append_material_delivery_stock(receipt: "DeliveryReceipt", actor: UploadActor) -> None:
    """Debit one real external delivery under the shared inventory arbiter."""
    from inventory.allocations.stock import spendable_balance

    request = receipt.request
    require_inventory_lock(actor.organization.pk)
    require_scope(actor, "material_request.deliver", request.location)
    _require_material_delivery_identity(receipt, actor)
    require_dispatchable(request.lot, actor, request.location)
    if spendable_balance(request, request.location) < request.quantity:
        raise InventoryConflictError("material_delivery_insufficient_stock")
    operation = StockOperation.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        material_delivery=receipt,
        source_kind="material_delivery",
        source_id=receipt.pk,
        content_hash=receipt.input_hash,
    )
    StockMovement.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        operation=operation,
        line_number=1,
        lot=request.lot,
        location=request.location,
        piece=request.piece,
        unit_version=request.unit_version,
        quantity=-request.quantity,
    )


def _require_material_delivery_identity(receipt: "DeliveryReceipt", actor: UploadActor) -> None:
    request = receipt.request
    if (
        receipt.organization_id != actor.organization.pk
        or request.organization_id != actor.organization.pk
        or request.lot.organization_id != actor.organization.pk
        or request.unit_version.organization_id != actor.organization.pk
        or request.unit_version.supply_type_id != request.lot.supply_id
        or receipt.created_by_id != actor.user.pk
    ):
        raise Http404
    unit = request.unit_version
    if not request.quantity.is_finite() or request.quantity <= 0:
        raise InventoryConflictError("material_delivery_quantity_invalid")
    if not request.location.center.is_active:
        raise InventoryConflictError("material_delivery_storage_unavailable")
    if unit.identity_kind == "lot" and request.piece_id is None:
        return
    if (
        unit.identity_kind != "piece"
        or request.quantity != 1
        or request.piece is None
        or request.piece.organization_id != actor.organization.pk
        or request.piece.lot_id != request.lot_id
    ):
        raise InventoryConflictError("material_delivery_identity_invalid")
