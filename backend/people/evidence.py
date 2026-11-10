"""Certification consumes the existing verified-unbound bytes and their exact parent."""

from typing import Any, cast
from uuid import UUID

from django.http import Http404

from people.exceptions import PeopleConflictError
from people.models import Certification
from people.permissions import TRAINING_MANAGE, PeopleContext, require_contexts
from people.selectors import certificate_context
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload, UploadVerification


def _certification(actor: UploadActor, identifier: UUID) -> Certification:
    target = Certification.objects.filter(organization=actor.organization, pk=identifier).first()
    if target is None:
        raise Http404
    require_contexts(actor, TRAINING_MANAGE, (certificate_context(target),))
    return cast(Certification, target)


def authorize_certification_download(actor: UploadActor, identifier: UUID) -> None:
    _certification(actor, identifier)


def authorize_certification_attachment(
    actor: UploadActor, identifier: UUID, upload: Upload
) -> dict[str, Any]:
    target = _certification(actor, identifier)
    require_contexts(actor, FIELD_UPLOAD, (certificate_context(target),))
    if (
        target.created_by_id != actor.user.pk
        or upload.uploader_id != actor.user.pk
        or upload.device_id != actor.device_id
        or str(upload.public_id) not in target.evidence_ids
    ):
        raise Http404
    return {"certification": target}


def verified_certification_evidence(
    actor: UploadActor, context: PeopleContext, identifiers: list[UUID]
) -> tuple[Upload, ...]:
    require_contexts(actor, FIELD_UPLOAD, (context,))
    requested = set(identifiers)
    if not requested or len(requested) != len(identifiers):
        raise PeopleConflictError("certification_evidence_required")
    uploads = tuple(
        Upload.objects.filter(
            organization=actor.organization,
            public_id__in=requested,
        )
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(uploads) != len(requested) or any(
        upload.uploader_id != actor.user.pk
        or upload.device_id != actor.device_id
        or not UploadVerification.objects.filter(upload=upload).exists()
        or AttachmentLink.objects.filter(upload=upload).exists()
        for upload in uploads
    ):
        raise PeopleConflictError("certification_evidence_required")
    return uploads


def bind_certification_evidence(target: Certification, uploads: tuple[Upload, ...]) -> None:
    for upload in uploads:
        AttachmentLink.objects.create(
            organization=target.organization,
            created_by=target.created_by,
            upload=upload,
            certification=target,
        )
