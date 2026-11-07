"""Exact dispatch FE dependencies beneath a real authorized Transfer, never a fake parent."""

from typing import Any, cast
from uuid import UUID

from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from organizations.models import Organization
from reviews.contracts import HandlerPreparation
from reviews.dependencies import BatchCandidates
from reviews.effect_receipts import is_effective
from reviews.models import ReviewDependency


def _transfer_id(values: dict[str, Any]) -> UUID | None:
    try:
        return UUID(str(values["transfer_id"]))
    except (KeyError, ValueError, TypeError):
        return None


def source_references(organization: Organization, values: dict[str, Any]) -> set[UUID]:
    from inventory.transfers.models import TransferSourceLink

    transfer_id = _transfer_id(values)
    if transfer_id is None:
        return set()
    identifiers = set(
        TransferSourceLink.objects.filter(
            organization=organization, event__transfer_id=transfer_id, event__kind="dispatch"
        ).values_list("source_event_id", flat=True)
    )
    try:
        declared = UUID(str(values["dispatch_source_event_id"]))
    except (KeyError, ValueError, TypeError):
        return identifiers
    parent = FieldEvent.objects.filter(
        organization=organization, pk=declared, type="transfer.dispatch"
    ).first()
    if parent is not None and _transfer_id(parent.payload) == transfer_id:
        identifiers.add(parent.pk)
    return identifiers


def dependency_parent(source: FieldEvent, dependency: ReviewDependency) -> FieldEvent | None:
    parent = FieldEvent.objects.filter(
        organization=source.organization, pk=dependency.declared_id, type="transfer.dispatch"
    ).first()
    if parent is None or _transfer_id(parent.payload) != _transfer_id(source.payload):
        return None
    return cast(FieldEvent, parent)


def resolution_references(actor: Any, discrepancy: Any, values: dict[str, Any]) -> set[UUID]:  # noqa: ANN401 -- authenticated actor and exact visible discrepancy
    from inventory.transfers.models import TransferSourceLink
    from inventory.transfers.scope import visible_transfers

    identifiers = {discrepancy.transfer_id}
    requested = [
        row["correction_transfer_id"]
        for row in values["resolution"]["outcomes"]
        if row["kind"] == "reference_signed_correction"
    ]
    identifiers.update(
        visible_transfers(actor, "transfer.read")
        .filter(pk__in=requested)
        .values_list("pk", flat=True)
    )
    return set(
        TransferSourceLink.objects.filter(
            organization=actor.organization, event__transfer_id__in=identifiers
        ).values_list("source_event_id", flat=True)
    )


def classify_transfer_dependency(
    batch: BatchContext, envelope: EventEnvelope, candidates: BatchCandidates
) -> HandlerPreparation:
    from inventory.transfers.review import authorize_source

    ctx = EventContext(batch.organization, batch.user, batch.device, envelope, batch.received_at)
    authorize_source(ctx, envelope.payload)
    raw = envelope.payload.get("dispatch_source_event_id")
    if envelope.type != "transfer.receive" or raw is None:
        return HandlerPreparation()
    identifier = UUID(str(raw))
    parent = FieldEvent.objects.filter(organization=batch.organization, pk=identifier).first()
    if parent is not None:
        if parent.type != "transfer.dispatch" or _transfer_id(parent.payload) != _transfer_id(
            envelope.payload
        ):
            raise EventRejected("transfer_inaccessible")
        if is_effective(parent):
            return HandlerPreparation()
    candidate = candidates.captures.get(identifier)
    if candidate is not None and (
        candidate.type != "transfer.dispatch"
        or _transfer_id(candidate.payload) != _transfer_id(envelope.payload)
    ):
        raise EventRejected("transfer_inaccessible")
    return HandlerPreparation(
        dependencies=(
            {
                "kind": "transfer_source",
                "declared_id": identifier,
                "candidate_source_id": identifier
                if parent is not None or candidate is not None
                else None,
                "candidate_envelope": candidates.envelopes.get(identifier, {}),
            },
        ),
        pending_code="causal_parent_pending",
    )
