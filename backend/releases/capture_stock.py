"""Read-only courier custody and the SAME original/current transit safety as B20."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from django.db.models import Q, QuerySet

from field_sync.exceptions import EventRejected
from field_sync.producers import ProducerContext
from inventory.allocations.models import CourierTransitPolicyVersion, SupplyReceiptLine
from inventory.allocations.reconciliation import receipt_remaining
from inventory.allocations.stock import assignment_balance
from inventory.models import StockOperation
from inventory.policy import evaluate_transit_lot
from inventory.selectors import current_lot
from releases.models import Permit, ReleaseDevice
from releases.stock import _lot_snapshot
from reviews.effect_receipts import effective_effects


def capture_receipt_lines(ctx: ProducerContext, permit: Permit) -> QuerySet[SupplyReceiptLine]:
    """Same genuine own source candidates as ingestion; the client still matches shift/day."""
    rows = SupplyReceiptLine.objects.filter(
        organization=ctx.organization,
        receipt__event__assignment__courier=ctx.user,
        receipt__event__assignment__origin__center_id=permit.center_id,
        receipt__event__device_time__lte=ctx.now,
        receipt__event__void_audit__isnull=True,
        receipt__event__source_link__source_event__voided_at__isnull=True,
    ).filter(
        Q(receipt__event__assignment__origin__quadrant_id=permit.quadrant_id)
        | Q(receipt__event__assignment__origin__quadrant__isnull=True)
    )
    return (
        effective_effects(rows, "receipt__event__source_link__source_event")
        .select_related(
            "receipt__event__assignment__origin",
            "release_line__line__lot__supply",
            "release_line__line__unit_version",
            "release_line__line__piece",
        )
        .order_by("pk")
    )


def _lot_blockers(
    ctx: ProducerContext, line: SupplyReceiptLine, device: ReleaseDevice
) -> list[str]:
    current = current_lot(device.source_lot)
    blockers: list[str] = []
    for version in (device.source_lot_version, current):
        try:
            safety = evaluate_transit_lot(_lot_snapshot(version, line), ctx.now)
            blockers.extend(safety.blocked_by)
            if safety.missing_fields:
                blockers.append("lot_incomplete")
        except EventRejected as error:
            blockers.append(str(error.params.get("reason", error.code)))
    return list(dict.fromkeys(blockers))


def _policy(line: SupplyReceiptLine) -> tuple[CourierTransitPolicyVersion | None, list[str]]:
    policy = CourierTransitPolicyVersion.objects.filter(
        organization=line.organization, supply_version=line.release_line.line.unit_version
    ).first()
    valid = (
        policy is not None
        and policy.is_active
        and policy.mode == "manual_evidence_review"
        and policy.proof_roles == ["photo"]
        and line.release_line.transit_policy_id == policy.pk
    )
    return policy, [] if valid else ["release_transit_policy_unavailable"]


def capture_custody(
    ctx: ProducerContext, line: SupplyReceiptLine, device: ReleaseDevice
) -> dict[str, Any]:
    source = line.release_line.line
    event = line.receipt.event
    current = current_lot(device.source_lot)
    policy, policy_blockers = _policy(line)
    available = max(Decimal(0), min(receipt_remaining(line), assignment_balance(line)))
    return {
        "receipt_line_id": str(line.pk),
        "receipt_source_event_id": str(event.source_link.source_event_id),
        "assignment_id": str(event.assignment_id),
        "assignment_date": event.assignment.date.isoformat(),
        "shift_id": None if event.assignment.shift_id is None else str(event.assignment.shift_id),
        "unit_version_id": str(source.unit_version_id),
        "piece_id": None if source.piece_id is None else str(source.piece_id),
        "available_quantity": format(available, "f"),
        "accounted_release_event_ids": _accounted_releases(line),
        "received_at": event.device_time.isoformat(),
        "source_lot_version_id": str(device.source_lot_version_id),
        "current_lot_version_id": str(current.pk),
        "source_expires_at": _instant(device.source_lot_version.expires_at),
        "current_expires_at": _instant(current.expires_at),
        "transit_policy_id": None if policy is None else str(policy.pk),
        "transit_mode": None if policy is None else policy.mode,
        "proof_roles": [] if policy is None else policy.proof_roles,
        "requires_evidence": policy is not None and "photo" in policy.proof_roles,
        "blocked_by": [*_lot_blockers(ctx, line, device), *policy_blockers],
    }


def _instant(value: datetime | None) -> str | None:
    return None if value is None else value.isoformat()


def _accounted_releases(line: SupplyReceiptLine) -> list[str]:
    """Only the real same-courier canonical debit can discharge a local source reservation."""
    sources = (
        StockOperation.objects.filter(
            organization=line.organization,
            source_kind="release_record",
            release_receipt_line=line,
            release__created_by_id=line.receipt.event.assignment.courier_id,
            release__lot_id=line.release_line.line.lot_id,
        )
        .order_by("release__declared_event_id")
        .values_list("release__declared_event_id", flat=True)
    )
    return [str(identifier) for identifier in sources]
