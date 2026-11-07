"""Two concrete schema1 custody families; global source gates and one writer remain intact."""

from typing import Any

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext, EventHandler, register
from inventory.exceptions import InventoryConflictError
from inventory.transfers.commands import (
    DispatchTransferCommand,
    ReceiveTransferCommand,
    TransferTransitionResult,
)
from inventory.transfers.policy import TransferPolicyError
from inventory.transfers.review import (
    TransferReviewAdapter,
    authorize_source,
    capture_transfer_facts,
    require_original_facts,
    source_authority,
)
from inventory.transfers.serializers import DispatchTransferPayload, ReceiveTransferPayload
from inventory.transfers.transitions import apply_transfer_locked

TRANSFER_CODES = (
    "transfer_inaccessible",
    "transfer_state_conflict",
    "transfer_evidence_required",
    "transfer_safety_blocked",
    "transfer_void_blocked",
)
SAFETY_REASONS = frozenset(
    {
        "supply_type_inactive",
        "lot_expired",
        "protocol_not_configured",
        "storage_safety_not_configured",
        "insecticide_free_required",
        "condition_slot_missing",
        "condition_breach",
        "transfer_discrepancy_hold",
        "transfer_storage_unavailable",
    }
)


def apply_source(ctx: EventContext, data: dict[str, Any]) -> TransferTransitionResult:
    authorize_source(ctx, data)
    facts = capture_transfer_facts(ctx, data)
    ctx.observed_facts["transfer"] = facts
    require_original_facts(ctx, data)
    if ctx.review_code is not None and ctx.review_authorization is None:
        raise EventNeedsReview(ctx.review_code)
    authority = source_authority(ctx)
    values = {key: value for key, value in data.items() if key != "transfer_id"}
    command_type = (
        DispatchTransferCommand
        if ctx.envelope.type == "transfer.dispatch"
        else ReceiveTransferCommand
    )
    command = command_type(authority.actor, data["transfer_id"], values, authority.source)
    try:
        return apply_transfer_locked(command, ctx.envelope.type.split(".")[1])
    except (Http404, PermissionDenied):
        raise EventRejected("transfer_inaccessible") from None
    except TransferPolicyError:
        raise EventNeedsReview("transfer_state_conflict") from None
    except InventoryConflictError as error:
        reason = error.blocked_by[0]["reason"]
        code = (
            "transfer_safety_blocked"
            if reason in SAFETY_REASONS
            else (
                "transfer_evidence_required"
                if reason == "transfer_evidence_required"
                else "transfer_state_conflict"
            )
        )
        raise EventNeedsReview(code, {"blocked_by": error.blocked_by}) from error


def apply_transfer_source(ctx: EventContext, data: dict[str, Any]) -> None:
    apply_source(ctx, data)


def register_transfer_handlers() -> None:
    from inventory.transfers.voids import on_void

    for event_type, serializer in (
        ("transfer.dispatch", DispatchTransferPayload),
        ("transfer.receive", ReceiveTransferPayload),
    ):
        register(
            EventHandler(
                event_type=event_type,
                schema_version=1,
                payload_serializer=serializer,
                apply=apply_transfer_source,
                on_void=on_void,
                codes=TRANSFER_CODES,
                checks_shift=False,
                review_adapter=TransferReviewAdapter(),
            )
        )
