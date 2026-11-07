"""Lab rejection proof uses the one canonical private upload/parent pipeline."""

from typing import Any, cast
from uuid import UUID

from django.http import Http404

from lab.access import scoped_bags
from lab.exceptions import LabConflictError
from lab.models import LabRejection
from lab.permissions import COUNT_READ, COUNT_VOID, REJECTION_CREATE
from uploads.access import UploadActor, current_scope
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload, UploadVerification


def visible_rejection(actor: UploadActor, identifier: UUID) -> LabRejection:
    target = LabRejection.objects.filter(organization=actor.organization, pk=identifier).first()
    if target is None or not any(
        scoped_bags(actor, code).filter(pk=target.bag_id).exists()
        for code in (COUNT_READ, COUNT_VOID)
    ):
        raise Http404
    return cast(LabRejection, target)


def authorize_rejection_download(actor: UploadActor, identifier: UUID) -> None:
    """Void-only target readers receive no general lab list or other-parent authority."""
    visible_rejection(actor, identifier)


def authorize_rejection_attachment(
    actor: UploadActor, identifier: UUID, upload: Upload
) -> dict[str, Any]:
    target = LabRejection.objects.filter(organization=actor.organization, pk=identifier).first()
    if (
        target is None
        or target.created_by_id != actor.user.pk
        or upload.uploader_id != actor.user.pk
        or upload.device_id != actor.device_id
        or str(upload.public_id) not in target.evidence_ids
    ):
        raise Http404
    if not all(
        scoped_bags(actor, code).filter(pk=target.bag_id).exists()
        for code in (REJECTION_CREATE, FIELD_UPLOAD)
    ):
        raise Http404
    return {"lab_rejection": target}


def verified_rejection_evidence(actor: UploadActor, identifiers: list[UUID]) -> tuple[Upload, ...]:
    if not identifiers or not current_scope(actor).allows(FIELD_UPLOAD):
        raise LabConflictError("lab_evidence_required")
    requested = set(identifiers)
    rows = tuple(
        Upload.objects.filter(organization=actor.organization, public_id__in=requested)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(rows) != len(requested) or any(
        not _owned_verified_unbound(actor, upload) for upload in rows
    ):
        raise LabConflictError("lab_evidence_required")
    return rows


def _owned_verified_unbound(actor: UploadActor, upload: Upload) -> bool:
    return (
        upload.uploader_id == actor.user.pk
        and upload.device_id == actor.device_id
        and UploadVerification.objects.filter(upload=upload).exists()
        and not AttachmentLink.objects.filter(upload=upload).exists()
    )


def bind_rejection_evidence(target: LabRejection, uploads: tuple[Upload, ...]) -> None:
    for upload in uploads:
        AttachmentLink.objects.create(
            organization=target.organization,
            created_by=target.created_by,
            upload=upload,
            lab_rejection=target,
        )
