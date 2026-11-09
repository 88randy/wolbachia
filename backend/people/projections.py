"""Prepared self publication writes once; producer/builders only read the bound cache."""

from dataclasses import replace
from datetime import datetime
from typing import Any, cast
from uuid import UUID, uuid5

from django.core.exceptions import ImproperlyConfigured
from django.db.models import Q

from core.snapshots import snapshot_hash
from core.time import server_now
from field_sync.envelope import BatchContext, CourierContext
from field_sync.models import CourierChange
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC
from field_sync.producers import ProducerContext
from field_sync.selectors import (
    latest_change_sequence,
    membership_snapshots,
    scope_revision,
)
from field_sync.services import ChangeInput, append_courier_change, require_courier_lock
from organizations.models import Organization
from organizations.scope import intersect
from people.eligibility import AssessmentQuery, assess_training_eligibility
from people.models import ActionTrainingRequirementVersion, EligibilityAssessmentReceipt
from people.permissions import PeopleContext, allows_contexts
from people.selectors import scoped_facts


def requires_publication_arbiter(batch: BatchContext) -> bool:
    return (
        batch.publication_authenticated
        and ActionTrainingRequirementVersion.objects.filter(
            organization=batch.organization
        ).exists()
    )


def eligibility_change_filter(ctx: ProducerContext) -> Q:
    """Both independent actions must cover this actual pair before feed LIMIT/count."""
    allowed = Q(pk__in=[])
    for boot_codes, boot_scope in ctx.scope.grants:
        if FIELD_BOOTSTRAP not in boot_codes:
            continue
        for sync_codes, sync_scope in ctx.scope.grants:
            if FIELD_EVENT_SYNC not in sync_codes:
                continue
            centers = intersect(boot_scope["centers"], sync_scope["centers"])
            quadrants = intersect(boot_scope["quadrants"], sync_scope["quadrants"])
            grant = Q(scope__center_id__isnull=False)
            if centers["mode"] != "all":
                grant &= Q(
                    scope__center_id__in=centers["ids"] if centers["mode"] == "selected" else []
                )
            if quadrants["mode"] != "all":
                grant &= Q(scope__quadrant_id=None) | Q(
                    scope__quadrant_id__in=quadrants["ids"]
                    if quadrants["mode"] == "selected"
                    else []
                )
            allowed |= grant
    return allowed


def _contexts(ctx: ProducerContext) -> list[tuple[str, PeopleContext]]:
    facts = ActionTrainingRequirementVersion.objects.filter(organization=ctx.organization)
    rows = (
        scoped_facts(scoped_facts(facts, ctx.scope, FIELD_BOOTSTRAP), ctx.scope, FIELD_EVENT_SYNC)
        .order_by("action", "center_id", "quadrant_id")
        .values_list("action", "center_id", "quadrant_id")
        .distinct()
    )
    return [
        (action, PeopleContext(center, quadrant))
        for action, center, quadrant in rows
        if all(
            allows_contexts(ctx.scope, permission, (PeopleContext(center, quadrant),))
            for permission in (FIELD_BOOTSTRAP, FIELD_EVENT_SYNC)
        )
    ]


def _resource_id(ctx: ProducerContext, action: str, context: PeopleContext) -> UUID:
    return uuid5(
        ctx.organization.pk,
        f"training-eligibility:{ctx.user.pk}:{action}:{context.center_id}:{context.quadrant_id}",
    )


def _assessment(ctx: ProducerContext, action: str, context: PeopleContext) -> dict[str, Any]:
    return assess_training_eligibility(
        AssessmentQuery(ctx.organization, ctx.user.pk, action, context, ctx.now, ctx.now)
    )


def _payload(
    ctx: ProducerContext, assessment: dict[str, Any], receipt: EligibilityAssessmentReceipt | None
) -> dict[str, Any]:
    context = PeopleContext(
        UUID(assessment["center_id"]),
        None if assessment["quadrant_id"] is None else UUID(assessment["quadrant_id"]),
    )
    body = {
        "id": str(_resource_id(ctx, assessment["action"], context)),
        "organization_id": str(ctx.organization.pk),
        **assessment,
        "assessment_receipt": None if receipt is None else str(receipt.pk),
    }
    return {**body, "version": snapshot_hash(body)}


def build_eligibility(ctx: ProducerContext) -> list[dict[str, Any]]:
    """No receipt, lock or feed write occurs in a producer read."""
    if ctx.eligibility_payloads is not None:
        if ctx.eligibility_frame != _frame(ctx, ctx.eligibility_payloads):
            raise ImproperlyConfigured("Prepared eligibility context changed.")
        return list(ctx.eligibility_payloads)
    return [
        _payload(ctx, _assessment(ctx, action, context), None) for action, context in _contexts(ctx)
    ]


