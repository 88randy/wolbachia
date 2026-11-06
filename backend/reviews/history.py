"""Append the real CourierChange and its receipt once, under the original courier lock."""

from typing import Any

from accounts.models import User
from core.models import OrgScopedModel
from core.snapshots import snapshot_hash
from field_sync.envelope import CourierContext
from field_sync.models import CourierChange, FieldEvent
from field_sync.producers import ProducerContext
from field_sync.services import ChangeInput, append_courier_change
from reviews.history_scope import visible_history_contexts
from reviews.inspection import original_source_envelope
from reviews.models import (
    HistoryPublicationReceipt,
    ReviewDecision,
    ReviewEffectReceipt,
    ReviewIncidentLink,
    ShiftDecision,
)
from reviews.scope import subject_facts


def publish_history(  # noqa: PLR0913 -- durable cause, actual recipient and typed payload
    cause_kind: str, cause: OrgScopedModel, courier: User, payload: dict[str, Any]
) -> None:
    version = snapshot_hash(payload)
    resource_type = f"history.{payload['kind']}"
    existing = HistoryPublicationReceipt.objects.filter(
        cause_kind=cause_kind,
        cause_id=cause.pk,
        courier=courier,
        resource_type=resource_type,
        resource_id=payload["id"],
        resource_version=version,
    ).exists()
    if existing:
        return
    context = payload["subjects"][0]
    change = append_courier_change(
        CourierContext(cause.organization, courier),
        ChangeInput(
            kind="history",
            resource_type=resource_type,
            resource_id=str(payload["id"]),
            resource_version=version,
            scope=context,
            action="upsert",
            payload=payload,
        ),
    )
    HistoryPublicationReceipt.objects.create(
        organization=cause.organization,
        created_by=cause.created_by,
        cause_kind=cause_kind,
        cause_id=cause.pk,
        courier=courier,
        resource_type=resource_type,
        resource_id=payload["id"],
        resource_version=version,
        change=change,
    )


def publish_review_decision(decision: ReviewDecision, source: FieldEvent) -> None:
    if not decision.evaluation.get("scope_resolved"):
        return
    try:
        envelope = original_source_envelope(source)
    except ValueError:
        return  # No safe subject vector: retained decision is inspectable, not broadcast.
    facts = subject_facts(source.organization, envelope)
    if not facts.resolved:
        return
    receipt = ReviewEffectReceipt.objects.filter(decision=decision).first()
    incident = ReviewIncidentLink.objects.filter(decision=decision).first()
    state = (
        receipt.mode if receipt else ("discarded" if decision.kind == "void" else "incident_open")
    )
    payload = {
        "id": str(decision.pk),
        "kind": "review_decision",
        "review_item_id": str(decision.review_item_id),
        "source_event_id": str(source.pk),
        "shift_id": None if source.shift_id is None else str(source.shift_id),
        "decision_kind": decision.kind,
        "revision": decision.revision,
        "is_terminal": decision.is_terminal,
        "decision_state": decision.decision_state,
        "reason": decision.reason,
        "decided_by": str(decision.created_by_id),
        "decided_at": decision.created_at.isoformat(),
        "subjects": list(facts.contexts),
        "source_status": source.status,
        "source_code": source.status_code,
        "effect_state": state,
        "incident_id": None if incident is None else str(incident.incident_id),
        "declared_void_target_uuid": None
        if original_source_envelope(source).voids_event_id is None
        else str(original_source_envelope(source).voids_event_id),
        "approval_current": None,
    }
    publish_history("review_decision", decision, decision.review_item.courier, payload)


def publish_shift_decision(decision: ShiftDecision, *, cause: OrgScopedModel | None = None) -> None:
    from shifts.validation import validation_fingerprint

    shift = decision.shift
    current = (
        decision.kind == "approve"
        and decision.validation_fingerprint == validation_fingerprint(shift)
    )
    payload = {
        "id": str(decision.pk),
        "kind": "shift_validation",
        "review_item_id": None,
        "source_event_id": str(decision.closed_event_id),
        "shift_id": str(shift.pk),
        "decision_kind": decision.kind,
        "revision": decision.revision,
        "is_terminal": None,
        "decision_state": "approved" if decision.kind == "approve" else "observed",
        "reason": decision.reason,
        "decided_by": str(decision.created_by_id),
        "decided_at": decision.created_at.isoformat(),
        "subjects": decision.subjects,
        "source_status": decision.closed_event.status,
        "source_code": decision.closed_event.status_code,
        "effect_state": "approved" if decision.kind == "approve" else "observed",
        "incident_id": None,
        "declared_void_target_uuid": None,
        "approval_current": current,
    }
    if cause is not None:
        latest_version = (
            CourierChange.objects.filter(
                organization=decision.organization,
                courier=shift.courier,
                kind="history",
                resource_type="history.shift_validation",
                resource_id=str(decision.pk),
            )
            .order_by("-sequence")
            .values_list("resource_version", flat=True)
            .first()
        )
        if latest_version == snapshot_hash(payload):
            return
    publish_history(
        "shift_validation" if cause is None else "shift_review_invalidated",
        decision if cause is None else cause,
        shift.courier,
        payload,
    )


def publish_source_shift_invalidation(
    source: FieldEvent, *, cause: ReviewDecision | None = None
) -> None:
    """Use retained own-source locks; an effective void also affects its REAL target frame."""
    from reviews.effect_receipts import is_effective

    identities = {source.shift_id} if source.shift_id is not None else set()
    if source.type == "record.void" and is_effective(source):
        try:
            declared = original_source_envelope(source).voids_event_id
        except ValueError:
            declared = None
        target = (
            None
            if declared is None
            else FieldEvent.objects.filter(
                organization=source.organization,
                pk=declared,
                created_by=source.created_by,
                voided_at__isnull=False,
            ).first()
        )
        if target is not None and target.shift_id is not None:
            identities.add(target.shift_id)
    for identity in sorted(identities):
        decision = (
            ShiftDecision.objects.filter(
                organization=source.organization,
                shift_id=identity,
                shift__courier_id=source.created_by_id,
            )
            .select_related("shift__courier", "shift__organization", "closed_event")
            .order_by("-revision")
            .first()
        )
        if decision is not None and decision.kind == "approve":
            publish_shift_decision(decision, cause=source if cause is None else cause)


def build_history(ctx: ProducerContext) -> list[dict[str, Any]]:
    visibility = visible_history_contexts(ctx)
    rows = CourierChange.objects.filter(
        organization=ctx.organization, courier=ctx.user, kind="history", pk__in=visibility
    )
    latest = {}
    for row in rows.order_by("sequence"):
        latest[(row.resource_type, row.resource_id)] = (row.payload, visibility[row.pk])
    return [
        {**payload, "organization_id": str(ctx.organization.pk), **contexts[0]}
        for payload, contexts in latest.values()
    ]
