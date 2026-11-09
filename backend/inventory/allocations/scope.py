"""One binding covers the whole actual assignment, work and return vector."""

from typing import Any, cast
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from inventory.allocations.models import ReturnDeclaration, SupplyAssignment, SupplyUse
from inventory.allocations.permissions import COURIER_CODES
from inventory.models import Location
from inventory.transfers.scope import allows_transfer_vector, paired_query
from organizations.models import Center, Organization
from organizations.scope import EffectiveScope
from uploads.access import UploadActor, current_scope


def location_context(location: Location) -> dict[str, str | None]:
    return {
        "center_id": str(location.center_id),
        "quadrant_id": None if location.quadrant_id is None else str(location.quadrant_id),
    }


def allows_supply_vector(
    scope: EffectiveScope, permission: str, contexts: list[dict[str, Any]]
) -> bool:
    """Reuse the canonical stronger per-code binding algebra, with no new scope fold."""
    return allows_transfer_vector(scope, permission, contexts)


def scoped_assignments(
    actor: UploadActor, permission: str, captured: EffectiveScope | None = None
) -> QuerySet[SupplyAssignment]:
    """Reject any hidden line context within one grant BEFORE count, order or page."""
    query = SupplyAssignment.objects.filter(organization=actor.organization)
    if permission in COURIER_CODES:
        query = query.filter(courier=actor.user)
    allowed = Q(pk__in=[])
    for codes, grant in (captured or current_scope(actor)).grants:
        if permission not in codes:
            continue
        origins = paired_query(grant, "origin__center_id", "origin__quadrant_id")
        returns = ReturnDeclaration.objects.filter(event__assignment_id=OuterRef("pk")).exclude(
            paired_query(grant, "destination__center_id", "destination__quadrant_id")
        )
        work = SupplyUse.objects.filter(
            event__assignment_id=OuterRef("pk"), work_point__isnull=False
        ).exclude(
            paired_query(
                grant,
                "work_point__block__quadrant__center_id",
                "work_point__block__quadrant_id",
            )
        )
        eligible = query.filter(origins).filter(~Exists(returns), ~Exists(work))
        allowed |= Q(pk__in=eligible.values("pk"))
    return query.filter(allowed)


def require_assignment(actor: UploadActor, identifier: UUID, permission: str) -> SupplyAssignment:
    assignment = (
        scoped_assignments(actor, permission)
        .select_related("origin__center", "origin__quadrant", "courier")
        .filter(pk=identifier)
        .first()
    )
    if assignment is None:
        raise Http404
    return cast(SupplyAssignment, assignment)


def assignment_contexts(assignment: SupplyAssignment) -> list[dict[str, str | None]]:
    """Actual persisted relations, not an advisory scope union or a caller's location."""
    contexts = [location_context(assignment.origin)]
    destinations = ReturnDeclaration.objects.filter(event__assignment=assignment).values_list(
        "destination__center_id", "destination__quadrant_id"
    )
    work = SupplyUse.objects.filter(
        event__assignment=assignment, work_point__isnull=False
    ).values_list("work_point__block__quadrant__center_id", "work_point__block__quadrant_id")
    for center, quadrant in (*destinations, *work):
        context = {
            "center_id": str(center),
            "quadrant_id": None if quadrant is None else str(quadrant),
        }
        if context not in contexts:
            contexts.append(context)
    return contexts


def require_contexts(actor: UploadActor, permission: str, contexts: list[dict[str, Any]]) -> None:
    if not allows_supply_vector(current_scope(actor), permission, contexts):
        raise Http404


def require_current_courier(
    courier: User, organization: Organization, contexts: list[dict[str, Any]]
) -> None:
    """Fresh self transport authority, independently of the warehouse operator's action."""
    if not User.objects.filter(pk=courier.pk, is_active=True).exists():
        raise Http404
    try:
        scope = current_scope(UploadActor(courier, organization))
    except PermissionDenied:
        raise Http404 from None
    if not allows_supply_vector(scope, "field_event.sync", contexts):
        raise Http404


def authorized_center_contexts(actor: UploadActor, permission: str) -> QuerySet[Center]:
    """A genuine center-only resource has no applicable quadrant; none/empty centers deny."""
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if permission not in codes:
            continue
        dimension = grant["centers"]
        if dimension["mode"] == "all":
            allowed |= Q(pk__isnull=False)
        elif dimension["mode"] == "selected":
            allowed |= Q(pk__in=dimension["ids"])
    return Center.objects.filter(organization=actor.organization).filter(allowed)
