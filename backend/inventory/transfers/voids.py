"""Source correction preserves every leg/signature; only proven prior compensation permits it."""

from decimal import Decimal
from uuid import UUID

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from core.void_reason import validate_void_reason
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from field_sync.services import rejection_params
from inventory.transactions import require_inventory_lock
from inventory.transfers.models import ResolutionOutcome, Transfer, TransferEvent, TransferVoidAudit
from inventory.transfers.review import source_authority
from inventory.transfers.scope import require_transfer_scope
from reviews.inspection import ExistingEffect, validated_original_payload


def on_void(ctx: EventContext, target: FieldEvent) -> None:
    require_inventory_lock(ctx.organization.pk)
    transfer = (
        Transfer.objects.filter(organization=ctx.organization, pk=target.payload.get("transfer_id"))
        .select_related("origin", "destination")
        .first()
    )
    if transfer is None:
        raise EventRejected("transfer_inaccessible")
    authority = source_authority(ctx)
    require_transfer_scope(authority, target.type, transfer)
    require_transfer_scope(authority, "field_event.sync", transfer)
    try:
        reason = validate_void_reason(target.void_reason, field="reason")
    except ValidationError as error:
        raise EventRejected("invalid_payload", rejection_params(error)) from error
    event = TransferEvent.objects.filter(
        organization=ctx.organization, declared_source_uuid=target.pk
    ).first()
    if event is None:
        return  # A real unapplied source has no operational rows or hold to erase.
    compensations = _prior_compensation(transfer)
    TransferVoidAudit.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        target_event=event,
        void_source_uuid=ctx.envelope.id,
        void_payload_hash=ctx.envelope.payload_info.sha256,
        reason=reason,
        reason_code=target.void_reason_code,
        compensation_event_ids=compensations,
    )


def _prior_compensation(transfer: Transfer) -> list[str]:
    if transfer.discrepancies.filter(resolution__isnull=True).exists():
        raise EventRejected("transfer_void_blocked")
    totals = transfer.stock_effects.values(
        "movement__lot_id",
        "movement__location_id",
        "movement__piece_id",
        "movement__unit_version_id",
    ).annotate(total=Sum("movement__quantity"))
    if any(row["total"] != Decimal(0) for row in totals):
        raise EventRejected("transfer_void_blocked")
    returns = ResolutionOutcome.objects.filter(
        resolution__discrepancy__transfer=transfer, kind="return_origin"
    ).select_related("resolution")
    events = sorted({str(row.resolution.event_id) for row in returns})
    if not events:
        raise EventRejected("transfer_void_blocked")
    return events


def void_materialization(identifier: UUID, target: FieldEvent) -> dict[str, object]:
    audit = TransferVoidAudit.objects.filter(
        organization=target.organization,
        void_source_uuid=identifier,
        target_event__declared_source_uuid=target.pk,
    ).first()
    return {
        "target_event_id": str(target.pk),
        "voided_at": None if target.voided_at is None else target.voided_at.isoformat(),
        "transfer_void_audit_id": None if audit is None else str(audit.pk),
    }


def inspect_void(source: FieldEvent, target: FieldEvent) -> ExistingEffect:
    unmaterialized = _unmaterialized_void_receipt(source, target)
    if unmaterialized is not None:
        return unmaterialized
    data = validated_original_payload(source)
    audit = TransferVoidAudit.objects.filter(
        organization=source.organization,
        void_source_uuid=source.pk,
        void_payload_hash=source.payload_sha256,
        target_event__declared_source_uuid=target.pk,
        created_by=source.created_by,
    ).first()
    if (
        audit is not None
        and target.voided_by_id == source.created_by_id
        and (
            audit.reason == target.void_reason
            and audit.reason_code == target.void_reason_code == data["reason_code"]
            and (not data.get("reason") or data["reason"] == audit.reason)
        )
    ):
        return ExistingEffect("complete_owned", void_materialization(source.pk, target))
    return ExistingEffect("partial", blockers=("already_voided",))


def _unmaterialized_void_receipt(source: FieldEvent, target: FieldEvent) -> ExistingEffect | None:
    from reviews.models import ReviewEffectReceipt

    if (
        target.voided_by_id != source.created_by_id
        or TransferEvent.objects.filter(
            organization=target.organization, declared_source_uuid=target.pk
        ).exists()
    ):
        return None
    receipt = ReviewEffectReceipt.objects.filter(
        organization=source.organization, source_event=source, payload_sha256=source.payload_sha256
    ).first()
    materialization = void_materialization(source.pk, target)
    if receipt is not None and receipt.materialization == materialization:
        return ExistingEffect("complete_owned", materialization)
    return None
