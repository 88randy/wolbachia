"""Every decision uses one actual Block pair, never geography administration grants."""

from typing import cast
from uuid import UUID

from django.http import Http404

from geography.models import Block
from organizations.scope import EffectiveScope
from uploads.access import UploadActor, current_scope


def block_context(block: Block) -> dict[str, str | None]:
    return {"center_id": str(block.quadrant.center_id), "quadrant_id": str(block.quadrant_id)}


def require_pair(scope: EffectiveScope, permission: str, block: Block) -> None:
    if not scope.allows(permission, str(block.quadrant.center_id), str(block.quadrant_id)):
        raise Http404


def authorized_block(actor: UploadActor, identifier: UUID, permission: str) -> Block:
    block = (
        Block.objects.filter(
            organization=actor.organization,
            pk=identifier,
            quadrant__organization=actor.organization,
            quadrant__center__organization=actor.organization,
        )
        .select_related("quadrant")
        .first()
    )
    if block is None:
        raise Http404
    require_pair(current_scope(actor), permission, block)
    return cast(Block, block)
