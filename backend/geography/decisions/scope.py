"""Current explicit action grants and complete actual geography subject vectors."""

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from geography.models import Quadrant
from organizations.scope import EffectiveScope
from uploads.access import UploadActor, current_scope


def context(quadrant: Quadrant) -> dict[str, str | None]:
    return {"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)}


def allows(scope: EffectiveScope, permission: str, quadrant: Quadrant) -> bool:
    return scope.allows(permission, str(quadrant.center_id), str(quadrant.pk))


def require_contexts(actor: UploadActor, permission: str, quadrants: Iterable[Quadrant]) -> None:
    scope = current_scope(actor)
    if not scope.allows(permission):
        raise PermissionDenied
    rows = tuple(quadrants)
    if not rows or any(
        row.organization_id != actor.organization.pk or not allows(scope, permission, row)
        for row in rows
    ):
        raise Http404


def quadrant_for(actor: UploadActor, identifier: UUID, permission: str) -> Quadrant:
    scope = current_scope(actor)
    if not scope.allows(permission):
        raise PermissionDenied
    row = Quadrant.objects.filter(organization=actor.organization, pk=identifier).first()
    if row is None:
        raise Http404
    require_contexts(actor, permission, (row,))
    return row


def blocker(actor: UploadActor, quadrant: Quadrant, facts: dict[str, Any]) -> dict[str, Any]:
    """Opaque hidden causes coalesce; a closure reader gains no unrelated read grant."""
    facts = dict(facts)
    permission = facts.pop("read_permission")
    if allows(current_scope(actor), permission, quadrant):
        return facts
    return {"reason": facts["reason"], "permission": facts["permission"], "link": ""}
