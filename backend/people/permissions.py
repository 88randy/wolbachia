"""Current whole action/context bindings, separate from factual qualification."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from organizations.scope import EffectiveScope, contains, safe_scope

if TYPE_CHECKING:
    from organizations.models import Membership
    from uploads.access import UploadActor

TRAINING_READ = "training.read"
TRAINING_MANAGE = "training.manage"
EVALUATION_CREATE = "evaluation.create"
EVALUATION_READ = "evaluation.read"
ADMIN_CODES = (TRAINING_READ, TRAINING_MANAGE, EVALUATION_CREATE, EVALUATION_READ)


@dataclass(frozen=True)
class PeopleContext:
    center_id: UUID
    quadrant_id: UUID | None

    def lookups(self, prefix: str = "") -> dict[str, Any]:
        """Keep nullable context equality explicit in ORM keyword lookups."""
        return {f"{prefix}center_id": self.center_id, f"{prefix}quadrant_id": self.quadrant_id}

    def payload(self) -> dict[str, str | None]:
        return {
            "center_id": str(self.center_id),
            "quadrant_id": None if self.quadrant_id is None else str(self.quadrant_id),
        }


def allows_contexts(
    scope: EffectiveScope, permission: str, contexts: tuple[PeopleContext, ...]
) -> bool:
    return bool(contexts) and any(
        permission in codes
        and all(
            contains(bound["centers"], str(context.center_id))
            and contains(
                bound["quadrants"],
                None if context.quadrant_id is None else str(context.quadrant_id),
            )
            for context in contexts
        )
        for codes, bound in scope.grants
    )


def require_contexts(
    actor: UploadActor, permission: str, contexts: tuple[PeopleContext, ...]
) -> None:
    from uploads.access import current_scope

    if not allows_contexts(current_scope(actor), permission, contexts):
        raise Http404


def require_global(actor: UploadActor, permission: str = TRAINING_MANAGE) -> None:
    from uploads.access import current_scope

    if not any(
        permission in codes
        and bound["centers"]["mode"] == "all"
        and bound["quadrants"]["mode"] == "all"
        for codes, bound in current_scope(actor).grants
    ):
        raise PermissionDenied


def real_context(actor: UploadActor, center_id: UUID, quadrant_id: UUID | None) -> PeopleContext:
    from geography.models import Quadrant
    from organizations.models import Center

    if not Center.objects.filter(
        organization=actor.organization, pk=center_id, is_active=True
    ).exists():
        raise Http404
    if (
        quadrant_id is not None
        and not Quadrant.objects.filter(
            organization=actor.organization, pk=quadrant_id, center_id=center_id
        ).exists()
    ):
        raise Http404
    return PeopleContext(center_id, quadrant_id)


def active_subject(actor: UploadActor, identifier: UUID, context: PeopleContext) -> Membership:
    from organizations.models import Membership

    member = (
        Membership.objects.filter(
            organization=actor.organization,
            user_id=identifier,
            is_active=True,
            user__is_active=True,
            organization__is_active=True,
        )
        .select_related("user")
        .first()
    )
    if member is None:
        raise Http404
    bound = safe_scope(member.scope)
    if not contains(bound["centers"], str(context.center_id)) or not contains(
        bound["quadrants"], None if context.quadrant_id is None else str(context.quadrant_id)
    ):
        raise Http404
    return member
