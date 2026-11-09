"""Current real subjects authorize history before LIMIT; captured metadata is not a grant."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from field_sync.models import CourierChange
from field_sync.producers import ProducerContext
from reviews.models import ReviewDecision, ShiftDecision
from reviews.scope import SubjectFacts, subject_allows, subject_facts


def visible_history_contexts(ctx: ProducerContext) -> dict[UUID, tuple[dict[str, str | None], ...]]:
    from lab.independent_qa.selectors import filter_history_numbers
    from uploads.access import UploadActor

    rows: QuerySet[Any] = CourierChange.objects.filter(
        organization=ctx.organization, courier=ctx.user, kind="history"
    ).only("id", "resource_type", "resource_id", "courier_id", "organization_id", "payload")
    rows = filter_history_numbers(UploadActor(ctx.user, ctx.organization), rows)
    current: dict[tuple[str, str], SubjectFacts] = {}
    visible = {}
    for row in rows.iterator():
        key = row.resource_type, row.resource_id
        if key not in current:
            current[key] = _current_subjects(row)
        facts = current[key]
        if row.resource_type.startswith("history.lab_") and facts.resource_kind == "lab_paddle":
            from inventory.allocations.scope import allows_supply_vector

            if not allows_supply_vector(
                ctx.scope, facts.facts["own_permission"], list(facts.contexts)
            ):
                continue
        if facts.resource_kind == "community_activity" and not subject_allows(
            ctx.scope, "community_activity.read", facts
        ):
            continue
        if row.resource_type.startswith("history.supply_") and not subject_allows(
            ctx.scope, facts.facts.get("own_permission", ""), facts
        ):
            continue
        if subject_allows(ctx.scope, ctx.permission, facts):
            visible[row.pk] = facts.contexts
    return visible


def _current_subjects(row: CourierChange) -> SubjectFacts:
    try:
        identifier = UUID(row.resource_id)
    except ValueError:
        return SubjectFacts()
    if row.resource_type.startswith(("history.supply_", "history.lab_")):
        return _owned_domain_subjects(row, identifier)
    if row.resource_type in {"history.transfer_custody", "history.community_activity"}:
        return _operational_subjects(row, identifier)
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
    if row.resource_type == "history.relocation_proposal":
        from geography.decisions.producers import proposal_subjects
        from ovitraps.lifecycle.models import RelocationProposal

        proposal = (
            RelocationProposal.objects.filter(
                organization_id=row.organization_id,
                pk=identifier,
                event__created_by_id=row.courier_id,
            )
            .select_related("ovitrap__sampling_point__block__quadrant")
            .first()
        )
        return SubjectFacts() if proposal is None else proposal_subjects(proposal)
    return SubjectFacts()


def _owned_domain_subjects(row: CourierChange, identifier: UUID) -> SubjectFacts:
    if row.resource_type.startswith("history.supply_"):
        from inventory.allocations.history import history_subjects

        return history_subjects(row)
    from lab.history import lab_history_subjects

    return lab_history_subjects(
        row.organization_id,
        row.courier_id,
        (row.resource_type.removeprefix("history."), identifier),
    )


def _operational_subjects(row: CourierChange, identifier: UUID) -> SubjectFacts:
    if row.resource_type == "history.community_activity":
        from community.history import history_subjects as community_subjects

        return community_subjects(row.organization_id, row.courier_id, identifier)
    from inventory.transfers.history import history_subjects

    return history_subjects(row.organization_id, row.courier_id, identifier)
