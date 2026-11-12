"""Append a decision and exactly one real effect/adoption in the same transaction."""

from __future__ import annotations

from collections.abc import Iterable
from contextlib import ExitStack
from dataclasses import dataclass, field, replace
from typing import TYPE_CHECKING, Any
from uuid import UUID

from django.db.models import Max
from django.http import Http404

from core.exceptions import AlreadyVoidedError
from core.void_reason import validate_void_reason
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventHandler, get_handler
from organizations.scope import EffectiveScope
from reviews.contracts import SafetyDispositionRequest
from reviews.evaluation import ReviewEvaluation, evaluation_payload, inspect_review
from reviews.evidence import bind_review_evidence
from reviews.exceptions import (
    ReviewBlockedError,
    ReviewConflictError,
)
from reviews.inspection import (
    envelope_of_source,
    original_source_envelope,
    validated_original_payload,
)
from reviews.models import (
    ReviewDecision,
    ReviewDependency,
    ReviewDependencyResolution,
    ReviewEffectReceipt,
    ReviewItem,
    ReviewParentClaim,
    ReviewSourceSnapshot,
    ReviewSubjectScope,
)
from reviews.permissions import REVIEW_ITEM_DECIDE
from reviews.safety_dispositions import SafetyProof
from reviews.scope import (
    SubjectFacts,
    subject_allows,
    subject_facts,
    unresolved_scope_allows,
)
from reviews.transactions import review_transaction
from uploads.access import UploadActor, current_scope

if TYPE_CHECKING:
    from field_sync.services import FanoutPublisher


@dataclass(frozen=True)
class DecisionBoundary:
    safety_proof: SafetyProof | None = None
    publisher: FanoutPublisher | None = None


@dataclass(frozen=True)
class ReviewDecisionRequest:
    kind: str
    expected_revision: int
    reason: str
    evidence_ids: list[UUID] = field(default_factory=list)
    safety_disposition: SafetyDispositionRequest | None = None


def visible_review(actor: UploadActor, item_id: UUID, permission: str) -> ReviewItem:
    item = (
        ReviewItem.objects.filter(organization=actor.organization, pk=item_id)
        .select_related(
            "field_event__organization", "field_event__device", "field_event__created_by"
        )
        .first()
    )
    if item is None:
        raise Http404
    snapshot = ReviewSourceSnapshot.objects.filter(source_event_id=item.field_event_id).first()
    if not _review_allowed(actor, (item, snapshot), (current_scope(actor), permission)):
        raise Http404
    return item


def visible_review_ids(
    actor: UploadActor, items: Iterable[ReviewItem], permission: str
) -> list[UUID]:
    """Ids of the items `visible_review` would return, reading the actor's scope only once.

    `items` need `field_event` loaded (select_related); the check per item is the same.
    """
    check = (current_scope(actor), permission)
    rows = list(items)
    snapshots = {
        snapshot.source_event_id: snapshot
        for snapshot in ReviewSourceSnapshot.objects.filter(
            source_event_id__in=[item.field_event_id for item in rows]
        )
    }
    return [
        item.pk
        for item in rows
        if _review_allowed(actor, (item, snapshots.get(item.field_event_id)), check)
    ]


def _review_allowed(
    actor: UploadActor,
    found: tuple[ReviewItem, ReviewSourceSnapshot | None],
    check: tuple[EffectiveScope, str],
) -> bool:
    item, snapshot = found
    scope, permission = check
    try:
        facts = subject_facts(actor.organization, envelope_of_source(item.field_event, snapshot))
    except ValueError:
        facts = SubjectFacts()
    if facts.resolved:
        return subject_allows(scope, permission, facts)
    return unresolved_scope_allows(scope, permission)


