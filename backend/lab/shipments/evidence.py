"""Notification and signature proof reuse the canonical verified private upload owner."""

from typing import cast
from uuid import UUID

from django.http import Http404

from lab.exceptions import LabConflictError
from lab.shipments.models import DeliveryReceipt, MaterialRequest, NotificationEvidence
from lab.shipments.selectors import request_rows
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload, UploadVerification


def authorize_request_download(actor: UploadActor, identifier: UUID) -> None:
    """Retained proof follows current request read scope, never its past verification."""
    if not request_rows(actor, "material_request.read").filter(pk=identifier).exists():
        raise Http404


def authorize_request_attachment(
    actor: UploadActor, identifier: UUID, upload: Upload
) -> dict[str, object]:
    if upload.uploader_id != actor.user.pk or upload.device_id != actor.device_id:
        raise Http404
    permission = declared_request_permission(actor, identifier, upload)
    target = request_rows(actor, permission).filter(pk=identifier).first()
    if (
        target is None
        or not request_rows(actor, FIELD_UPLOAD).filter(pk=identifier).exists()
        or not UploadVerification.objects.filter(
            organization=actor.organization, upload=upload
        ).exists()
    ):
        raise Http404
    return {"material_request": target}


def declared_request_permission(actor: UploadActor, identifier: UUID, upload: Upload) -> str:
    """Only an authentic retained notification/delivery declares this exact upload."""
    if NotificationEvidence.objects.filter(
        organization=actor.organization,
        request_id=identifier,
        upload=upload,
        created_by=actor.user,
    ).exists():
        return "material_request.notify"
    if DeliveryReceipt.objects.filter(
        organization=actor.organization,
        request_id=identifier,
        signature=upload,
        created_by=actor.user,
    ).exists():
        return "material_request.deliver"
    raise Http404


def verified_request_evidence(
    actor: UploadActor, target: MaterialRequest, identifiers: list[UUID]
) -> tuple[Upload, ...]:
    """Take sorted Upload locks after the owning request/Organization transaction."""
    requested = set(identifiers)
    if (
        not requested
        or len(requested) != len(identifiers)
        or not request_rows(actor, FIELD_UPLOAD).filter(pk=target.pk).exists()
    ):
        raise LabConflictError("material_evidence_required")
    rows = tuple(
        Upload.objects.filter(organization=actor.organization, public_id__in=requested)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(rows) != len(requested) or any(not owned_verified_unbound(actor, row) for row in rows):
        raise LabConflictError("material_evidence_required")
    return cast(tuple[Upload, ...], rows)


def owned_verified_unbound(actor: UploadActor, upload: Upload) -> bool:
    return (
        upload.uploader_id == actor.user.pk
        and upload.device_id == actor.device_id
        and UploadVerification.objects.filter(
            organization=actor.organization, upload=upload
        ).exists()
        and not AttachmentLink.objects.filter(upload=upload).exists()
    )


def bind_request_evidence(target: MaterialRequest, uploads: tuple[Upload, ...]) -> None:
    """Append exactly one actual request parent in the same command transaction."""
    for upload in uploads:
        AttachmentLink.objects.create(
            organization=target.organization,
            created_by=upload.uploader,
            upload=upload,
            material_request=target,
        )
