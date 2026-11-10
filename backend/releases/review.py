"""Source-bound release review; acknowledgements never override regulatory safety."""

from copy import deepcopy
from typing import Any

from field_sync.exceptions import EventNeedsReview
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from releases.models import Release
from reviews.contracts import ReviewAdapter
from reviews.exceptions import ReviewBlockedError
from reviews.inspection import ExistingEffect, validated_original_payload

ORIGINAL_KEYS = (
    "permit_version",
    "permit_type",
    "requirements",
    "official_document",
    "source_payload_hash",
    "rules_version",
    "catalog_version",
    "source_lot_version",
    "schedule",
)


def _require_original(ctx: EventContext, facts: dict[str, Any]) -> None:
    if ctx.review_authorization is None:
        return
    original = ctx.review_authorization.owner_facts.get("release")
    if not isinstance(original, dict) or any(
        original.get(key) != facts.get(key) for key in ORIGINAL_KEYS
    ):
        raise ReviewBlockedError(("capture_context_unavailable",))
    if original.get("training", {}).get("capture") != facts.get("training", {}).get("capture"):
        raise ReviewBlockedError(("capture_context_changed",))


def _owner_facts(ctx: EventContext) -> dict[str, Any]:
    return deepcopy(
        {
            key: value
            for key, value in ctx.observed_facts.items()
            if key in {"release", "release_stock"}
        }
    )


class ReleaseReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {
            "clock_skew",
            "final_upload_after_revoke",
            "causal_parent_pending",
            "release_transit_review_required",
        }
    )

    def prepare_boundary(self, ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
        from releases.handlers import prepare_release

        facts = prepare_release(ctx, values)
        _require_original(ctx, facts)
        return _owner_facts(ctx)

    def capture_observations(self, ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
        if "release_stock" not in ctx.observed_facts:
            from releases.handlers import prepare_release

            try:
                prepare_release(ctx, values)
            except EventNeedsReview:
                # The same validated original pins precede the manual transit observation.
                return _owner_facts(ctx)
        return _owner_facts(ctx)

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        from releases.handlers import capture_release_facts

        release = Release.objects.filter(
            organization=source.organization,
            declared_event_id=source.pk,
            created_by=source.created_by,
        ).first()
        if release is None:
            facts = capture_release_facts(ctx, validated_original_payload(source))
            _require_original(ctx, facts)
            return ExistingEffect()
        _require_original(ctx, release.provenance)
        if release.provenance.get("source_payload_hash") != source.payload_sha256 or not hasattr(
            release, "stock_operation"
        ):
            return ExistingEffect("partial", blockers=("release_effect_unavailable",))
        return ExistingEffect(
            "complete_owned",
            {"release_id": str(release.pk), "stock_operation_id": str(release.stock_operation.pk)},
        )

    def execute_review(self, ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
        from releases.handlers import apply_release

        release = apply_release(ctx, values)
        return {
            "release_id": str(release.pk),
            "stock_operation_id": str(release.stock_operation.pk),
        }