def reference_sources(source: FieldEvent) -> set[UUID]:
    from shifts.models import Shift

    identifiers = _inventory_references(source)
    try:
        envelope = original_source_envelope(source)
    except ValueError:
        return identifiers
    if (
        envelope.voids_event_id
        and FieldEvent.objects.filter(
            organization=source.organization,
            pk=envelope.voids_event_id,
            created_by=source.created_by,
        ).exists()
    ):
        identifiers.add(envelope.voids_event_id)
    if source.type in {"incident.report", "emergency.accident"}:
        from incidents.selectors import resource_context

        try:
            context = resource_context(source.organization, source.payload, source.shift_id)
        except Http404:
            context = None
        if context is not None and context.marker is not None:
            identifiers.add(context.marker.event_id)
    shift = (
        None
        if source.shift_id is None
        else Shift.objects.filter(organization=source.organization, pk=source.shift_id).first()
    )
    if shift:
        identifiers.add(shift.opened_event_id)
    for dependency in ReviewDependency.objects.filter(source_event=source):
        parent = _dependency_parent(source, dependency)
        if parent is not None:
            identifiers.add(parent.pk)
    return identifiers


def _inventory_references(source: FieldEvent) -> set[UUID]:
    identifiers: set[UUID] = set()
    if source.type == "sample.collect" and source.created_by is not None:
        from field_sync.registry import EventContext
        from lab.samples.handlers import source_references as sample_source_references

        try:
            envelope = original_source_envelope(source)
        except ValueError:
            return identifiers
        identifiers.update(
            sample_source_references(
                EventContext(
                    source.organization,
                    source.created_by,
                    source.device,
                    envelope,
                    source.server_received_at,
                )
            )
        )
    if source.type == "release.record" and source.created_by is not None:
        from field_sync.registry import EventContext
        from releases.stock import release_source_references

        try:
            envelope = original_source_envelope(source)
        except ValueError:
            return identifiers
        identifiers.update(
            release_source_references(
                EventContext(
                    source.organization,
                    source.created_by,
                    source.device,
                    envelope,
                    source.server_received_at,
                )
            )
        )
    if source.type in {"transfer.dispatch", "transfer.receive"}:
        from inventory.transfers.dependencies import source_references

        identifiers.update(source_references(source.organization, source.payload))
    if source.type in {"supplies.receive", "supplies.reconcile"}:
        from inventory.allocations.review import declared_sources

        identifiers.update(declared_sources(source.payload))
        identifiers.update(
            UUID(str(row["work_source_id"]))
            for row in source.payload.get("used", [])
            if "work_source_id" in row
        )
    return identifiers


def decide_review(
    actor: UploadActor, item_id: UUID, request: ReviewDecisionRequest
) -> ReviewDecision:
    from reviews.history import publish_review_decision, publish_source_shift_invalidation

    request = replace(request, reason=validate_void_reason(request.reason, "reason"))
    item = visible_review(actor, item_id, REVIEW_ITEM_DECIDE)
    _require_incident_accept_scope(actor, item, request.kind)
    if request.kind == "open_incident":
        from reviews.incident_actions import require_review_incident_scope

        require_review_incident_scope(actor, item)
    references = reference_sources(item.field_event)
    from reviews.boundaries import prepare_review_users, require_same_review_sources

    with (
        prepare_review_users(actor, item.field_event, references) as prepared_users,
        review_transaction(actor, item.field_event, references) as source,
    ):
        require_same_review_sources(actor, prepared_users, references | {source.pk})
        if not reference_sources(source).issubset(references):
            raise ReviewConflictError
        visible_review(actor, item_id, REVIEW_ITEM_DECIDE)
        revision = _decision_revision(item, request)
        evaluation = _review_evaluation(source, actor)
        with ExitStack() as stack:
            boundary = _prepare_action(stack, actor, item, request, evaluation)
            evidence = (
                bind_review_evidence(actor, item, request.evidence_ids)
                if request.kind != "open_incident"
                else sorted(str(identifier) for identifier in request.evidence_ids)
            )
            decision = ReviewDecision.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                review_item=item,
                revision=revision + 1,
                expected_revision=revision,
                kind=request.kind,
                is_terminal=request.kind == "accept"
                or (request.kind == "void" and evaluation.subjects.resolved),
                reason=request.reason,
                evidence_ids=evidence,
                evaluation=evaluation_payload(evaluation),
            )
            if boundary.safety_proof is not None:
                from reviews.safety_dispositions import record_safety_disposition

                record_safety_disposition(decision, boundary.safety_proof, evidence)
            if request.kind == "accept":
                _apply_or_adopt(source, decision, evaluation, boundary.publisher)
            elif request.kind == "open_incident":
                from reviews.incident_actions import open_review_incident

                open_review_incident(actor, item, decision, request.evidence_ids)
            publish_review_decision(decision, source)
            publish_source_shift_invalidation(source, cause=decision)
            from geography.decisions.producers import stored_source

            stored_source(source, cause=decision)
            from inventory.transfers.history import stored_source as stored_transfer_source

            stored_transfer_source(source, cause=decision)
            from community.history import stored_source as stored_community_source

            stored_community_source(source, cause=decision)
            from inventory.allocations.history import stored_source as stored_supply_source

            stored_supply_source(source, cause=decision)
    return decision


