"""A deferred original record.void invokes its real target hook once."""

from typing import Any

from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from reviews.contracts import ReviewAdapter
from reviews.inspection import ExistingEffect


class VoidReviewAdapter(ReviewAdapter):
    reviewable_codes = frozenset(
        {"clock_skew", "final_upload_after_revoke", "causal_parent_pending"}
    )

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> None:
        from field_sync.handlers.void import find_void_target
        from reviews.safety import has_pending_severe_source

        target = find_void_target(ctx)
        if target.voided_at is not None:
            source = FieldEvent.objects.filter(pk=ctx.envelope.id).first()
            if source is not None and self.inspect_existing(source, ctx).state == "complete_owned":
                from reviews.boundaries import prepare_target_domain

                prepare_target_domain(ctx, target)
                return
            from field_sync.exceptions import EventRejected

            raise EventRejected("already_voided")
        if ctx.review_code is not None and ctx.review_authorization is None:
            return
        if has_pending_severe_source(target.pk):
            from field_sync.exceptions import EventNeedsReview

            raise EventNeedsReview("causal_parent_pending")
        from reviews.boundaries import prepare_target_domain

        prepare_target_domain(ctx, target)

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        from field_sync.handlers.void import find_void_target

        target = find_void_target(ctx)
        if target.voided_at is not None:
            if target.type in {"supplies.receive", "supplies.reconcile"}:
                from inventory.allocations.write_offs import inspect_supply_void

                return inspect_supply_void(source, target)
            if target.type in {"transfer.dispatch", "transfer.receive"}:
                from inventory.transfers.voids import inspect_void

                return inspect_void(source, target)
            from ovitraps.models import OvitrapVoid
            from reviews.inspection import validated_original_payload

            correction = OvitrapVoid.objects.filter(
                event=source,
                target_event=target,
                organization=source.organization,
                created_by=source.created_by,
            ).first()
            if correction is not None:
                data = validated_original_payload(source)
                valid = (
                    target.voided_by_id == source.created_by_id
                    and correction.reason == target.void_reason
                    and correction.reason_code == target.void_reason_code == data["reason_code"]
                    and (not data.get("reason") or data["reason"] == correction.reason)
                )
                if valid:
                    return ExistingEffect(
                        "complete_owned",
                        {
                            "ovitrap_void_id": str(correction.pk),
                            "target_event_id": str(target.pk),
                            "voided_at": target.voided_at.isoformat(),
                        },
                    )
            return ExistingEffect("partial", blockers=("already_voided",))
        return ExistingEffect()

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from field_sync.handlers.void import apply_void, find_void_target

        apply_void(ctx, data)
        target = find_void_target(ctx)
        if target.voided_at is None:
            from reviews.exceptions import ReviewBlockedError

            raise ReviewBlockedError(("void_effect_unavailable",))
        if target.type in {"transfer.dispatch", "transfer.receive"}:
            from inventory.transfers.voids import void_materialization

            return void_materialization(ctx.envelope.id, target)
        if target.type in {"supplies.receive", "supplies.reconcile"}:
            from inventory.allocations.write_offs import inspect_supply_void

            source = FieldEvent.objects.filter(pk=ctx.envelope.id).first()
            if source is not None:
                return dict(inspect_supply_void(source, target).materialization)
            from inventory.allocations.models import SupplyVoidAudit

            audit = SupplyVoidAudit.objects.get(
                organization=ctx.organization, declared_source_uuid=ctx.envelope.id
            )
            return {"supply_void_audit_id": str(audit.pk), "target_event_id": str(target.pk)}
        from ovitraps.models import OvitrapVoid

        correction = OvitrapVoid.objects.filter(
            event_id=ctx.envelope.id, target_event=target, organization=ctx.organization
        ).first()
        return {
            "target_event_id": str(target.pk),
            "voided_at": target.voided_at.isoformat(),
            "ovitrap_void_id": None if correction is None else str(correction.pk),
        }
