"""Current paired authority for objects and relations, never a display-scope union."""

from typing import Any

from django.db.models import Q, QuerySet
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from core.models import OrgScopedModel
from uploads.access import UploadActor, current_scope

ORG_MASTER_LABELS = frozenset(
    {"inventory.supplytype", "inventory.supplytypeversion", "inventory.biologicalprotocolversion"}
)
STORAGE_LABELS = frozenset(
    {
        "inventory.location",
        "inventory.locationversion",
        "inventory.lot",
        "inventory.lotversion",
        "inventory.stockmovement",
    }
)
RELATION_LABELS = frozenset(
    {"organizations.center", "geography.quadrant", "inventory.location", "inventory.lot"}
)


def require_action(actor: UploadActor, permission: str) -> None:
    """Precheck an action only; this never authorizes an unresolved storage placement."""
    if permission not in current_scope(actor).permissions:
        raise PermissionDenied


def require_scope(actor: UploadActor, permission: str, resource: OrgScopedModel) -> None:
    scope = current_scope(actor)
    if permission not in scope.permissions:
        raise PermissionDenied
    if resource is None:
        raise Http404
    if resource.organization_id != actor.organization.pk:
        raise Http404
    label = resource._meta.label_lower
    if label in ORG_MASTER_LABELS:
        return
    if label not in RELATION_LABELS:
        raise Http404
    center, quadrant = getattr(resource, "center_id", None), getattr(resource, "quadrant_id", None)
    if resource._meta.label_lower == "organizations.center":
        center = resource.pk
    elif resource._meta.label_lower == "geography.quadrant":
        quadrant = resource.pk
    if center is None:
        raise Http404
    if not scope.allows(
        permission, str(center) if center else None, str(quadrant) if quadrant else None
    ):
        raise Http404


def scoped_inventory(query: QuerySet[Any], actor: UploadActor, permission: str) -> QuerySet[Any]:
    """A genuine null quadrant is inapplicable; a missing/unknown center never is."""
    query = query.filter(organization=actor.organization)
    label = query.model._meta.label_lower
    if label not in ORG_MASTER_LABELS | STORAGE_LABELS:
        return query.none()
    center = getattr(query.model, "scope_center_lookup", None)
    quadrant = getattr(query.model, "scope_quadrant_lookup", None)
    if label in STORAGE_LABELS and (not center or not quadrant):
        return query.none()
    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if permission not in codes:
            continue
        match = Q(pk__isnull=False)
        if center and grant["centers"]["mode"] != "all":
            match &= Q(
                **{
                    f"{center}__in": grant["centers"]["ids"]
                    if grant["centers"]["mode"] == "selected"
                    else []
                }
            )
        if quadrant and grant["quadrants"]["mode"] != "all":
            match &= Q(**{f"{quadrant}__isnull": True}) | Q(
                **{
                    f"{quadrant}__in": grant["quadrants"]["ids"]
                    if grant["quadrants"]["mode"] == "selected"
                    else []
                }
            )
        allowed |= match
    return query.filter(allowed)
