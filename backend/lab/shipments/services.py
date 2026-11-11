"""Organization serialization makes notification/CAS/delivery and its one debit atomic."""

from typing import Any, cast
from uuid import UUID, uuid4

from django.db.models import Sum
from django.shortcuts import get_object_or_404

from core.exceptions import FieldValidationError
from core.snapshots import snapshot_hash
from core.time import localdate, server_now
from core.void_reason import validate_void_reason, visible_length
from inventory.access import scoped_inventory
from inventory.allocations.scope import require_contexts
from inventory.models import Location, Lot, Piece, StockMovement, SupplyTypeVersion
from inventory.services import append_material_delivery_stock
from inventory.transactions import inventory_transaction
from lab.commands import canonical_values
from lab.exceptions import LabConflictError
from lab.shipments.evidence import bind_request_evidence, verified_request_evidence
from lab.shipments.models import (
    DeliveryReceipt,
    MaterialRequest,
    MaterialRequestVoid,
    NotificationEvidence,
    ShipmentVoid,
    UiebShipment,
)
from lab.shipments.selectors import request_revision, request_rows, shipment_rows
from lab.shipments.sources import append_sources, freeze_sources, resolve_sources
from lab.transactions import lab_transaction
from uploads.access import UploadActor


def create_shipment(actor: UploadActor, values: dict[str, Any]) -> UiebShipment:
    selection = resolve_sources(actor, values["source_ids"])
    with lab_transaction(actor, selection.prepared, selection.participants):
        current = resolve_sources(actor, values["source_ids"])
        if current.prepared != selection.prepared or current.participants != selection.participants:
            raise LabConflictError("shipment_state_conflict")
        if values["cutoff"] > server_now():
            raise FieldValidationError("cutoff", "future_cutoff")
        predecessor = _shipment_predecessor(actor, values)
        reason = validate_shipment_reason(values.get("reason", "")) if predecessor else ""
        snapshot = freeze_sources(current, values["cutoff"])
        shipment = UiebShipment.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            code="UIEB-" + uuid4().hex,
            cutoff=values["cutoff"],
            recipient_institution=values.get("recipient_institution", ""),
            source_snapshot=snapshot,
            content_hash=snapshot_hash(
                {
                    "sources": snapshot,
                    "cutoff": values["cutoff"].isoformat(),
                    "template": "source-projection-v1",
                }
            ),
            supersedes=predecessor,
            reason=reason,
        )
        append_sources(shipment, current)
        return shipment


def _shipment_predecessor(actor: UploadActor, values: dict[str, Any]) -> UiebShipment | None:
    if not values.get("supersedes_id"):
        return None
    previous = get_object_or_404(
        shipment_rows(actor, "shipment.create"), pk=values["supersedes_id"]
    )
    if hasattr(previous, "revision"):
        raise LabConflictError("shipment_state_conflict")
    return previous


def create_request(actor: UploadActor, values: dict[str, Any]) -> MaterialRequest:
    with inventory_transaction(actor):
        location = get_object_or_404(
            scoped_inventory(Location.objects.all(), actor, "material_request.create"),
            pk=values["location_id"],
        )
        lot = get_object_or_404(
            Lot.objects.filter(organization=actor.organization), pk=values["lot_id"]
        )
        contexts = [
            {
                "center_id": str(row.center_id),
                "quadrant_id": str(row.quadrant_id) if row.quadrant_id else None,
            }
            for row in (location,)
        ]
        require_contexts(actor, "material_request.create", contexts)
        piece = (
            get_object_or_404(
                Piece.objects.filter(organization=actor.organization, lot=lot),
                pk=values["piece_id"],
            )
            if values.get("piece_id")
            else None
        )
        quantity = values["quantity"]
        unit = _request_unit(lot, location, (piece, values.get("unit_version_id")))
        if quantity <= 0 or (unit.identity_kind == "piece" and (piece is None or quantity != 1)):
            raise FieldValidationError("quantity", "invalid_quantity")
        return MaterialRequest.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            code="MR-" + uuid4().hex,
            recipient_institution=values["recipient_institution"],
            lot=lot,
            location=location,
            piece=piece,
            unit_version=unit,
            quantity=quantity,
        )


