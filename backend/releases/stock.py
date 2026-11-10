"""Release effects debit genuine courier custody through the one inventory ledger."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import Q

from core.snapshots import snapshot_hash
from core.time import server_now
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext
from inventory.allocations.models import CourierTransitPolicyVersion, SupplyReceiptLine
from inventory.allocations.reconciliation import receipt_remaining
from inventory.allocations.stock import assignment_balance
from inventory.models import LotVersion, StockMovement, StockOperation
from inventory.policy import LotSafetySnapshot, evaluate_transit_lot
from inventory.selectors import (
    current_lot,
    current_supply,
    missing_fields,
    protocol_ready,
    unresolved_breaches,
)
from inventory.transactions import require_inventory_lock
from inventory.transfers.models import TransferHold
from releases.models import Permit, Release, ReleaseDevice
from reviews.effect_receipts import effective_effects


@dataclass(frozen=True)
class ReleaseStock:
    receipt_line: SupplyReceiptLine
    lot_version: LotVersion
    transit_policy: CourierTransitPolicyVersion
    quantity: Decimal

    def provenance(self) -> dict[str, str]:
        line = self.receipt_line
        return {
            "receipt_line_id": str(line.pk),
            "receipt_source_event_id": str(line.receipt.event.declared_source_uuid),
            "assignment_id": str(line.receipt.event.assignment_id),
            "unit_version_id": str(line.release_line.line.unit_version_id),
            "lot_version_id": str(self.lot_version.pk),
            "transit_policy_id": str(self.transit_policy.pk),
            "transit_mode": self.transit_policy.mode,
            "quantity": format(self.quantity, "f"),
        }


def release_source_references(ctx: EventContext) -> set[UUID]:
    """Discover real receipt sources before account/Organization arbitration."""
    try:
        lot_id = UUID(str(ctx.envelope.payload["lot_id"]))
        return set(
            _candidates(ctx, lot_id).values_list(
                "receipt__event__source_link__source_event_id", flat=True
            )
        )
    except (KeyError, ValueError, TypeError, EventRejected):
        return set()


def release_participants(ctx: EventContext) -> set[UUID]:
    """No source or author is first row-locked below the shared inventory arbiter."""
    from field_sync.models import FieldEvent

    identifiers = FieldEvent.objects.filter(
        organization=ctx.organization, pk__in=release_source_references(ctx)
    ).values_list("created_by_id", flat=True)
    return {identifier for identifier in identifiers if identifier is not None} | {ctx.user.pk}


def validate_release_stock(ctx: EventContext, lot_id: UUID, quantity: Decimal) -> ReleaseStock:
    """Manual transit review never overrides expiry, holds or actual custody limits."""
    require_inventory_lock(ctx.organization.pk)
    if not quantity.is_finite() or quantity <= 0:
        raise EventRejected("release_stock_unavailable")
    candidates = _candidates(ctx, lot_id)
    for line in candidates:
        if receipt_remaining(line) >= quantity and assignment_balance(line) >= quantity:
            pin = _stock_pin(ctx, line, quantity)
            ctx.observed_facts["release_stock"] = pin.provenance()
            _require_original_pin(ctx, pin)
            if not ctx.acknowledges("release_transit_review_required"):
                raise EventNeedsReview("release_transit_review_required")
            if ctx.review_authorization is None or ctx.review_authorization.reviewer_actor is None:
                raise EventRejected(
                    "release_lot_blocked", {"reason": "release_transit_reviewer_unavailable"}
                )
            return pin
    raise EventRejected("release_stock_unavailable")


def _candidates(ctx: EventContext, lot_id: UUID) -> Any:  # noqa: ANN401 -- concrete scoped QuerySet[SupplyReceiptLine]
    permit = Permit.objects.filter(
        organization=ctx.organization, pk=UUID(str(ctx.envelope.payload["permit_id"]))
    ).first()
    if permit is None:
        raise EventRejected("release_stock_unavailable")
    day = ctx.envelope.device_time.astimezone(ZoneInfo(ctx.organization.timezone)).date()
    rows = (
        SupplyReceiptLine.objects.filter(
            organization=ctx.organization,
            release_line__line__lot_id=lot_id,
            receipt__event__assignment__courier=ctx.user,
            receipt__event__assignment__origin__center_id=permit.center_id,
            receipt__event__device_time__lte=ctx.envelope.device_time,
            receipt__event__void_audit__isnull=True,
            receipt__event__source_link__source_event__voided_at__isnull=True,
        )
        .filter(
            Q(receipt__event__assignment__shift_id=ctx.envelope.shift_id)
            | Q(
                receipt__event__assignment__shift__isnull=True, receipt__event__assignment__date=day
            )
        )
        .filter(
            Q(receipt__event__assignment__origin__quadrant_id=permit.quadrant_id)
            | Q(receipt__event__assignment__origin__quadrant__isnull=True)
        )
    )
    authorization = ctx.review_authorization
    if authorization is not None:
        original = authorization.owner_facts.get("release_stock")
        if not isinstance(original, dict) or not original.get("receipt_line_id"):
            raise EventRejected("release_stock_unavailable")
        rows = rows.filter(pk=original["receipt_line_id"])
    return (
        effective_effects(rows, "receipt__event__source_link__source_event")
        .select_related(
            "receipt__event__assignment__origin",
            "release_line__line__lot",
            "release_line__line__unit_version",
            "release_line__line__piece",
        )
        .order_by("pk")
    )


def _stock_pin(ctx: EventContext, line: SupplyReceiptLine, quantity: Decimal) -> ReleaseStock:
    source = line.release_line.line
    if source.piece_id is not None and quantity != 1:
        raise EventRejected("release_stock_unavailable")
    version = current_lot(source.lot)
    _require_safety(ctx, (version, line))
    policy = CourierTransitPolicyVersion.objects.filter(
        organization=ctx.organization, supply_version=source.unit_version
    ).first()
    if (
        policy is None
        or not policy.is_active
        or policy.mode != "manual_evidence_review"
        or policy.proof_roles != ["photo"]
        or line.release_line.transit_policy_id != policy.pk
    ):
        raise EventRejected("release_lot_blocked", {"reason": "release_transit_policy_unavailable"})
    if not ctx.envelope.payload.get("evidence_ids"):
        raise EventRejected(
            "release_lot_blocked", {"reason": "release_transit_evidence_unavailable"}
        )
    return ReleaseStock(line, version, policy, quantity)


def _require_safety(ctx: EventContext, source: tuple[LotVersion, SupplyReceiptLine]) -> None:
    version, line = source
    device = (
        ReleaseDevice.objects.filter(
            organization=ctx.organization,
            pk=ctx.envelope.payload["release_device_id"],
            source_lot=version.lot,
        )
        .select_related("source_lot_version")
        .first()
    )
    if device is None:
        raise EventRejected("release_stock_unavailable")
    checks = ((device.source_lot_version, ctx.envelope.device_time), (version, server_now()))
    for checked_version, at in checks:
        safety = evaluate_transit_lot(_lot_snapshot(checked_version, line), at)
        if safety.status != "available":
            raise EventRejected(
                "release_lot_blocked",
                {"reason": safety.blocked_by[0] if safety.blocked_by else "lot_incomplete"},
            )


def _lot_snapshot(version: LotVersion, line: SupplyReceiptLine) -> LotSafetySnapshot:
    unit = line.release_line.line.unit_version
    if not unit.is_biological:
        raise EventRejected("release_lot_blocked", {"reason": "biological_lot_required"})
    if version.supply_version_id != unit.pk:
        raise EventRejected("release_lot_blocked", {"reason": "supply_version_changed"})
    holds = TransferHold.objects.filter(
        lot=version.lot, location=line.receipt.event.assignment.origin, resolution__isnull=True
    )
    return LotSafetySnapshot(
        unit.is_biological,
        current_supply(version.lot.supply).is_active,
        missing_fields(version),
        version.expires_at,
        protocol_ready(version.protocol),
        None,
        None,
        frozenset(),
        tuple(str(pk) for pk in unresolved_breaches(version.lot).values_list("pk", flat=True)),
        tuple(str(pk) for pk in holds.values_list("pk", flat=True)),
    )


def _require_original_pin(ctx: EventContext, pin: ReleaseStock) -> None:
    authorization = ctx.review_authorization
    if (
        authorization is not None
        and authorization.owner_facts.get("release_stock") != pin.provenance()
    ):
        raise EventRejected("release_stock_unavailable")


def append_release_stock(release: Release, pin: ReleaseStock) -> StockOperation:
    """The immutable Release source owns exactly one negative same-custodian leg."""
    require_inventory_lock(release.organization_id)
    existing = StockOperation.objects.filter(release=release).first()
    if existing is not None:
        return cast(StockOperation, existing)
    line = pin.receipt_line
    source = line.release_line.line
    if (
        release.quantity != pin.quantity
        or release.lot_id != source.lot_id
        or release.created_by_id != line.receipt.event.assignment.courier_id
    ):
        raise EventRejected("release_stock_unavailable")
    if receipt_remaining(line) < pin.quantity or assignment_balance(line) < pin.quantity:
        raise EventRejected("release_stock_unavailable")
    operation = StockOperation.objects.create(
        organization=release.organization,
        created_by=release.created_by,
        release=release,
        release_receipt_line=line,
        source_kind="release_record",
        source_id=release.pk,
        content_hash=snapshot_hash(pin.provenance()),
    )
    StockMovement.objects.create(
        organization=release.organization,
        created_by=release.created_by,
        operation=operation,
        line_number=1,
        lot=source.lot,
        piece=source.piece,
        unit_version=source.unit_version,
        quantity=-pin.quantity,
        assignment=line.receipt.event.assignment,
    )
    return operation