def _require_incident_accept_scope(actor: UploadActor, item: ReviewItem, kind: str) -> None:
    if kind == "accept" and item.field_event.type in {
        "incident.report",
        "emergency.accident",
    }:
        from incidents.selectors import require_context, resource_context

        try:
            source_context = resource_context(
                actor.organization, item.field_event.payload, item.field_event.shift_id
            )
        except Http404:
            raise ReviewBlockedError(("source_scope_unavailable",)) from None
        require_context(current_scope(actor), "incident.create", source_context)


def _decision_revision(item: ReviewItem, request: ReviewDecisionRequest) -> int:
    revision = item.decisions.aggregate(value=Max("revision"))["value"] or 0
    if (
        revision != request.expected_revision
        or item.decisions.filter(is_terminal=True).exists()
        or (
            request.kind == "open_incident" and item.decisions.filter(kind="open_incident").exists()
        )
    ):
        raise ReviewConflictError
    if request.kind not in {"accept", "void", "open_incident"}:
        raise ReviewBlockedError(("unknown_review_action",))
    if request.kind != "void" and request.safety_disposition is not None:
        raise ReviewBlockedError(("safety_disposition_action",))
    return revision


def _review_evaluation(source: FieldEvent, actor: UploadActor) -> ReviewEvaluation:
    evaluation = inspect_review(source)
    if evaluation.context is not None and evaluation.context.review_authorization is not None:
        return replace(
            evaluation,
            context=replace(
                evaluation.context,
                review_authorization=replace(
                    evaluation.context.review_authorization, reviewer_actor=actor
                ),
            ),
        )
    return evaluation


def _prepare_action(  # noqa: PLR0913 -- retained lock stack, authenticated actor, immutable item, command and evaluation
    stack: ExitStack,
    actor: UploadActor,
    item: ReviewItem,
    request: ReviewDecisionRequest,
    evaluation: ReviewEvaluation,
) -> DecisionBoundary:
    from reviews.models import ReviewSourceSnapshot
    from reviews.safety_dispositions import prepare_safety_disposition

    source = item.field_event
    publisher = None
    if request.kind == "accept":
        try:
            publisher = _prepare_accept(stack, source, evaluation)
            visible_review(actor, item.pk, REVIEW_ITEM_DECIDE)
            _resolve_dependencies(source, actor)
        except (EventNeedsReview, EventRejected) as error:
            if error.code == "already_voided":
                raise AlreadyVoidedError from None
            raise ReviewBlockedError((error.code,)) from None
    if request.kind == "void":
        if evaluation.subjects.resolved and evaluation.legacy.state != "none":
            raise ReviewBlockedError(("legacy_effect_requires_owner_correction",))
        snapshot = ReviewSourceSnapshot.objects.filter(
            source_event=source, has_severe_observation=True
        ).first()
        if evaluation.subjects.resolved and snapshot is not None:
            return DecisionBoundary(
                safety_proof=prepare_safety_disposition(
                    actor, evaluation, snapshot, request.safety_disposition
                )
            )
        if request.safety_disposition is not None:
            raise ReviewBlockedError(("safety_source_unavailable",))
    return DecisionBoundary(publisher=publisher)


