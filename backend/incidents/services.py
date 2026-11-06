"""Append-only incident transitions; scope before lock, bounded atomic arbitration."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

from django.db.models import Max
from django.http import Http404

from core.time import server_now
from core.void_reason import validate_void_reason
from incidents.configuration import chain, eligible_owner
from incidents.evidence import bind_evidence
from incidents.exceptions import IncidentConfigurationUnavailableError, IncidentConflictError
from incidents.models import (
    EscalationReceipt,
    Incident,
    IncidentBlocker,
    IncidentEvent,
    IncidentOrigin,
    IncidentTypeVersion,
)
from incidents.permissions import INCIDENT_CLOSE, INCIDENT_CREATE, INCIDENT_REASSIGN
from incidents.policy import next_stage, reminder_due
from incidents.selectors import (
    ResourceContext,
    current_event,
    latest_types,
    require_context,
    resource_context,
)
from incidents.transactions import incident_transaction
from uploads.access import UploadActor, current_scope

if TYPE_CHECKING:
    from reviews.contracts import ReviewAuthorization
    from reviews.models import ReviewDecision


@dataclass(frozen=True)
class IncidentCapture:
    actor: UploadActor
    data: dict[str, Any]
    context: ResourceContext
    device_time: datetime
    received_at: datetime
    source_id: UUID | None = None
    review_authorization: ReviewAuthorization | None = None
    review_decision: ReviewDecision | None = None


def capture_version(capture: IncidentCapture) -> IncidentTypeVersion:
    version = (
        IncidentTypeVersion.objects.select_related("organization", "item")
        .filter(organization=capture.actor.organization, pk=capture.data["type_id"])
        .first()
    )
    if version is None:
        raise Http404
    current = latest_types(capture.actor.organization).filter(item=version.item).first()
    if (
        not version.is_active
        or not version.item.is_active
        or current is None
        or not current.is_active
    ):
        raise IncidentConfigurationUnavailableError
    if version.is_other and not capture.data["description"].strip():
        raise IncidentConflictError("other_requires_text")
    return cast(IncidentTypeVersion, version)


def _deadline(version: IncidentTypeVersion, stage: int, now: datetime) -> datetime | None:
    if stage == 2:
        return None
    return now + timedelta(
        seconds=version.supervisor_sla_seconds if stage == 0 else version.coordinator_sla_seconds
    )


def append_event(
    incident: Incident, values: dict[str, Any], actor: UploadActor | None
) -> IncidentEvent:
    from incidents.notices import enqueue_notice

    event = IncidentEvent.objects.create(
        organization=incident.organization,
        created_by=actor.user if actor else None,
        actor_kind="human" if actor else "system",
        incident=incident,
        **values,
    )
    enqueue_notice("incident_event", event.pk)
    return event


def create_incident(capture: IncidentCapture) -> Incident:
    """Caller owns Organization; sync keeps source FK deferred until its immutable store."""
    actor, context = capture.actor, capture.context
    origin = None
    if capture.review_decision is not None:
        from reviews.incident_actions import validate_review_origin

        origin = validate_review_origin(capture)
        now = server_now()
        capture = replace(capture, device_time=now, received_at=now)
    _require_capture_authority(capture)
    version = capture_version(capture)
    owners = chain(version, context)
    stage = next_stage(-1, tuple(owner is not None for owner in owners))
    highest = (
        Incident.objects.filter(organization=actor.organization).aggregate(highest=Max("sequence"))[
            "highest"
        ]
        or 0
    )
    incident = Incident.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        sequence=highest + 1,
        code=f"I-{highest + 1:06d}",
        type_version=version,
        center_id=context.center_id,
        quadrant_id=context.quadrant_id,
        source_event_id=capture.source_id,
        device_time=capture.device_time,
        server_received_at=capture.received_at,
        description=capture.data["description"].strip(),
    )
    if origin is not None:
        from reviews.incident_actions import install_review_origin

        install_review_origin(origin, incident)
    if capture.source_id:
        # Required source evidence was locked/verified BEFORE effects by the handler.
        evidence = sorted(str(value) for value in capture.data.get("evidence_ids", []))
    else:
        evidence = bind_evidence(
            actor, incident, capture.data.get("evidence_ids", []), version.report_evidence_min
        )
    if context.marker:
        if context.marker.event.voided_at is not None:
            raise IncidentConflictError("source_voided")
        if IncidentOrigin.objects.filter(marker=context.marker).exists():
            raise IncidentConflictError("marker_already_adopted")
        IncidentOrigin.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            incident=incident,
            marker=context.marker,
        )
    if context.resource_id:
        for kind in version.blocker_kinds:
            IncidentBlocker.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                incident=incident,
                resource_kind=context.resource_kind or "",
                resource_id=context.resource_id,
                kind=kind,
            )
    append_event(
        incident,
        {
            "revision": 1,
            "action": "report",
            "state": "open",
            "owner": owners[stage],
            "stage": stage,
            "severity": version.severity,
            "stage_entered_at": capture.received_at,
            "deadline": _deadline(version, stage, capture.received_at),
            "last_reminder_at": capture.received_at,
            "evidence_ids": evidence,
        },
        actor,
    )
    return cast(Incident, incident)


def _require_capture_authority(capture: IncidentCapture) -> None:
    authorization = capture.review_authorization
    if authorization is None:
        require_context(current_scope(capture.actor), INCIDENT_CREATE, capture.context)
        return
    from field_sync.models import FieldEvent

    if authorization.reviewer_actor is None or capture.source_id != authorization.source_id:
        raise Http404
    source_matches = FieldEvent.objects.filter(
        pk=authorization.source_id,
        organization=capture.actor.organization,
        created_by=capture.actor.user,
        payload_sha256=authorization.payload_sha256,
        status="in_review",
    ).exists()
    if not source_matches:
        raise Http404
    require_context(authorization.historical_scope, INCIDENT_CREATE, capture.context)
    require_context(current_scope(authorization.reviewer_actor), INCIDENT_CREATE, capture.context)


def report(actor: UploadActor, data: dict[str, Any]) -> Incident:
    context = resource_context(actor.organization, data)
    require_context(current_scope(actor), INCIDENT_CREATE, context)
    with incident_transaction(
        actor, source_event_id=context.marker.event_id if context.marker else None
    ):
        now = server_now()
        context = resource_context(actor.organization, data)
        return create_incident(IncidentCapture(actor, data, context, now, now))


@dataclass(frozen=True)
class Decision:
    action: str
    expected_revision: int
    text: str = ""
    evidence_ids: tuple[UUID, ...] = ()
    owner_id: UUID | None = None
    severity: str | None = None


def _visible_incident(actor: UploadActor, identifier: UUID, permission: str) -> Incident:
    incident = Incident.objects.filter(organization=actor.organization, pk=identifier).first()
    if incident is None:
        raise Http404
    require_context(
        current_scope(actor), permission, ResourceContext(incident.center_id, incident.quadrant_id)
    )
    return cast(Incident, incident)


def decide(actor: UploadActor, identifier: UUID, decision: Decision) -> IncidentEvent:
    permission = (
        INCIDENT_REASSIGN
        if decision.action in {"reassign", "change_severity"}
        else (INCIDENT_CLOSE if decision.action in {"close", "void"} else INCIDENT_CREATE)
    )
    _visible_incident(actor, identifier, permission)
    with incident_transaction(actor):
        visible = _visible_incident(actor, identifier, permission)
        incident = Incident.objects.select_for_update(nowait=True, no_key=True).get(pk=visible.pk)
        previous = current_event(incident)
        if previous.revision != decision.expected_revision:
            raise IncidentConflictError("revision", previous.revision)
        if previous.state != "open":
            raise IncidentConflictError("terminal_state", previous.revision)
        values = _apply_decision(actor, previous, decision)
        return append_event(incident, values, actor)


def _apply_decision(
    actor: UploadActor, previous: IncidentEvent, decision: Decision
) -> dict[str, Any]:
    incident = previous.incident
    values = _next_values(previous, decision.action)
    context = ResourceContext(incident.center_id, incident.quadrant_id)
    if decision.action == "reassign":
        target = eligible_owner(
            decision.owner_id, actor.organization, context, terminal=previous.stage == 2
        )
        if target is None:
            raise IncidentConfigurationUnavailableError
        values["owner"] = target
    elif decision.action == "change_severity":
        _validate_severity(incident, decision.severity)
        values["severity"] = decision.severity
    elif decision.action == "close":
        values["text"] = validate_void_reason(decision.text)
        values["evidence_ids"] = bind_evidence(
            actor,
            incident,
            list(decision.evidence_ids),
            incident.type_version.close_evidence_min,
        )
        values["state"] = "closed"
        values["resolved_blocker_ids"] = sorted(
            str(pk) for pk in incident.blockers.values_list("pk", flat=True)
        )
    elif decision.action == "void":
        values["text"] = validate_void_reason(decision.text)
        _validate_void(previous)
        values["state"] = "voided"
    elif decision.action == "comment":
        values["text"] = decision.text.strip()
        if not values["text"]:
            raise IncidentConflictError("comment_required")
    else:
        raise IncidentConflictError("action")
    return values


def _validate_severity(incident: Incident, severity: str | None) -> None:
    if severity not in {"low", "medium", "high", "critical"}:
        raise IncidentConflictError("severity")
    if incident.type_version.code == "emergency-accident" and severity != "critical":
        raise IncidentConflictError("critical_type")


def _validate_void(previous: IncidentEvent) -> None:
    if (
        previous.incident.blockers.exists()
        or previous.incident.escalations.exists()
        or previous.revision != 1
    ):
        raise IncidentConflictError("incident_dependents", previous.revision)


def _next_values(previous: IncidentEvent, action: str) -> dict[str, Any]:
    return {
        "revision": previous.revision + 1,
        "action": action,
        **{
            name: getattr(previous, name)
            for name in (
                "state",
                "owner",
                "stage",
                "severity",
                "stage_entered_at",
                "deadline",
                "last_reminder_at",
            )
        },
    }


def escalate(incident: Incident, now: datetime) -> IncidentEvent | None:
    """One due transition per invocation; no loop burst or late account/source locks."""
    with incident_transaction(None, incident.organization):
        locked = Incident.objects.select_for_update(nowait=True, no_key=True).get(pk=incident.pk)
        previous = current_event(locked)
        if previous.state != "open":
            return None
        terminal = previous.stage == 2
        context = ResourceContext(locked.center_id, locked.quadrant_id)
        owner_available = (
            eligible_owner(previous.owner_id, locked.organization, context, terminal=terminal)
            is not None
        )
        due = previous.last_reminder_at + timedelta(hours=1) if terminal else previous.deadline
        if due is None or (
            not reminder_due(now, previous.last_reminder_at)
            if terminal
            else now < due and owner_available
        ):
            return None
        values = _next_values(previous, "reminder" if terminal else "escalate")
        if terminal:
            # An explicit replacement remains final owner, rather than reverting to the type seed.
            if (
                eligible_owner(
                    previous.owner_id,
                    locked.organization,
                    ResourceContext(locked.center_id, locked.quadrant_id),
                    terminal=True,
                )
                is None
            ):
                raise IncidentConfigurationUnavailableError
        else:
            owners = chain(
                locked.type_version, ResourceContext(locked.center_id, locked.quadrant_id)
            )
            stage = next_stage(previous.stage, tuple(owner is not None for owner in owners))
            values.update(
                stage=stage,
                owner=owners[stage],
                stage_entered_at=now,
                deadline=_deadline(locked.type_version, stage, now),
            )
        values["last_reminder_at"] = now
        event = append_event(locked, values, None)
        EscalationReceipt.objects.create(
            organization=locked.organization,
            actor_kind="system",
            incident=locked,
            event=event,
            stage=previous.stage,
            deadline=due,
            hour_bucket=now.replace(minute=0, second=0, microsecond=0) if terminal else None,
        )
        return event
