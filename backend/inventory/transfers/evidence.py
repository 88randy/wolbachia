"""Verified database facts only; byte/storage operations never occur under custody locks."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from inventory.exceptions import InventoryConflictError
from inventory.transfers.commands import TransferAuthority
from inventory.transfers.models import Transfer, TransferEvent, TransferEvidenceReference
from inventory.transfers.scope import require_transfer_scope
from uploads.models import AttachmentLink, Upload, UploadVerification


@dataclass(frozen=True)
class EvidenceRequest:
    signature_ids: tuple[UUID, ...]
    photo_ids: tuple[UUID, ...] = ()
    coverage: dict[str, list[str]] | None = None
    requires_signature: bool = True


@dataclass(frozen=True)
class VerifiedEvidence:
    upload: Upload
    role: str
    sha256: str
    coverage: tuple[str, ...]


def verify_evidence(
    authority: TransferAuthority, transfer: Transfer, request: EvidenceRequest
) -> tuple[VerifiedEvidence, ...]:
    if (request.requires_signature and not request.signature_ids) or set(
        request.signature_ids
    ) & set(request.photo_ids):
        raise InventoryConflictError("transfer_evidence_required")
    if not request.signature_ids and not request.photo_ids:
        return ()
    context = None if authority.source is None else authority.source.review_context
    if context is None or context.review_authorization is None:
        require_transfer_scope(authority, "field.upload", transfer)
    identifiers = set(request.signature_ids) | set(request.photo_ids)
    rows = list(
        Upload.objects.filter(organization=transfer.organization, public_id__in=identifiers)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(rows) != len(identifiers):
        raise InventoryConflictError("transfer_evidence_required")
    return tuple(_verified(authority, row, request) for row in rows)


def _verified(
    authority: TransferAuthority, upload: Upload, request: EvidenceRequest
) -> VerifiedEvidence:
    source = authority.source
    actor_id = authority.actor.user.pk if source is None else source.original_actor_id
    if upload.uploader_id != actor_id or upload.device_id != authority.actor.device_id:
        raise InventoryConflictError("transfer_evidence_required")
    verification = UploadVerification.objects.filter(upload=upload).first()
    link = AttachmentLink.objects.filter(upload=upload).first()
    if verification is None or (
        link is not None and (source is None or link.field_event_id != source.event_id)
    ):
        raise InventoryConflictError("transfer_evidence_required")
    role = "signature" if upload.public_id in request.signature_ids else "photo"
    coverage = (
        () if request.coverage is None else tuple(request.coverage.get(str(upload.public_id), []))
    )
    return VerifiedEvidence(upload, role, verification.sha256, coverage)


def bind_evidence(event: TransferEvent, evidence: tuple[VerifiedEvidence, ...]) -> None:
    for proof in evidence:
        if event.declared_source_uuid is None:
            link, _ = AttachmentLink.objects.get_or_create(
                upload=proof.upload,
                defaults={
                    "organization": event.organization,
                    "created_by": event.created_by,
                    "transfer_event": event,
                },
            )
            if link.transfer_event_id != event.pk:
                raise InventoryConflictError("transfer_evidence_required")
        TransferEvidenceReference.objects.create(
            organization=event.organization,
            created_by=event.created_by,
            event=event,
            upload=proof.upload,
            role=proof.role,
            coverage=list(proof.coverage),
        )


def evidence_manifest(evidence: tuple[VerifiedEvidence, ...]) -> list[dict[str, Any]]:
    return [
        {
            "upload_id": str(proof.upload.public_id),
            "role": proof.role,
            "sha256": proof.sha256,
            "coverage": list(proof.coverage),
        }
        for proof in evidence
    ]
