"""Evidence-only linkage after source verdict insertion inside the pipeline savepoint."""

import logging
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from field_sync.models import FieldEvent
from uploads.access import UploadActor, require_upload_permission
from uploads.models import AttachmentLink, Upload
from uploads.targets import AttachmentTarget, authorize_target, declared_upload_ids

logger = logging.getLogger(__name__)


def record_event_links(event: FieldEvent) -> None:
    """Retain declared references independently of operational handler writes or readiness.

    Missing metadata stays declared on the immutable source. Later authorize/finalize
    can bind that same UUID. This hook never accepts a review or calls storage.
    """
    if event.status == "rejected" or event.created_by is None:
        return
    identifiers = declared_upload_ids(event)
    if not identifiers:
        return
    actor = UploadActor(event.created_by, event.organization, event.device_id)
    try:
        require_upload_permission(actor)
    except PermissionDenied:
        return
    uploads = Upload.objects.filter(
        organization=event.organization,
        uploader_id=event.created_by_id,
        device_id=event.device_id,
        public_id__in=identifiers,
    ).order_by("pk")
    for upload in uploads:
        _link_declared(actor, upload, event.pk)


def _link_declared(actor: UploadActor, upload: Upload, event_id: UUID) -> bool:
    try:
        parent = authorize_target(actor, AttachmentTarget("field_event", event_id), upload)
    except (Http404, PermissionDenied):
        return False
    # Immutable OneToOne arbitration, without a new Upload lock below operational effects.
    # Unique/FK waits remain inside sync_batch's bounded whole-transaction retry mapping.
    link, _created = AttachmentLink.objects.get_or_create(
        upload=upload,
        defaults={"organization": actor.organization, "created_by": actor.user, **parent},
    )
    is_same_parent = (
        link.field_event_id == event_id
        and link.fault_id is None
        and link.incident_id is None
        and link.review_item_id is None
    )
    if not is_same_parent:
        logger.info(
            "Evidence binding retained: organization=%s user=%s device=%s event=%s upload=%s",
            actor.organization.pk,
            actor.user.pk,
            actor.device_id,
            event_id,
            upload.public_id,
        )
    return is_same_parent
