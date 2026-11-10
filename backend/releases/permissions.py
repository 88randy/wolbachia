"""Current complete action/center/quadrant pairs precede every object disclosure."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from geography.models import Quadrant

if TYPE_CHECKING:
    from uploads.access import UploadActor

PERMIT_MANAGE = "permit.manage"
PERMIT_SUSPEND = "permit.suspend"
RELEASE_READ = "release.read"


def require_global(actor: UploadActor, permission: str = PERMIT_MANAGE) -> None:
    from uploads.access import current_scope

    if not any(
        permission in codes
        and scope["centers"]["mode"] == "all"
        and scope["quadrants"]["mode"] == "all"
        for codes, scope in current_scope(actor).grants
    ):
        raise PermissionDenied


def require_pair(actor: UploadActor, permission: str, quadrant: Quadrant) -> None:
    from uploads.access import current_scope

    if not current_scope(actor).allows(permission, str(quadrant.center_id), str(quadrant.pk)):
        raise Http404


def authorized_quadrant(actor: UploadActor, identifier: UUID, permission: str) -> Quadrant:
    row = Quadrant.objects.filter(
        organization=actor.organization,
        center__organization=actor.organization,
        center__is_active=True,
        pk=identifier,
    ).first()
    if row is None:
        raise Http404
    require_pair(actor, permission, row)
    return row