def record_notification(
    actor: UploadActor, identifier: UUID, values: dict[str, Any]
) -> MaterialRequest:
    with inventory_transaction(actor):
        request = get_object_or_404(request_rows(actor, "material_request.notify"), pk=identifier)
        _require_open(request)
        if values["date"] > localdate(actor.organization):
            raise FieldValidationError("date", "future_date")
        uploads = verified_request_evidence(actor, request, values["evidence_ids"])
        for upload in uploads:
            NotificationEvidence.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                request=request,
                reference=values["reference"],
                date=values["date"],
                upload=upload,
            )
        bind_request_evidence(request, uploads)
        return request


def deliver_material(
    actor: UploadActor, identifier: UUID, values: dict[str, Any]
) -> DeliveryReceipt:
    with inventory_transaction(actor):
        request = get_object_or_404(request_rows(actor, "material_request.deliver"), pk=identifier)
        digest = snapshot_hash({"request_id": str(identifier), **canonical_values(values)})
        existing = DeliveryReceipt.objects.filter(
            organization=actor.organization, command_id=values["command_id"]
        ).first()
        if existing is not None:
            if (
                existing.request_id != identifier
                or existing.created_by_id != actor.user.pk
                or existing.input_hash != digest
            ):
                raise LabConflictError("material_command_conflict")
            return cast(DeliveryReceipt, existing)
        _require_open(request)
        if values["expected_revision"] != request_revision(request):
            raise LabConflictError("material_revision_conflict", request_revision(request))
        if not request.notifications.filter(
            upload__verification__isnull=False, upload__attachment__material_request=request
        ).exists():
            raise LabConflictError("cenaprece_notification_required")
        uploads = verified_request_evidence(actor, request, [values["signature_upload_id"]])
        receipt = DeliveryReceipt.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            request=request,
            command_id=values["command_id"],
            signature=uploads[0],
            expected_revision=values["expected_revision"],
            input_hash=digest,
        )
        append_material_delivery_stock(receipt, actor)
        bind_request_evidence(request, uploads)
        return receipt


def _require_open(request: MaterialRequest) -> None:
    if hasattr(request, "delivery") or hasattr(request, "void"):
        raise LabConflictError("material_state_conflict")


def validate_shipment_reason(reason: str) -> str:
    cleaned = validate_void_reason(reason, "reason")
    if visible_length(cleaned) < 10:
        raise FieldValidationError("reason", "void_reason_too_short", {"min_length": 10})
    return cleaned


def _request_unit(
    lot: Lot, location: Location, selected: tuple[Piece | None, UUID | None]
) -> SupplyTypeVersion:
    piece, identifier = selected
    balances = (
        StockMovement.objects.filter(
            organization=lot.organization, lot=lot, location=location, piece=piece
        )
        .values("unit_version_id")
        .annotate(total=Sum("quantity"))
        .filter(total__gt=0)
    )
    if identifier is not None:
        balances = balances.filter(unit_version_id=identifier)
    units = list(balances.values_list("unit_version_id", flat=True)[:2])
    if not units:
        from django.http import Http404

        raise Http404
    if len(units) != 1:
        raise FieldValidationError("unit_version_id", "required")
    return cast(
        SupplyTypeVersion,
        get_object_or_404(
            SupplyTypeVersion.objects.filter(organization=lot.organization, supply_type=lot.supply),
            pk=units[0],
        ),
    )


def void_request(actor: UploadActor, identifier: UUID, reason: str) -> None:
    cleaned = validate_shipment_reason(reason)
    with inventory_transaction(actor):
        request = get_object_or_404(request_rows(actor, "material_request.void"), pk=identifier)
        _require_open(request)
        MaterialRequestVoid.objects.create(
            organization=actor.organization, created_by=actor.user, request=request, reason=cleaned
        )


def void_shipment(actor: UploadActor, identifier: UUID, reason: str) -> None:
    cleaned = validate_shipment_reason(reason)
    with inventory_transaction(actor):
        shipment = get_object_or_404(shipment_rows(actor, "shipment.void"), pk=identifier)
        if hasattr(shipment, "revision") or hasattr(shipment, "void"):
            raise LabConflictError("shipment_state_conflict")
        ShipmentVoid.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            shipment=shipment,
            reason=cleaned,
        )
