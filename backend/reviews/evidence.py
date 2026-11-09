"""Supplemental review evidence retains its own immutable audit parent."""

from uuid import UUID

from django.http import Http404

from reviews.exceptions import ReviewBlockedError
from reviews.inspection import original_source_envelope
from reviews.models import ReviewItem
from reviews.scope import subject_allows, subject_facts
from uploads.access import UploadActor, current_scope
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload, UploadVerification


def bind_review_evidence(
    actor: UploadActor, item: ReviewItem, identifiers: list[UUID]
) -> list[str]:
    if not identifiers:
        return []
    try:
        facts = subject_facts(actor.organization, original_source_envelope(item.field_event))
    except ValueError:
        raise ReviewBlockedError(("source_scope_unavailable",)) from None
    requested = set(identifiers)
    uploads = Upload.objects.filter(
        organization=actor.organization,
        public_id__in=requested,
    )
    rows = list(uploads.order_by("pk").select_for_update(nowait=True, no_key=True))
    if len(rows) != len(requested):
        raise ReviewBlockedError(("review_evidence_not_ready",))
    for upload in rows:
        if not UploadVerification.objects.filter(upload=upload).exists():
            raise ReviewBlockedError(("review_evidence_not_ready",))
        link = AttachmentLink.objects.filter(upload=upload).first()
        if (
            link is not None
            and link.review_item_id != item.pk
            and not exact_source_evidence(link, item)
        ):
            raise ReviewBlockedError(("review_evidence_already_bound",))
        if link is not None:
            from uploads.targets import authorize_download

            authorize_download(actor, link)
        if link is None:
            if (
                upload.uploader_id != actor.user.pk
                or upload.device_id != actor.device_id
                or not subject_allows(current_scope(actor), FIELD_UPLOAD, facts)
            ):
                raise Http404
            AttachmentLink.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                upload=upload,
                review_item=item,
            )
    return sorted(str(identifier) for identifier in requested)


def exact_source_evidence(link: AttachmentLink, item: ReviewItem) -> bool:
    from uploads.targets import declared_upload_ids

    source, upload = item.field_event, link.upload
    if link.field_event_id != source.pk:
        return False
    return (
        upload.public_id in declared_upload_ids(source)
        and upload.organization_id == source.organization_id
        and upload.uploader_id == source.created_by_id
        and upload.device_id == source.device_id
    )
