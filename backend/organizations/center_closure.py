"""What keeps a center from closing, and the bulk steps that clear it.

Readiness is a read: every row has a `key`, a `count`, whether it blocks deactivation and the
permission that resolves it. Bulk steps reuse the existing domain services one item at a time,
each in its own transaction, and return per-item results so a partial failure can be retried:

- motorcycles move through `shifts.services.update_motorcycle` (Motorcycle row lock);
- stock is prepared as one transfer per origin location through
  `inventory.transfers.services.prepare_transfer` (the inventory arbiter's lock order). The
  transfer code is a digest of origin, destination and lines, so a repeated or concurrent click
  replays the same transfer instead of preparing a second one.

Quadrants keep their center forever (immutable identity), open shifts are closed from the phone
and memberships through the users screen: those rows link to the existing screens.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models import Exists, OuterRef, QuerySet, Subquery, Sum
from django.http import Http404
from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.models import User
from core.exceptions import DomainError
from core.snapshots import snapshot_hash
from geography.decisions.models import QuadrantClosure
from geography.models import Quadrant, QuadrantVersion
from inventory.models import Location, StockMovement
from inventory.transfers.policy import json_facts
from organizations.models import Center, Membership
from shifts.models import Motorcycle, Shift, ShiftStatus
from uploads.access import UploadActor

TRANSFER_CODE_PREFIX = "CLOSE-"
TRANSFER_CODE_DIGEST_LENGTH = 16


@dataclass(frozen=True)
class ReadinessRow:
    key: str
    count: int
    is_blocking: bool
    permission: str
    resolved_by_role: str


def open_shifts(center: Center) -> QuerySet[Shift]:
    return Shift.objects.filter(
        organization_id=center.organization_id,
        status=ShiftStatus.OPEN,
        motorcycle__center=center,
    )


def active_motorcycles(center: Center) -> QuerySet[Motorcycle]:
    return Motorcycle.objects.filter(organization_id=center.organization_id, center=center).filter(
        voided_at__isnull=True
    )


def active_quadrants(center: Center) -> QuerySet[Quadrant]:
    """Quadrants whose latest published version has no closure."""
    latest = (
        QuadrantVersion.objects.filter(quadrant=OuterRef("pk"))
        .order_by("-revision")
        .values("pk")[:1]
    )
    closed = QuadrantClosure.objects.filter(quadrant_version_id=OuterRef("latest_version"))
    return (
        Quadrant.objects.filter(organization_id=center.organization_id, center=center)
        .annotate(latest_version=Subquery(latest))
        .exclude(Exists(closed))
    )


def stock_balances(center: Center) -> QuerySet[Any]:
    """Non-zero ledger balances per location, lot, piece and unit in this center."""
    return (
        StockMovement.objects.filter(
            organization_id=center.organization_id, location__center=center
        )
        .values("location_id", "lot_id", "piece_id", "unit_version_id")
        .annotate(quantity=Sum("quantity"))
        .exclude(quantity=0)
        .order_by("location_id", "lot_id", "piece_id", "unit_version_id")
    )


def people_only_here(center: Center) -> int:
    """Active memberships whose work scope selects this center and no other."""
    rows = Membership.objects.filter(
        organization_id=center.organization_id, is_active=True
    ).values_list("scope", flat=True)
    target = str(center.pk)
    return sum(
        1
        for scope in rows
        if scope.get("centers", {}).get("mode") == "selected"
        and [str(value) for value in scope["centers"].get("ids", [])] == [target]
    )


def closure_readiness(center: Center) -> list[ReadinessRow]:
    return [
        ReadinessRow("open_shifts", open_shifts(center).count(), True, "shift.read", "supervisor"),
        ReadinessRow("stock", stock_balances(center).count(), True, "transfer.create", "warehouse"),
        ReadinessRow(
            "motorcycles", active_motorcycles(center).count(), True, "motorcycle.manage", "admin"
        ),
        ReadinessRow(
            "active_quadrants", active_quadrants(center).count(), True, "quadrant.close", "admin"
        ),
        ReadinessRow("people_only_here", people_only_here(center), False, "role.update", "admin"),
    ]


def closure_blockers(center: Center) -> list[dict[str, Any]]:
    """The `blocked_by` body of a refused deactivation: code + params, never text."""
    return [
        {
            "reason": row.key,
            "params": {"count": row.count},
            "unblocked_by_role": row.resolved_by_role,
            "link": "",
        }
        for row in closure_readiness(center)
        if row.is_blocking and row.count
    ]


def _failure(error: Exception) -> str:
    if isinstance(error, DomainError):
        blocked = getattr(error, "blocked_by", None) or []
        return str(blocked[0]["reason"]) if blocked else error.code
    if isinstance(error, Http404 | NotFound):
        return "not_found"
    return "permission_denied"


def move_motorcycles(center: Center, destination: Center, actor: User) -> list[dict[str, Any]]:
    """Move every live motorcycle of `center` to `destination`, one locked update each."""
    from shifts.services import update_motorcycle

    results = []
    for motorcycle in active_motorcycles(center).order_by("code"):
        try:
            with transaction.atomic():
                update_motorcycle(motorcycle, {"center": destination})
            results.append({"id": motorcycle.pk, "code": motorcycle.code, "status": "moved"})
        except (DomainError, Http404, NotFound, PermissionDenied) as error:
            results.append(
                {
                    "id": motorcycle.pk,
                    "code": motorcycle.code,
                    "status": "failed",
                    "reason": _failure(error),
                }
            )
    return results


def _transfer_values(
    origin_id: UUID, destination: Location, lines: list[dict[str, Any]]
) -> dict[str, Any]:
    body = {"origin_id": origin_id, "destination_id": destination.pk, "lines": lines}
    digest = snapshot_hash(json_facts(body))[:TRANSFER_CODE_DIGEST_LENGTH].upper()
    return {"code": TRANSFER_CODE_PREFIX + digest, **body}


def _lines_by_location(center: Center) -> dict[UUID, list[dict[str, Any]]]:
    grouped: dict[UUID, list[dict[str, Any]]] = {}
    for row in stock_balances(center):
        if row["quantity"] <= Decimal(0):
            continue
        grouped.setdefault(row["location_id"], []).append(
            {
                "lot_id": row["lot_id"],
                "piece_id": row["piece_id"],
                "unit_version_id": row["unit_version_id"],
                "quantity": row["quantity"],
            }
        )
    return grouped


def move_stock(center: Center, destination: Location, actor: UploadActor) -> list[dict[str, Any]]:
    """Prepare one transfer per origin location of `center` with all its positive stock."""
    from inventory.transfers.commands import PrepareTransferCommand
    from inventory.transfers.services import prepare_transfer

    if destination.center_id == center.pk:
        raise Http404
    codes = dict(Location.objects.filter(center=center).values_list("pk", "code"))
    results = []
    for origin_id, lines in _lines_by_location(center).items():
        values = _transfer_values(origin_id, destination, lines)
        item = {
            "location_id": origin_id,
            "location_code": codes.get(origin_id, ""),
            "transfer_code": values["code"],
            "line_count": len(lines),
        }
        try:
            result = prepare_transfer(PrepareTransferCommand(actor, values))
            status = "already_prepared" if result.is_replay else "prepared"
            results.append({**item, "status": status})
        except (DomainError, Http404, NotFound, PermissionDenied) as error:
            results.append({**item, "status": "failed", "reason": _failure(error)})
    return results


def pending_transfer_count(center: Center) -> int:
    """Transfers out of this center's locations that are prepared but not yet dispatched."""
    from inventory.transfers.models import Transfer, TransferEvent

    dispatched = TransferEvent.objects.filter(transfer=OuterRef("pk"), kind="dispatch")
    return (
        Transfer.objects.filter(organization_id=center.organization_id, origin__center=center)
        .exclude(Exists(dispatched))
        .count()
    )
