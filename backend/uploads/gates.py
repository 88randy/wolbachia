"""Actual consumer gates: database facts only, sorted Upload locks below existing domain locks."""

from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from field_sync.exceptions import EventNeedsReview
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from fleet.exceptions import FleetConflictError
from ovitraps.codes import EVIDENCE_REQUIRED
from shifts.models import MotorcycleBlockEvent
from uploads.access import UploadActor, require_upload_permission
from uploads.limits import PDF_CONTENT_TYPE
from uploads.models import AttachmentLink, Upload, UploadVerification
from uploads.targets import has_event_upload_scope


def _identifiers(references: list[str]) -> set[UUID]:
    try:
        return {UUID(str(reference)) for reference in references}
    except (ValueError, TypeError, AttributeError):
        return set()


def require_event_evidence(ctx: EventContext, references: list[str]) -> None:
    """New required evidence cannot be satisfied by pending, foreign or differently bound files."""
    if ctx.review_code is not None and not ctx.acknowledges(ctx.review_code):
        raise EventNeedsReview(ctx.review_code)
    identifiers = _identifiers(references)
    event = FieldEvent(
        pk=ctx.envelope.id,
        organization=ctx.organization,
        created_by=ctx.user,
        device=ctx.device,
        type=ctx.envelope.type,
        shift_id=ctx.envelope.shift_id,
        payload=ctx.envelope.payload,
    )
    actor = UploadActor(ctx.user, ctx.organization, ctx.device.pk)
    try:
        scope = (
            ctx.review_authorization.historical_scope
            if ctx.review_authorization is not None
            else require_upload_permission(actor)
        )
        allowed = has_event_upload_scope(scope, event)
    except (Http404, PermissionDenied):
        allowed = False
    if not identifiers or not allowed:
        raise EventNeedsReview(EVIDENCE_REQUIRED)
    uploads = list(
        Upload.objects.filter(
            organization=ctx.organization,
            uploader=ctx.user,
            device=ctx.device,
            public_id__in=identifiers,
        )
        .select_for_update(nowait=True, no_key=True)
        .order_by("pk")
    )
    if len(uploads) != len(identifiers) or any(
        not _ready_for_event(upload, event.pk) for upload in uploads
    ):
        raise EventNeedsReview(EVIDENCE_REQUIRED)


def _ready_for_event(upload: Upload, event_id: UUID) -> bool:
    if upload.content_type == PDF_CONTENT_TYPE:
        return False
    if not UploadVerification.objects.filter(upload=upload).exists():
        return False
    link = AttachmentLink.objects.filter(upload=upload).first()
    return link is None or link.field_event_id == event_id


def require_fault_evidence(fault: MotorcycleBlockEvent, identifiers: list[UUID]) -> None:
    """Caller already owns Motorcycle and rechecked service_clear. No account/Org/event locks."""
    requested = set(identifiers)
    uploads = list(
        Upload.objects.filter(
            organization=fault.organization,
            public_id__in=requested,
        )
        .select_for_update(nowait=True, no_key=True)
        .order_by("pk")
    )
    if len(uploads) != len(requested) or any(
        not _ready_for_fault(upload, fault.pk) for upload in uploads
    ):
        raise FleetConflictError("motorcycle_evidence_not_ready")


def _ready_for_fault(upload: Upload, fault_id: UUID) -> bool:
    return (
        UploadVerification.objects.filter(upload=upload).exists()
        and AttachmentLink.objects.filter(upload=upload, fault_id=fault_id).exists()
    )
