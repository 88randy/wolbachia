"""No operational effects for review; only committed source audit producers run later."""

from typing import Any

from django.http import Http404

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.registry import EventContext
from incidents.exceptions import IncidentConflictError
from incidents.models import IncidentOrigin
from incidents.permissions import INCIDENT_CREATE
from incidents.selectors import ResourceContext, latest_types, require_context, resource_context
from incidents.services import IncidentCapture, capture_version, create_incident
from organizations.models import Organization
from ovitraps.codes import EVIDENCE_REQUIRED
from uploads.access import UploadActor, current_scope
from uploads.gates import require_event_evidence

INCIDENT_CONFIGURATION_UNAVAILABLE = "incident_configuration_unavailable"
INCIDENT_SCOPE_UNAVAILABLE = "incident_scope_unavailable"
INCIDENT_INACCESSIBLE = "incident_inaccessible"
INCIDENT_EVIDENCE_REQUIRED = "incident_evidence_required"
CODES = (
    INCIDENT_CONFIGURATION_UNAVAILABLE,
    INCIDENT_SCOPE_UNAVAILABLE,
    INCIDENT_INACCESSIBLE,
    INCIDENT_EVIDENCE_REQUIRED,
)


def apply_incident(ctx: EventContext, data: dict[str, Any]) -> None:
    if ctx.review_code:
        raise EventNeedsReview(ctx.review_code)
    actor = UploadActor(ctx.user, ctx.organization, ctx.device.pk)
    context = _source_context(ctx, data)
    scope = current_scope(actor)
    try:
        require_context(scope, FIELD_EVENT_SYNC, context)
        require_context(scope, INCIDENT_CREATE, context)
    except Http404:
        raise EventRejected(INCIDENT_INACCESSIBLE) from None
    if context.marker:
        original = FieldEvent.objects.select_for_update(nowait=True, no_key=True).get(
            organization=ctx.organization, pk=context.marker.event_id
        )
        if original.voided_at is not None:
            raise EventRejected(INCIDENT_INACCESSIBLE)
    Organization.objects.select_for_update(nowait=True, no_key=True).get(pk=ctx.organization.pk)
    if ctx.envelope.type == "emergency.accident":
        version = (
            latest_types(ctx.organization)
            .filter(code="emergency-accident", is_active=True, severity="critical")
            .first()
        )
        if version is None:
            raise EventNeedsReview(INCIDENT_CONFIGURATION_UNAVAILABLE)
        data = {**data, "type_id": version.pk}
    capture = IncidentCapture(
        actor, data, context, ctx.envelope.device_time, ctx.server_received_at, ctx.envelope.id
    )
    try:
        version = capture_version(capture)
        from incidents.configuration import chain

        chain(version, context)
    except Http404:
        raise EventRejected(INCIDENT_INACCESSIBLE) from None
    except IncidentConflictError:
        raise EventNeedsReview(INCIDENT_CONFIGURATION_UNAVAILABLE) from None
    _require_source_evidence(ctx, data, version.report_evidence_min)
    if context.marker and IncidentOrigin.objects.filter(marker=context.marker).exists():
        raise EventRejected(INCIDENT_INACCESSIBLE)
    create_incident(capture)


def _require_source_evidence(ctx: EventContext, data: dict[str, Any], minimum: int) -> None:
    if len(set(data.get("evidence_ids", []))) < minimum:
        raise EventNeedsReview(INCIDENT_EVIDENCE_REQUIRED)
    if minimum:
        try:
            require_event_evidence(ctx, [str(identifier) for identifier in data["evidence_ids"]])
        except EventNeedsReview as error:
            if error.code == EVIDENCE_REQUIRED:
                raise EventNeedsReview(INCIDENT_EVIDENCE_REQUIRED) from error
            raise


def _source_context(ctx: EventContext, data: dict[str, Any]) -> ResourceContext:
    try:
        return resource_context(ctx.organization, data, ctx.envelope.shift_id)
    except Http404:
        # Supplied foreign references must not be disguised as ambiguous local captures.
        if data.get("scope") or data.get("resource_ref"):
            raise EventRejected(INCIDENT_INACCESSIBLE) from None
        raise EventNeedsReview(INCIDENT_SCOPE_UNAVAILABLE) from None
