"""Transfer review retains selected immutable inputs; canonical113 owns decisions/receipts."""

from typing import Any

from core.snapshots import snapshot_hash
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from inventory.selectors import current_location, current_lot
from inventory.transactions import require_inventory_lock
from inventory.transfers.commands import SourceAuthority, TransferAuthority
from inventory.transfers.custody import balance
from inventory.transfers.models import TransferEvent
from inventory.transfers.policy import json_facts
from inventory.transfers.scope import require_transfer_scope
from inventory.transfers.transitions import visible_transition
from reviews.contracts import ReviewAdapter
from reviews.exceptions import ReviewBlockedError
from reviews.inspection import ExistingEffect
from uploads.access import UploadActor

TRANSFER_REVIEW_CODES = frozenset(
    {
        "clock_skew",
        "final_upload_after_revoke",
        "causal_parent_pending",
        "transfer_state_conflict",
        "transfer_evidence_required",
        "transfer_safety_blocked",
    }
)


def source_authority(ctx: EventContext) -> TransferAuthority:
    actor = UploadActor(ctx.user, ctx.organization, ctx.device.pk)
    source = SourceAuthority(
        ctx.envelope.id,
        ctx.envelope.payload_info.sha256,
        ctx.envelope.device_time,
        ctx.server_received_at,
        ctx.user.pk,
        ctx,
    )
    return TransferAuthority(actor, source)


def authorize_source(ctx: EventContext, data: dict[str, Any]) -> Any:  # noqa: ANN401 -- concrete transfer model
    from django.http import Http404
    from rest_framework.exceptions import PermissionDenied

    try:
        authority = source_authority(ctx)
        transfer = visible_transition(
            authority, data["transfer_id"], ctx.envelope.type.split(".")[1]
        )
        require_transfer_scope(authority, "field_event.sync", transfer)
    except (Http404, PermissionDenied):
        raise EventRejected("transfer_inaccessible") from None
    return transfer


def capture_transfer_facts(ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
    transfer = authorize_source(ctx, data)
    pins = []
    for line in transfer.lines.select_related("lot", "unit_version").order_by("pk"):
        lot = current_lot(line.lot)
        pins.append(
            json_facts(
                {
                    "line_id": line.pk,
                    "lot_version_id": lot.pk,
                    "supply_version_id": lot.supply_version_id,
                    "protocol_id": lot.protocol_id,
                    "origin_version_id": current_location(transfer.origin).pk,
                    "destination_version_id": current_location(transfer.destination).pk,
                    "available_at_observation": balance(line, transfer.origin),
                }
            )
        )
    identity = [
        {
            key: value
            for key, value in pin.items()
            if key not in {"lot_version_id", "available_at_observation"}
        }
        for pin in pins
    ]
    return {
        "version": 1,
        "available": True,
        "transfer_id": str(transfer.pk),
        "prepared_hash": transfer.content_hash,
        "pins": pins,
        "identity_hash": snapshot_hash({"prepared_hash": transfer.content_hash, "pins": identity}),
        "observed_at": ctx.server_received_at.isoformat(),
    }


def require_original_facts(ctx: EventContext, data: dict[str, Any]) -> None:
    capability = ctx.review_authorization
    if capability is None:
        return
    original = capability.owner_facts.get("transfer", {})
    current = capture_transfer_facts(ctx, data)
    if (
        original.get("version") != 1
        or not original.get("available")
        or original.get("identity_hash") != current["identity_hash"]
    ):
        raise ReviewBlockedError(("capture_context_unavailable",))
    if (
        capability.source_id != ctx.envelope.id
        or capability.payload_sha256 != ctx.envelope.payload_info.sha256
    ):
        raise ReviewBlockedError(("source_identity_unavailable",))


class TransferReviewAdapter(ReviewAdapter):
    reviewable_codes = TRANSFER_REVIEW_CODES

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        require_inventory_lock(ctx.organization.pk)
        facts = capture_transfer_facts(ctx, data)
        require_original_facts(ctx, data)
        ctx.observed_facts["transfer"] = facts
        return {"transfer": facts}

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        require_inventory_lock(ctx.organization.pk)
        if "transfer" in ctx.observed_facts:
            return {"transfer": dict(ctx.observed_facts["transfer"])}
        return {"transfer": capture_transfer_facts(ctx, data)}

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        from reviews.inspection import validated_original_payload

        data = validated_original_payload(source)
        require_original_facts(ctx, data)
        event = TransferEvent.objects.filter(
            organization=source.organization, declared_source_uuid=source.pk
        ).first()
        if event is None:
            return ExistingEffect()
        from reviews.models import ReviewEffectReceipt

        if (
            source.status == "in_review"
            and not ReviewEffectReceipt.objects.filter(source_event=source).exists()
        ):
            return ExistingEffect("partial", blockers=("unexpected_materialization",))
        return ExistingEffect("complete_owned", materialization(event))

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from inventory.transfers.handlers import apply_source

        return materialization(apply_source(ctx, data).event)


def materialization(event: TransferEvent) -> dict[str, Any]:
    operation = getattr(event, "stock_operation", None)
    return {
        "transfer_id": str(event.transfer_id),
        "transfer_event_id": str(event.pk),
        "command_id": str(event.command_id),
        "operation_id": str(operation.pk) if operation else None,
        "manifest_hash": event.manifest_hash,
    }
