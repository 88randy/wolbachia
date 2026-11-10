"""Retain original method/source observations; acceptance creates one actual sample."""

from copy import deepcopy
from typing import Any

from django.http import Http404
from rest_framework import serializers

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from lab.samples.models import WolbachiaSample
from reviews.contracts import ReviewAdapter
from reviews.exceptions import ReviewBlockedError
from reviews.inspection import ExistingEffect, validated_original_payload
from uploads.access import UploadActor


def collection_facts(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    from lab.samples.services import validate_collection

    try:
        facts = validate_collection(ctx, values)
    except Http404:
        raise EventRejected("sample_inaccessible") from None
    except serializers.ValidationError as error:
        from field_sync.services import rejection_params

        raise EventRejected("invalid_payload", rejection_params(error)) from None
    ctx.observed_facts["sample"] = deepcopy(facts)
    if ctx.review_authorization is not None:
        original = ctx.review_authorization.owner_facts.get("sample")
        if not isinstance(original, dict) or original != facts:
            raise ReviewBlockedError(("capture_context_unavailable",))
    return facts


class SampleReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "causal_parent_pending",
            "sample_configuration_unavailable",
            "sample_evidence_required",
        }
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from lab.samples.handlers import authorize_collection

        authorize_collection(ctx, data)
        return {"sample": collection_facts(ctx, data)}

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        if "sample" not in ctx.observed_facts:
            try:
                collection_facts(ctx, data)
            except EventNeedsReview:
                return {"sample": {"available": False}}
        return {"sample": deepcopy(ctx.observed_facts["sample"])}

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        sample = WolbachiaSample.objects.filter(
            organization=source.organization, event_id=source.pk
        ).first()
        if sample is None:
            return ExistingEffect()
        collection_facts(ctx, validated_original_payload(source))
        if sample.created_by_id != source.created_by_id:
            return ExistingEffect("partial", blockers=("sample_effect_unavailable",))
        return ExistingEffect(
            "complete_owned", {"sample_id": str(sample.pk), "source_event_id": str(source.pk)}
        )

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from lab.samples.handlers import authorize_collection
        from lab.samples.services import collect_sample, require_source_scope, resolve_source

        authorize_collection(ctx, data)
        collection_facts(ctx, data)
        reviewer = (
            None if ctx.review_authorization is None else ctx.review_authorization.reviewer_actor
        )
        if reviewer is None:
            raise EventRejected("sample_inaccessible")
        try:
            source = resolve_source(ctx.organization, data["source_ref"])
            require_source_scope(reviewer, source, "sample.collect")
            require_source_scope(
                UploadActor(ctx.user, ctx.organization, ctx.device.pk), source, "sample.collect"
            )
            sample = collect_sample(ctx, data)
        except Http404:
            raise EventRejected("sample_inaccessible") from None
        return {"sample_id": str(sample.pk), "source_event_id": str(ctx.envelope.id)}


def void_materialization(target: FieldEvent) -> dict[str, Any]:
    return {
        "target_event_id": str(target.pk),
        "voided_at": target.voided_at.isoformat() if target.voided_at else None,
    }


def inspect_void(source: FieldEvent, target: FieldEvent) -> ExistingEffect:
    from core.void_reason import validate_void_reason

    values = validated_original_payload(source)
    if (
        source.voids_event_id == target.pk
        and target.voided_by_id == source.created_by_id
        and target.voided_at is not None
        and target.void_reason_code == values["reason_code"]
        and target.void_reason == validate_void_reason(values["reason"], "reason")
    ):
        return ExistingEffect("complete_owned", void_materialization(target))
    return ExistingEffect("partial", blockers=("sample_void_effect_unavailable",))