def _prepare_accept(
    stack: ExitStack, source: FieldEvent, evaluation: ReviewEvaluation
) -> FanoutPublisher | None:
    if "already_voided" in evaluation.blockers:
        raise AlreadyVoidedError
    if evaluation.blockers or evaluation.context is None:
        raise ReviewBlockedError(evaluation.blockers)
    handler = get_handler(source.type, source.schema_version)
    if handler is None or handler.review_adapter is None:
        raise ReviewBlockedError(("handler_unavailable",))
    from reviews.boundaries import retain_domain_boundary

    if evaluation.subjects.resource_kind in {
        "transfer",
        "supply_assignment",
        "release",
    } or source.type in {"shift.close", "release.record"}:
        from inventory.transactions import inventory_transaction

        stack.enter_context(inventory_transaction(organization=source.organization))

    retain_domain_boundary(evaluation.context, handler, evaluation.subjects)
    publisher = None
    if evaluation.subjects.resource_kind == "sampling_point":
        from field_sync.services import fanout_courier_changes
        from geography.models import SamplingPoint
        from ovitraps.services import point_fanout_scope

        if evaluation.subjects.resource_id is None:
            raise ReviewBlockedError(("source_scope_unavailable",))
        point = SamplingPoint.objects.get(pk=evaluation.subjects.resource_id)
        publisher = stack.enter_context(fanout_courier_changes(point_fanout_scope(point)))
    handler.review_adapter.prepare_boundary(evaluation.context, validated_original_payload(source))
    if handler.checks_shift:
        _require_current_envelope(source, evaluation)
    return publisher


def _require_current_envelope(source: FieldEvent, evaluation: ReviewEvaluation) -> None:
    if evaluation.context is not None:
        from field_sync.registry import run_envelope_checks
        from reviews.effect_receipts import is_effective
        from shifts.models import Shift

        if source.shift_id is not None:
            shift = (
                Shift.objects.filter(
                    organization=source.organization, pk=source.shift_id, courier=source.created_by
                )
                .select_related("opened_event")
                .first()
            )
            if shift is not None and not is_effective(shift.opened_event):
                raise ReviewBlockedError(("causal_parent_pending",))
        try:
            signal = run_envelope_checks(
                source.organization, evaluation.context.user, evaluation.context.envelope
            )
        except EventRejected as error:
            raise ReviewBlockedError((error.code,)) from None
        if signal is not None:
            raise ReviewBlockedError((signal.code,))


def _resolve_dependencies(source: FieldEvent, actor: UploadActor) -> None:
    from reviews.effect_receipts import is_effective

    for dependency in ReviewDependency.objects.filter(source_event=source):
        parent = _dependency_parent(source, dependency)
        if (
            parent is None
            or (
                dependency.kind not in {"ovitrap", "transfer_source", "supply_source"}
                and parent.created_by_id != source.created_by_id
            )
            or not is_effective(parent)
        ):
            raise ReviewBlockedError(("causal_parent_pending",))
        if (
            dependency.candidate_source_id is not None
            and dependency.candidate_source_id != parent.pk
        ):
            raise ReviewBlockedError(("causal_parent_identity_conflict",))
        if dependency.candidate_envelope:
            from reviews.source_identity import envelope_metadata

            if envelope_metadata(original_source_envelope(parent)) != dependency.candidate_envelope:
                raise ReviewBlockedError(("causal_parent_identity_conflict",))
        resolution = ReviewDependencyResolution.objects.filter(dependency=dependency).first()
        if resolution is not None:
            if resolution.parent_source_id != parent.pk:
                raise ReviewConflictError
            continue
        receipt = ReviewEffectReceipt.objects.filter(source_event=parent).first()
        ReviewDependencyResolution.objects.create(
            organization=source.organization,
            created_by=actor.user,
            dependency=dependency,
            parent_source=parent,
            parent_effect_receipt=receipt,
            proof={"effective": True},
        )
    _record_resolved_subject(source, actor)


def _dependency_parent(source: FieldEvent, dependency: ReviewDependency) -> FieldEvent | None:
    if dependency.kind == "supply_source":
        from inventory.allocations.review import dependency_parent

        return dependency_parent(source, dependency)
    if dependency.kind == "transfer_source":
        from inventory.transfers.dependencies import dependency_parent

        return dependency_parent(source, dependency)
    if dependency.kind == "void_target":
        return FieldEvent.objects.filter(
            organization=source.organization,
            pk=dependency.declared_id,
            created_by=source.created_by,
        ).first()
    if dependency.kind == "shift":
        from shifts.models import Shift

        shift = (
            Shift.objects.filter(
                organization=source.organization,
                pk=dependency.declared_id,
                courier=source.created_by,
            )
            .select_related("opened_event")
            .first()
        )
        if shift is not None:
            return shift.opened_event
    if dependency.kind == "ovitrap":
        from ovitraps.models import Ovitrap

        physical = (
            Ovitrap.objects.filter(
                organization=source.organization, client_uuid=dependency.declared_id
            )
            .select_related("event")
            .first()
        )
        if physical is not None:
            return physical.event
    claim = (
        ReviewParentClaim.objects.filter(
            organization=source.organization, kind=dependency.kind, identity=dependency.declared_id
        )
        .select_related("source_event")
        .first()
    )
    return None if claim is None else claim.source_event


