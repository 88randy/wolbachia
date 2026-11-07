"""Real-source linkage and the ONE canonical typed history owner, never HTTP fake couriers."""

from typing import Any, cast
from uuid import UUID

from field_sync.models import FieldEvent
from inventory.transfers.models import TransferEvent, TransferSourceLink
from inventory.transfers.scope import transfer_contexts
from reviews.effect_receipts import is_effective
from reviews.history import publish_history


def link_source(source: FieldEvent) -> TransferEvent | None:
    event = (
        TransferEvent.objects.filter(
            organization=source.organization,
            declared_source_uuid=source.pk,
            source_payload_hash=source.payload_sha256,
        )
        .select_related("transfer__origin", "transfer__destination")
        .first()
    )
    if event is None:
        return None
    from uploads.models import AttachmentLink

    for reference in event.evidence_refs.all():
        if not AttachmentLink.objects.filter(
            organization=source.organization, upload=reference.upload, field_event=source
        ).exists():
            raise RuntimeError("Transfer evidence must retain its exact real source parent.")
    link, _ = TransferSourceLink.objects.get_or_create(
        event=event,
        defaults={
            "organization": source.organization,
            "created_by": source.created_by,
            "source_event": source,
        },
    )
    if link.source_event_id != source.pk:
        raise RuntimeError("Transfer source identity conflicts with its immutable link.")
    return cast(TransferEvent, event)


def stored_source(source: FieldEvent, *, cause: Any = None) -> None:  # noqa: ANN401 -- actual immutable publication cause
    if not is_effective(source):
        return
    if source.type in {"transfer.dispatch", "transfer.receive"}:
        event = link_source(source)
    elif source.type == "record.void":
        from reviews.inspection import original_source_envelope

        try:
            target_id = original_source_envelope(source).voids_event_id
        except ValueError:
            return
        event = (
            TransferEvent.objects.filter(
                organization=source.organization,
                source_link__source_event_id=target_id,
                source_link__source_event__created_by_id=source.created_by_id,
            )
            .select_related("transfer__origin", "transfer__destination")
            .first()
        )
    else:
        return
    if event is not None:
        _publish(event, source if cause is None else cause)


def _publish(event: TransferEvent, cause: Any) -> None:  # noqa: ANN401 -- actual source/decision cause accepted by existing owner
    source = event.source_link.source_event
    courier = source.created_by
    if courier is None:
        return
    contexts = transfer_contexts(event.transfer)
    # This authentic author was prelocked by ingest/review/void. Persist even
    # during download revocation so regrant cannot resurrect a pre-void payload.
    # The one owner's current complete-vector read filter controls delivery.
    payload = {
        "id": str(event.pk),
        "kind": "transfer_custody",
        "transfer_id": str(event.transfer_id),
        "transfer_code": event.transfer.code,
        "phase": event.kind,
        "revision": event.revision,
        "manifest_hash": event.manifest_hash,
        "source_event_id": str(source.pk),
        "source_status": source.status,
        "source_code": source.status_code,
        "voided_at": source.voided_at.isoformat() if source.voided_at else None,
        "subjects": list(contexts),
    }
    publish_history("transfer_custody", cause, courier, payload)


def history_subjects(organization_id: UUID, courier_id: UUID, event_id: UUID) -> Any:  # noqa: ANN401 -- shared SubjectFacts
    from reviews.scope import SubjectFacts

    event = (
        TransferEvent.objects.filter(
            organization_id=organization_id,
            pk=event_id,
            source_link__source_event__created_by_id=courier_id,
        )
        .select_related("transfer__origin", "transfer__destination")
        .first()
    )
    return (
        SubjectFacts()
        if event is None
        else SubjectFacts(True, transfer_contexts(event.transfer), "transfer", event.transfer_id)
    )
