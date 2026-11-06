"""Read readiness observationally; append one epoch closure under the shared arbiter."""

from typing import Any
from uuid import UUID

from django.utils import timezone

from field_sync.services import FanoutScope, fanout_courier_changes
from geography.decisions.exceptions import GeographyDecisionConflictError
from geography.decisions.models import QuadrantClosure
from geography.decisions.readiness import closure_blockers
from geography.decisions.retirements import closure_physical
from geography.decisions.scope import quadrant_for, require_contexts
from geography.decisions.services import current_epoch
from geography.decisions.transactions import WriteScope, geography_transaction
from geography.models import Quadrant
from geography.permissions import QUADRANT_CLOSE
from geography.services import emit_geography_reference
from uploads.access import UploadActor


def readiness(actor: UploadActor, quadrant: Quadrant) -> dict[str, Any]:
    return _readiness(actor, quadrant)[0]


def _readiness(
    actor: UploadActor, quadrant: Quadrant
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    require_contexts(actor, QUADRANT_CLOSE, (quadrant,))
    epoch = current_epoch(quadrant)
    closure = QuadrantClosure.objects.filter(quadrant_version=epoch).first()
    active, proof = closure_physical(quadrant)
    blockers = closure_blockers(actor, quadrant, active)
    return {
        "quadrant_id": quadrant.pk,
        "quadrant_version_id": epoch.pk,
        "revision": epoch.revision,
        "is_closed": closure is not None,
        "can_close": closure is None and not blockers,
        "blockers": blockers,
        "closure": closure,
    }, proof


def close_quadrant(actor: UploadActor, identifier: UUID, expected_revision: int) -> QuadrantClosure:
    quadrant = quadrant_for(actor, identifier, QUADRANT_CLOSE)
    with (
        geography_transaction(actor, WriteScope(QUADRANT_CLOSE, (quadrant,), publish=True)),
        fanout_courier_changes(
            FanoutScope(actor.organization, quadrant.center_id, quadrant.pk)
        ) as emit,
    ):
        quadrant = Quadrant.objects.select_for_update(nowait=True, no_key=True).get(pk=quadrant.pk)
        state, proof = _readiness(actor, quadrant)
        if (
            isinstance(expected_revision, bool)
            or state["revision"] != expected_revision
            or not state["can_close"]
        ):
            raise GeographyDecisionConflictError(
                state["blockers"]
                or [
                    {
                        "reason": "quadrant_revision_conflict",
                        "permission": QUADRANT_CLOSE,
                        "link": "",
                    }
                ]
            )
        closure = QuadrantClosure.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            quadrant_version_id=state["quadrant_version_id"],
            closed_at=timezone.now(),
            readiness_snapshot={
                "version": 1,
                "revision": state["revision"],
                "blockers": [],
                "retirements": proof,
            },
        )
        emit_geography_reference(closure.quadrant_version, emit)
        return closure
