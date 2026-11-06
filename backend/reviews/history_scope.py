"""Current real subjects authorize history before LIMIT; captured metadata is not a grant."""

from uuid import UUID

from field_sync.models import CourierChange
from field_sync.producers import ProducerContext
from reviews.models import ReviewDecision, ShiftDecision
from reviews.scope import SubjectFacts, subject_facts, vector_allows


def visible_history_contexts(ctx: ProducerContext) -> dict[UUID, tuple[dict[str, str | None], ...]]:
    rows = CourierChange.objects.filter(
        organization=ctx.organization, courier=ctx.user, kind="history"
    ).only("id", "resource_type", "resource_id", "courier_id", "organization_id")
    current: dict[tuple[str, str], SubjectFacts] = {}
    visible = {}
    for row in rows.iterator():
        key = row.resource_type, row.resource_id
        if key not in current:
            current[key] = _current_subjects(row)
        facts = current[key]
        if vector_allows(ctx.scope, ctx.permission, facts.contexts, facts.resolved):
            visible[row.pk] = facts.contexts
    return visible


def _current_subjects(row: CourierChange) -> SubjectFacts:
    try:
        identifier = UUID(row.resource_id)
    except ValueError:
        return SubjectFacts()
    if row.resource_type == "history.review_decision":
        decision = (
            ReviewDecision.objects.filter(
                organization_id=row.organization_id,
                pk=identifier,
                review_item__courier_id=row.courier_id,
            )
            .select_related("review_item__field_event__organization")
            .first()
        )
        if decision is None or not decision.evaluation.get("scope_resolved"):
            return SubjectFacts()
        from reviews.inspection import original_source_envelope

        source = decision.review_item.field_event
        try:
            return subject_facts(source.organization, original_source_envelope(source))
        except ValueError:
            return SubjectFacts()
    if row.resource_type == "history.shift_validation":
        decision = (
            ShiftDecision.objects.filter(
                organization_id=row.organization_id, pk=identifier, shift__courier_id=row.courier_id
            )
            .select_related("shift__organization", "shift__motorcycle")
            .first()
        )
        if decision is None:
            return SubjectFacts()
        from shifts.validation import shift_subjects

        contexts, resolved = shift_subjects(decision.shift)
        return SubjectFacts(resolved, tuple(contexts), "shift", decision.shift_id)
    return SubjectFacts()
