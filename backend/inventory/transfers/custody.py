"""Current facility proof is a signed ledger sum, never original admission or a reading."""

from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet, Sum
from django.http import Http404

from inventory.access import require_scope
from inventory.models import Location, Lot, StockMovement
from inventory.transfers.scope import paired_query
from uploads.access import UploadActor, current_scope


def balance(line: Any, location: Any) -> Decimal:  # noqa: ANN401 -- actual line and Location identities
    return StockMovement.objects.filter(
        organization=line.organization,
        lot_id=line.lot_id,
        location=location,
        piece_id=line.piece_id,
        unit_version_id=line.unit_version_id,
    ).aggregate(total=Sum("quantity"))["total"] or Decimal(0)


def scoped_legs(actor: UploadActor) -> QuerySet[StockMovement]:
    query = StockMovement.objects.filter(
        organization=actor.organization,
        operation__organization=actor.organization,
        lot__organization=actor.organization,
        location__organization=actor.organization,
    )
    for permission in ("location.read", "lot.read"):
        allowed = Q(pk__in=[])
        for codes, grant in current_scope(actor).grants:
            if permission in codes:
                allowed |= paired_query(grant, "location__center_id", "location__quadrant_id")
        query = query.filter(allowed)
    return query


def custody_lots(actor: UploadActor, outer_lot: str = "pk", location: Any = None) -> Exists:  # noqa: ANN401 -- optional actual Location
    query = StockMovement.objects.filter(
        organization=actor.organization,
        lot_id=OuterRef(outer_lot),
        operation__organization=actor.organization,
        location__organization=actor.organization,
    )
    if location is not None:
        query = query.filter(location=location)
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if "lot.read" in codes:
            allowed |= paired_query(grant, "location__center_id", "location__quadrant_id")
    totals = (
        query.filter(allowed)
        .order_by()
        .values("lot_id", "location_id", "unit_version_id", "piece_id")
        .annotate(total=Sum("quantity"))
        .filter(total__gt=0)
    )
    return Exists(totals)


def context_location(actor: UploadActor, identifier: str, permission: str = "lot.read") -> Location:
    try:
        key = UUID(identifier)
    except (ValueError, TypeError) as error:
        raise Http404 from error
    location = Location.objects.filter(organization=actor.organization, pk=key).first()
    if location is None:
        raise Http404
    require_scope(actor, permission, location)
    return cast(Location, location)


def condition_target(
    actor: UploadActor, reference: tuple[str, str | None], permission: str
) -> tuple[Lot, Location | None]:
    lot_id, location_id = reference
    location = context_location(actor, location_id, permission) if location_id is not None else None
    try:
        identifier = UUID(lot_id)
    except (ValueError, TypeError) as error:
        raise Http404 from error
    lot = Lot.objects.filter(organization=actor.organization, pk=identifier).first()
    if lot is None:
        raise Http404
    if location is None:
        require_scope(actor, permission, lot)
        from inventory.selectors import current_lot

        location = current_lot(lot).initial_location
    return lot, location