def _record_resolved_subject(source: FieldEvent, actor: UploadActor) -> None:
    previous = ReviewSubjectScope.objects.filter(source_event=source).order_by("-revision").first()
    if previous is None or previous.is_resolved:
        return
    facts = subject_facts(source.organization, original_source_envelope(source))
    if facts.resolved:
        ReviewSubjectScope.objects.create(
            organization=source.organization,
            created_by=actor.user,
            source_event=source,
            revision=previous.revision + 1,
            is_resolved=True,
            contexts=list(facts.contexts),
            proof={
                "kind": "resolved_dependency",
                "payload_sha256": source.payload_sha256,
                "resolutions": [
                    str(value)
                    for value in ReviewDependencyResolution.objects.filter(
                        dependency__source_event=source
                    ).values_list("pk", flat=True)
                ],
            },
        )


def _apply_or_adopt(  # noqa: PLR0913 -- immutable source/decision/evaluation and the already retained publisher
    source: FieldEvent,
    decision: ReviewDecision,
    evaluation: ReviewEvaluation,
    publisher: FanoutPublisher | None = None,
) -> None:
    handler = get_handler(source.type, source.schema_version)
    if handler is None or handler.review_adapter is None or evaluation.context is None:
        raise ReviewBlockedError(("handler_unavailable",))
    legacy = evaluation.legacy
    if legacy.state not in {"none", "complete_owned"}:
        raise ReviewBlockedError(("legacy_materialization_unavailable",))
    materialization = legacy.materialization
    if legacy.state == "none":
        try:
            materialization = handler.review_adapter.execute_review(
                evaluation.context, _validated_payload(handler, source)
            )
        except (EventNeedsReview, EventRejected) as error:
            if error.code == "already_voided":
                raise AlreadyVoidedError from None
            raise ReviewBlockedError((error.code,)) from None
    if not materialization:
        raise ReviewBlockedError(("effect_materialization_unavailable",))
    resolutions = list(
        ReviewDependencyResolution.objects.filter(dependency__source_event=source).values_list(
            "pk", flat=True
        )
    )
    if resolutions:
        materialization = {
            **materialization,
            "dependency_resolution_ids": sorted(str(value) for value in resolutions),
        }
    if "resolved_speed_reference" in evaluation.context.observed_facts:
        materialization = {
            **materialization,
            "resolved_speed_reference": evaluation.context.observed_facts[
                "resolved_speed_reference"
            ],
        }
    ReviewEffectReceipt.objects.create(
        organization=source.organization,
        created_by=decision.created_by,
        source_event=source,
        decision=decision,
        mode="adopted_legacy" if evaluation.legacy.state == "complete_owned" else "applied_review",
        payload_sha256=source.payload_sha256,
        handler_version=f"{source.type}.v{source.schema_version}",
        materialization=materialization,
        authority_proofs=list(evaluation.proof_ids),
        observations=sorted(evaluation.context.review_authorization.observations)
        if evaluation.context.review_authorization is not None
        else [],
    )
    if evaluation.legacy.state == "complete_owned" and publisher is not None:
        _publish_adopted_completion(source, evaluation, publisher)


def _publish_adopted_completion(
    source: FieldEvent, evaluation: ReviewEvaluation, publisher: FanoutPublisher
) -> None:
    from geography.models import SamplingPoint
    from scheduling.courier_feed import emit_task_completion

    event = source
    if source.type == "record.void" and evaluation.context is not None:
        from field_sync.handlers.void import find_void_target

        event = find_void_target(evaluation.context)
    if not event.type.startswith("ovitrap.") or evaluation.subjects.resource_id is None:
        return
    point = SamplingPoint.objects.get(pk=evaluation.subjects.resource_id)
    emit_task_completion(point, event, publisher)


def _validated_payload(handler: EventHandler, source: FieldEvent) -> dict[str, Any]:
    return validated_original_payload(source)
