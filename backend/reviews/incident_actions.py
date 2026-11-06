"""A current reviewer report linked to, but never impersonating, an original source."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from django.http import Http404

from core.time import server_now
from incidents.models import Incident
from incidents.selectors import ResourceContext, latest_types, require_context
from reviews.exceptions import ReviewBlockedError, ReviewConflictError
from reviews.inspection import original_source_envelope
from reviews.models import ReviewDecision, ReviewIncidentLink, ReviewItem
from reviews.scope import subject_facts
from uploads.access import UploadActor, current_scope

if TYPE_CHECKING:
    from incidents.services import IncidentCapture


def _context(actor: UploadActor, item: ReviewItem) -> ResourceContext:
    try:
        facts = subject_facts(actor.organization, original_source_envelope(item.field_event))
    except ValueError:
        raise ReviewBlockedError(("incident_scope_unavailable",)) from None
    if not facts.resolved or len(facts.contexts) != 1 or facts.contexts[0]["center_id"] is None:
        raise ReviewBlockedError(("incident_scope_unavailable",))
    return ResourceContext(
        UUID(facts.contexts[0]["center_id"]),
        None
        if facts.contexts[0]["quadrant_id"] is None
        else UUID(facts.contexts[0]["quadrant_id"]),
        facts.resource_kind or None,
        facts.resource_id,
    )


def require_review_incident_scope(actor: UploadActor, item: ReviewItem) -> ResourceContext:
    context = _context(actor, item)
    require_context(current_scope(actor), "review_item.decide", context)
    require_context(current_scope(actor), "incident.create", context)
    return context


def validate_review_origin(capture: IncidentCapture) -> ReviewDecision:
    """Fresh persisted identity and exact current context, before any incident effects."""
    supplied = capture.review_decision
    if (
        supplied is None
        or capture.source_id is not None
        or capture.review_authorization is not None
    ):
        raise Http404
    actor = capture.actor
    decision = (
        ReviewDecision.objects.filter(
            pk=supplied.pk,
            organization=actor.organization,
            created_by=actor.user,
            kind="open_incident",
            is_terminal=False,
        )
        .select_related("review_item__field_event")
        .first()
    )
    if decision is None or decision.review_item.organization_id != actor.organization.pk:
        raise Http404
    if (
        decision.review_item.field_event.organization_id != actor.organization.pk
        or decision.evaluation.get("scope_resolved") is not True
        or decision.reason != capture.data.get("description")
        or decision.evidence_ids
        != sorted(str(value) for value in capture.data.get("evidence_ids", []))
    ):
        raise Http404
    configured = (
        latest_types(actor.organization).filter(code="review-followup", is_active=True).first()
    )
    if configured is None or str(capture.data.get("type_id")) != str(configured.pk):
        raise ReviewBlockedError(("incident_configuration_unavailable",))
    context = require_review_incident_scope(actor, decision.review_item)
    if context.resource_kind == "motorcycle":
        from shifts.models import Motorcycle

        if context.resource_id is None:
            raise Http404
        if (
            not Motorcycle.objects.filter(organization=actor.organization, pk=context.resource_id)
            .select_for_update(nowait=True)
            .exists()
        ):
            raise Http404
        context = require_review_incident_scope(actor, decision.review_item)
    if context != capture.context or context.marker is not None:
        raise Http404
    if ReviewIncidentLink.objects.filter(review_item=decision.review_item).exists():
        raise ReviewConflictError
    return decision


def install_review_origin(decision: ReviewDecision, incident: Incident) -> None:
    ReviewIncidentLink.objects.create(
        organization=decision.organization,
        created_by=decision.created_by,
        review_item=decision.review_item,
        decision=decision,
        incident=incident,
    )


def open_review_incident(  # noqa: PLR0913 -- actual actor, immutable decision and selected original evidence identities
    actor: UploadActor, item: ReviewItem, decision: ReviewDecision, evidence_ids: list[UUID]
) -> Incident:
    from incidents.services import IncidentCapture, create_incident

    context = require_review_incident_scope(actor, item)
    version = (
        latest_types(actor.organization).filter(code="review-followup", is_active=True).first()
    )
    if version is None:
        raise ReviewBlockedError(("incident_configuration_unavailable",))
    now = server_now()
    return create_incident(
        IncidentCapture(
            actor,
            {"type_id": version.pk, "description": decision.reason, "evidence_ids": evidence_ids},
            context,
            now,
            now,
            review_decision=decision,
        )
    )
