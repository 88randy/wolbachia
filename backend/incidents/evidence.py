"""Consume existing verified #102 facts under sorted Upload NO KEY UPDATE locks."""

from uuid import UUID

from incidents.exceptions import IncidentConflictError
from incidents.models import Incident
from uploads.access import UploadActor, current_scope
from uploads.models import AttachmentLink, Upload, UploadVerification


def bind_evidence(  # noqa: PLR0913 -- current actor, exact parent, declared identities and frozen minimum
    actor: UploadActor, incident: Incident, identifiers: list[UUID], minimum: int
) -> list[str]:
    requested = set(identifiers)
    if len(requested) < minimum:
        raise IncidentConflictError("incident_evidence_not_ready")
    uploads = list(
        Upload.objects.filter(organization=actor.organization, public_id__in=requested)
        .select_for_update(nowait=True, no_key=True)
        .order_by("pk")
    )
    if len(uploads) != len(requested):
        raise IncidentConflictError("incident_evidence_not_ready")
    scope = current_scope(actor)
    for upload in uploads:
        link = AttachmentLink.objects.filter(upload=upload).first()
        same_case = link is not None and (
            link.incident_id == incident.pk
            or (
                incident.source_event_id is not None
                and link.field_event_id == incident.source_event_id
            )
        )
        own_unbound = (
            link is None
            and upload.uploader_id == actor.user.pk
            and upload.device_id == actor.device_id
        )
        if (
            not (same_case or own_unbound)
            or not UploadVerification.objects.filter(upload=upload).exists()
        ):
            raise IncidentConflictError("incident_evidence_not_ready")
        if not scope.allows(
            "field.upload",
            str(incident.center_id),
            str(incident.quadrant_id) if incident.quadrant_id else None,
        ):
            raise IncidentConflictError("incident_evidence_not_ready")
        if link is None:
            AttachmentLink.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                upload=upload,
                incident=incident,
            )
    return sorted(str(identifier) for identifier in requested)
