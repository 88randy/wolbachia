"""Whole CLOSED-shift decisions are audits; they never change Shift lifecycle."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db.models import Max, QuerySet
from django.http import Http404

from core.snapshots import snapshot_hash
from core.void_reason import validate_void_reason
from field_sync.models import FieldEvent
from organizations.scope import EffectiveScope
from reviews.effect_receipts import is_effective
from reviews.exceptions import ReviewBlockedError, ReviewConflictError
from reviews.inspection import original_source_envelope
from reviews.models import ReviewDecision, ReviewEffectReceipt, ReviewItem, ShiftDecision
from reviews.safety import has_pending_severe
from reviews.scope import subject_facts, unresolved_scope_allows, vector_allows
from reviews.transactions import review_transaction
from shifts.models import Motorcycle, Shift
from shifts.permissions import SHIFT_VALIDATE
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class ShiftDecisionRequest:
    kind: str
    expected_revision: int
    reason: str


def shift_sources(shift: Shift) -> QuerySet[FieldEvent]:
    return FieldEvent.objects.filter(
        organization=shift.organization, created_by=shift.courier, shift_id=shift.pk
    ).order_by("pk")


def shift_subjects(shift: Shift) -> tuple[list[dict[str, str | None]], bool]:
    contexts = [
        {
            "center_id": None
            if shift.motorcycle.center_id is None
            else str(shift.motorcycle.center_id),
            "quadrant_id": None,
        }
    ]
    resolved = True
    for source in shift_sources(shift):
        try:
            facts = subject_facts(shift.organization, original_source_envelope(source))
        except ValueError:
            resolved = False
            continue
        resolved &= facts.resolved
        for context in facts.contexts:
            if context not in contexts:
                contexts.append(context)
    from inventory.allocations.reconciliation import shift_assignment_rows
    from inventory.allocations.scope import assignment_contexts

    for assignment in shift_assignment_rows(shift):
        for context in assignment_contexts(assignment):
            if context not in contexts:
                contexts.append(context)
    return contexts, resolved


def shift_blockers(shift: Shift) -> tuple[str, ...]:
    from fleet.selectors import active_blocks
    from incidents.selectors import active_blockers

    blockers = []
    if shift.status != "closed":
        blockers.append("shift_not_closed")
    if (
        not is_effective(shift.opened_event)
        or shift.closed_event is None
        or not is_effective(shift.closed_event)
    ):
        blockers.append("shift_source_not_effective")
    items = ReviewItem.objects.filter(field_event__in=shift_sources(shift))
    terminal = ReviewDecision.objects.filter(review_item__in=items, is_terminal=True).values(
        "review_item_id"
    )
    if items.exclude(pk__in=terminal).exists():
        blockers.append("unresolved_shift_review")
    if (
        has_pending_severe(shift.motorcycle_id)
        or shift.motorcycle.is_blocked
        or active_blocks(shift.motorcycle)
    ):
        blockers.append("motorcycle_safety_hold")
    if (
        active_blockers(shift.organization)
        .filter(resource_kind="motorcycle", resource_id=shift.motorcycle_id)
        .exists()
    ):
        blockers.append("incident_safety_hold")
    if not shift_subjects(shift)[1]:
        blockers.append("shift_scope_unavailable")
    return tuple(blockers)


def validation_fingerprint(shift: Shift) -> str:
    from fleet.selectors import active_blocks
    from incidents.selectors import active_blockers
    from inventory.allocations.reconciliation import shift_supply_fingerprint

    source_ids = shift_sources(shift).values_list("pk", flat=True)
    supply_facts = shift_supply_fingerprint(shift)
    return snapshot_hash(
        {
            "shift": str(shift.pk),
            **({"supplies": supply_facts} if any(supply_facts.values()) else {}),
            "closed_event": str(shift.closed_event_id),
            "sources": [
                (
                    str(source.pk),
                    source.payload_sha256,
                    source.status,
                    source.status_code,
                    None if source.voided_at is None else source.voided_at.isoformat(),
                )
                for source in shift_sources(shift)
            ],
            "decisions": sorted(
                str(value)
                for value in ReviewDecision.objects.filter(
                    review_item__field_event_id__in=source_ids
                ).values_list("pk", flat=True)
            ),
            "effects": sorted(
                str(value)
                for value in ReviewEffectReceipt.objects.filter(
                    source_event_id__in=source_ids
                ).values_list("pk", flat=True)
            ),
            "faults": sorted(str(fault.pk) for fault in active_blocks(shift.motorcycle)),
            "severe_pending": has_pending_severe(shift.motorcycle_id),
            "incident_holds": sorted(
                str(value)
                for value in active_blockers(shift.organization)
                .filter(resource_kind="motorcycle", resource_id=shift.motorcycle_id)
                .values_list("pk", flat=True)
            ),
        }
    )


def shift_scope_allows(scope: EffectiveScope, shift: Shift, permission: str) -> bool:
    """The exact per-shift subject vector check, with an already-loaded scope."""
    from inventory.allocations.reconciliation import shift_assignment_rows
    from inventory.allocations.scope import allows_supply_vector

    contexts, resolved = shift_subjects(shift)
    if not vector_allows(scope, permission, contexts, resolved):
        return False
    return not shift_assignment_rows(shift).exists() or allows_supply_vector(
        scope, permission, contexts
    )


def require_shift_scope(actor: UploadActor, shift: Shift, permission: str) -> None:
    if not shift_scope_allows(current_scope(actor), shift, permission):
        raise Http404


def readable_shifts(
    actor: UploadActor, shifts: QuerySet[Shift], permission: str
) -> QuerySet[Shift]:
    """The shifts of `shifts` the actor may read, keeping its ordering and prefetches.

    An organization-wide grant (all centers and all quadrants) reads every shift, as it reads an
    unresolved review subject (`reviews.actions`). A scoped reader keeps the exact per-row subject
    vector, but SQL first drops the shifts whose motorcycle center no grant contains: that center
    is always part of the vector, so the exact check only runs on rows that can pass.
    """
    scope = current_scope(actor)
    if unresolved_scope_allows(scope, permission):
        return shifts
    grants = [grant for codes, grant in scope.grants if permission in codes]
    if not grants:
        return shifts.none()
    if all(grant["centers"]["mode"] != "all" for grant in grants):
        centers = {
            identifier
            for grant in grants
            if grant["centers"]["mode"] == "selected"
            for identifier in grant["centers"]["ids"]
        }
        shifts = shifts.filter(motorcycle__center_id__in=centers)
    visible = [
        shift.pk
        for shift in shifts.select_related("motorcycle", "organization")
        if shift_scope_allows(scope, shift, permission)
    ]
    return shifts.filter(pk__in=visible)


def decide_shift(
    actor: UploadActor, shift_id: UUID, request: ShiftDecisionRequest
) -> ShiftDecision:
    from reviews.history import publish_shift_decision

    reason = validate_void_reason(request.reason, "reason")
    shift = (
        Shift.objects.filter(organization=actor.organization, pk=shift_id)
        .select_related("motorcycle", "organization", "opened_event", "closed_event", "courier")
        .first()
    )
    if shift is None:
        raise Http404
    require_shift_scope(actor, shift, SHIFT_VALIDATE)
    references = {shift.opened_event_id}
    if shift.closed_event_id:
        references.add(shift.closed_event_id)
    with review_transaction(actor, shift.opened_event, references):
        motorcycle = Motorcycle.objects.select_for_update(nowait=True).get(pk=shift.motorcycle_id)
        shift = (
            Shift.objects.select_for_update(nowait=True, of=("self",))
            .select_related("organization", "courier", "closed_event", "opened_event")
            .get(pk=shift.pk)
        )
        shift.motorcycle = motorcycle
        require_shift_scope(actor, shift, SHIFT_VALIDATE)
        revision = shift.decisions.aggregate(value=Max("revision"))["value"] or 0
        if revision != request.expected_revision:
            raise ReviewConflictError
        blockers = shift_blockers(shift)
        if shift.status != "closed" or (request.kind == "approve" and blockers):
            raise ReviewBlockedError(blockers)
        if request.kind not in {"approve", "observe"}:
            raise ReviewBlockedError(("unknown_shift_action",))
        decision = ShiftDecision.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            shift=shift,
            closed_event_id=shift.closed_event_id,
            revision=revision + 1,
            expected_revision=revision,
            kind=request.kind,
            reason=reason,
            validation_fingerprint=validation_fingerprint(shift),
            subjects=shift_subjects(shift)[0],
        )
        publish_shift_decision(decision)
    return decision


def validation_projection(shift: Shift) -> dict[str, Any]:
    latest = shift.decisions.order_by("-revision").first()
    return {
        "revision": 0 if latest is None else latest.revision,
        "latest_decision": None if latest is None else str(latest.pk),
        "kind": None if latest is None else latest.kind,
        "approval_current": latest is not None
        and latest.kind == "approve"
        and latest.validation_fingerprint == validation_fingerprint(shift),
        "blockers": list(shift_blockers(shift)),
    }