def _append_payload(ctx: ProducerContext, payload: dict[str, Any]) -> None:
    batch = CourierContext(ctx.organization, ctx.user)
    last = (
        CourierChange.objects.filter(
            organization=ctx.organization,
            courier=ctx.user,
            kind="eligibility",
            resource_id=payload["id"],
        )
        .order_by("-sequence")
        .first()
    )
    if last is not None and last.resource_version == payload["version"]:
        return
    if (
        last is not None
        and payload["assessment_receipt"] is None
        and all(
            last.payload.get(key) == value
            for key, value in payload.items()
            if key not in {"version", "assessment_receipt"}
        )
    ):
        return
    append_courier_change(
        batch,
        ChangeInput(
            kind="eligibility",
            resource_type="training_eligibility",
            resource_id=payload["id"],
            resource_version=payload["version"],
            action="upsert",
            payload=payload,
            scope={"center_id": payload["center_id"], "quadrant_id": payload["quadrant_id"]},
        ),
    )


def _receipt(
    batch: BatchContext, ctx: ProducerContext, assessment: dict[str, Any]
) -> EligibilityAssessmentReceipt:
    if batch.observed_session_id is None or batch.observed_pair_id is None:
        raise ImproperlyConfigured("Bound authenticated publication required.")
    semantic = snapshot_hash(assessment)
    revision = scope_revision(ctx)
    context = PeopleContext(
        UUID(assessment["center_id"]),
        None if assessment["quadrant_id"] is None else UUID(assessment["quadrant_id"]),
    )
    prior = EligibilityAssessmentReceipt.objects.filter(
        session_id=batch.observed_session_id,
        action=assessment["action"],
        **context.lookups(),
        semantic_hash=semantic,
        scope_revision=revision,
    ).first()
    if prior is not None:
        return cast(EligibilityAssessmentReceipt, prior)
    return cast(
        EligibilityAssessmentReceipt,
        EligibilityAssessmentReceipt.objects.create(
            organization=ctx.organization,
            created_by=ctx.user,
            subject=ctx.user,
            session_id=batch.observed_session_id,
            pair_id=batch.observed_pair_id,
            action=assessment["action"],
            center_id=context.center_id,
            quadrant_id=context.quadrant_id,
            semantic_hash=semantic,
            scope_revision=revision,
            publication_sequence=latest_change_sequence(batch) + 1,
            assessment=assessment,
            authority={
                "permission_codes": [FIELD_BOOTSTRAP, FIELD_EVENT_SYNC],
                **context.payload(),
                "scope_revision": revision,
            },
            valid_from=assessment["valid_from"],
            valid_until=assessment["valid_until"],
        ),
    )


def prepare_eligibility_publication(batch: BatchContext, ctx: ProducerContext) -> ProducerContext:
    """Caller retained real account -> Organization -> courier locks before this writer."""
    current = replace(ctx, now=server_now())
    bound: list[dict[str, Any]] = []
    genuine = (
        batch.publication_authenticated
        and batch.observed_session_id is not None
        and batch.observed_pair_id is not None
        and not batch.is_final_upload
    )
    if genuine:
        require_courier_lock(batch)
    for action, context in _contexts(current):
        assessment = _assessment(current, action, context)
        receipt = _receipt(batch, current, assessment) if genuine else None
        payload = _payload(current, assessment, receipt)
        if genuine:
            _append_payload(current, payload)
        bound.append(payload)
    return replace(
        ctx, eligibility_payloads=tuple(bound), eligibility_frame=_frame(ctx, tuple(bound))
    )


def _frame(ctx: ProducerContext, payloads: tuple[dict[str, Any], ...]) -> tuple[str, str, str, str]:
    return (
        str(ctx.user.pk),
        str(ctx.organization.pk),
        scope_revision(ctx),
        snapshot_hash({"payloads": payloads}),
    )


def publish_changed_eligibility(organization: Organization) -> None:
    """Domain command already prepared every affected User/courier before Org."""
    from field_sync.selectors import captured_generation, captured_scope

    for member in (
        membership_snapshots(organization)
        .filter(
            profiles__organization=organization,
            profiles__is_active=True,
            profiles__permission_codes__contains=[FIELD_BOOTSTRAP],
        )
        .distinct()
    ):
        ctx = ProducerContext(
            organization,
            member.user,
            captured_scope(member),
            server_now(),
            FIELD_BOOTSTRAP,
            configuration_generation=captured_generation(member),
        )
        require_courier_lock(CourierContext(organization, member.user))
        for payload in build_eligibility(ctx):
            _append_payload(ctx, payload)


def earliest_eligibility_change(ctx: ProducerContext) -> str | None:
    transitions = [
        datetime.fromisoformat(row["next_change_at"])
        for row in build_eligibility(ctx)
        if row["next_change_at"] is not None
    ]
    return min(transitions).isoformat() if transitions else None


def original_assessment(query: AssessmentQuery, identifier: UUID) -> dict[str, Any] | None:
    """Historical business proof never needs Session.user or a pruned TokenPair row."""
    receipt = EligibilityAssessmentReceipt.objects.filter(
        organization=query.organization,
        pk=identifier,
        subject_id=query.subject_id,
        action=query.action,
        **query.context.lookups(),
        created_at__lte=query.at,
        valid_from__lte=query.at,
        valid_until__gt=query.at,
    ).first()
    if receipt is None or not receipt.assessment.get("training_eligible"):
        return None
    proof = CourierChange.objects.filter(
        organization=query.organization,
        courier_id=query.subject_id,
        sequence=receipt.publication_sequence,
        kind="eligibility",
        resource_type="training_eligibility",
        payload__assessment_receipt=str(receipt.pk),
    ).exists()
    return receipt.assessment if proof else None
