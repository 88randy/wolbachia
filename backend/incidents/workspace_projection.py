"""Current read hints; immutable audit references never grant a parent or byte access."""

from typing import Any
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from incidents.models import Incident, IncidentBlocker, IncidentEvent
from organizations.models import Membership
from organizations.scope import EffectiveScope
from uploads.access import UploadActor, current_scope
from uploads.models import AttachmentLink, UploadVerification
from uploads.targets import authorize_download

ACTION_CODES = {
    "comment": "incident.create",
    "reassign": "incident.reassign",
    "change_severity": "incident.reassign",
    "close": "incident.close",
    "void": "incident.close",
}


def can_read_incident(actor: UploadActor, incident: Incident) -> bool:
    return incident.organization_id == actor.organization.pk and _allows(
        current_scope(actor), "incident.read", incident
    )


def _allows(scope: EffectiveScope, permission: str, incident: Incident) -> bool:
    return scope.allows(
        permission,
        str(incident.center_id),
        str(incident.quadrant_id) if incident.quadrant_id else None,
    )


def display_label(member: Membership) -> str:
    return member.user.get_full_name().strip() or member.user.username


def event_author_display(actor: UploadActor | None, event: IncidentEvent) -> str | None:
    if actor is None or event.created_by_id is None or not can_read_incident(actor, event.incident):
        return None
    member = (
        Membership.objects.filter(organization=actor.organization, user_id=event.created_by_id)
        .select_related("user")
        .first()
    )
    return display_label(member) if member else None


def unavailable_record() -> dict[str, Any]:
    return {"kind": None, "available": False, "id": None, "code": None, "is_voided": None}


def _reference(kind: str, resource: Any, code: str | None = None) -> dict[str, Any]:  # noqa: ANN401 -- closed domain models share only identity/void fields
    event = getattr(resource, "event", None) or getattr(resource, "field_event", None)
    voided = getattr(resource, "voided_at", None) is not None or (
        event is not None and event.voided_at is not None
    )
    return {
        "kind": kind,
        "available": True,
        "id": str(resource.pk),
        "code": code,
        "is_voided": voided,
    }


def _motorcycle_reference(actor: UploadActor, identifier: UUID) -> dict[str, Any]:
    from shifts.models import Motorcycle
    from uploads.targets import _allows_motorcycle

    motorcycle = Motorcycle.objects.filter(organization=actor.organization, pk=identifier).first()
    if motorcycle is None or not _allows_motorcycle(
        current_scope(actor), "motorcycle.read", motorcycle
    ):
        return unavailable_record()
    return _reference("motorcycle", motorcycle, motorcycle.code)


def _ovitrap_reference(actor: UploadActor, identifier: UUID) -> dict[str, Any]:
    from organizations.selectors import filter_by_scope
    from ovitraps.models import Ovitrap

    row = (
        filter_by_scope(
            Ovitrap.objects.filter(organization=actor.organization, pk=identifier),
            current_scope(actor),
            "ovitrap.read",
        )
        .select_related("sampling_point", "event")
        .first()
    )
    return (
        unavailable_record() if row is None else _reference("ovitrap", row, row.sampling_point.code)
    )


def _lot_reference(actor: UploadActor, identifier: UUID, location: Any = None) -> dict[str, Any]:  # noqa: ANN401 -- optional actual retained measurement Location
    from inventory.selectors import lot_versions

    version = (
        lot_versions(actor, "lot.read", location)
        .filter(lot_id=identifier)
        .select_related("lot")
        .first()
    )
    return (
        unavailable_record()
        if version is None
        else _reference("lot", version.lot, version.lot.code)
    )


def blocker_resource(actor: UploadActor, blocker: IncidentBlocker) -> dict[str, Any]:
    handlers = {
        "motorcycle": _motorcycle_reference,
        "ovitrap": _ovitrap_reference,
        "lot": _lot_reference,
    }
    handler = handlers.get(blocker.resource_kind)
    return unavailable_record() if handler is None else handler(actor, blocker.resource_id)


def _source_reference(actor: UploadActor, incident: Incident) -> dict[str, Any]:
    from reviews.inspection import original_source_envelope
    from reviews.scope import subject_allows, subject_facts

    source = incident.source_event
    if source is None:
        return unavailable_record()
    try:
        facts = subject_facts(actor.organization, original_source_envelope(source))
    except ValueError:
        return unavailable_record()
    scope = current_scope(actor)
    if not subject_allows(scope, "incident.read", facts) or (
        source.status == "in_review" and not subject_allows(scope, "review_item.read", facts)
    ):
        return unavailable_record()
    return _reference("field_event", source)


def _lab_reference(actor: UploadActor, incident: Incident) -> dict[str, Any]:
    from lab.access import scoped_bags
    from lab.models import ReceptionIncidentLink

    link = ReceptionIncidentLink.objects.filter(
        organization=actor.organization, incident=incident
    ).first()
    if link is None:
        return unavailable_record()
    bag = scoped_bags(actor, "reading.read").filter(pk=link.discrepancy.bag_id).first()
    return unavailable_record() if bag is None else _reference("bag", bag, bag.code)


def linked_record(actor: UploadActor, incident: Incident) -> dict[str, Any]:
    from inventory.conditions import reading_context
    from inventory.models import ConditionIncidentLink, Location
    from reviews.actions import visible_review
    from reviews.models import ReviewIncidentLink

    origin = getattr(incident, "creation_origin", "unknown")
    if origin == "lab_reception":
        return _lab_reference(actor, incident)
    if origin == "inventory_condition":
        link = (
            ConditionIncidentLink.objects.filter(organization=actor.organization, incident=incident)
            .select_related("breach__reading")
            .first()
        )
        if link is None:
            return unavailable_record()
        reading = link.breach.reading
        placement = reading_context(reading)
        return _lot_reference(
            actor, reading.lot_id, placement if isinstance(placement, Location) else None
        )
    if origin == "review_decision":
        link = ReviewIncidentLink.objects.filter(
            organization=actor.organization, incident=incident
        ).first()
        if link is None:
            return unavailable_record()
        try:
            item = visible_review(actor, link.review_item_id, "review_item.read")
        except (Http404, PermissionDenied):
            return unavailable_record()
        reference = _reference("review_item", item)
        latest = item.decisions.order_by("-revision").first()
        if latest is not None and latest.decision_state == "voided":
            reference["is_voided"] = True
        return reference
    if origin == "field_event":
        return _source_reference(actor, incident)
    adopted = getattr(incident, "origin", None)
    if adopted is not None:
        return _ovitrap_reference(actor, adopted.marker.ovitrap_id)
    blocker = incident.blockers.order_by("created_at", "id").first()
    return unavailable_record() if blocker is None else blocker_resource(actor, blocker)


def evidence_projection(actor: UploadActor, identifiers: list[str]) -> list[dict[str, Any]]:
    references = []
    for identifier in sorted(set(identifiers)):
        entry = {
            "id": identifier,
            "is_readable": False,
            "is_verified": None,
            "verified_at": None,
            "content_type": None,
            "size_bytes": None,
        }
        link = (
            AttachmentLink.objects.filter(
                organization=actor.organization, upload__public_id=identifier
            )
            .select_related("upload")
            .first()
        )
        if link is not None:
            try:
                authorize_download(actor, link)
            except (Http404, PermissionDenied):
                references.append(entry)
                continue
            verification = UploadVerification.objects.filter(
                organization=actor.organization, upload=link.upload
            ).first()
            entry.update(is_readable=verification is not None, is_verified=verification is not None)
            if verification:
                entry.update(
                    verified_at=verification.created_at,
                    content_type=verification.content_type,
                    size_bytes=verification.size_bytes,
                )
        references.append(entry)
    return references


def _action_context(
    scope: EffectiveScope, incident: Incident
) -> tuple[dict[str, bool], dict[str, Any]]:
    permissions = {
        name: _allows(scope, permission, incident) for name, permission in ACTION_CODES.items()
    }
    dependent = (
        incident.blockers.exists()
        or incident.escalations.exists()
        or getattr(incident, "revision", 0) != 1
    )
    return permissions, {
        "is_open": getattr(incident, "state", None) == "open",
        "has_void_dependents": dependent,
        "is_severity_protected": incident.type_version.code == "emergency-accident",
        "close_evidence_min": incident.type_version.close_evidence_min,
        "can_upload_evidence": _allows(scope, "field.upload", incident),
    }


def workspace_projection(actor: UploadActor | None, incident: Incident) -> dict[str, Any]:
    projection: dict[str, Any] = {
        "owner_display": None,
        "type_snapshot": None,
        "linked_record": unavailable_record(),
        "blockers": [],
        "evidence": [],
        "action_permissions": dict.fromkeys(ACTION_CODES, False),
        "action_prerequisites": None,
    }
    if actor is None or not can_read_incident(actor, incident):
        return projection
    owner_id = getattr(incident, "owner_id", None)
    member = (
        None
        if owner_id is None
        else Membership.objects.filter(organization=actor.organization, pk=str(owner_id))
        .select_related("user")
        .first()
    )
    events = list(incident.events.all())
    resolved = {str(identifier) for event in events for identifier in event.resolved_blocker_ids}
    version = incident.type_version
    permissions, prerequisites = _action_context(current_scope(actor), incident)
    projection.update(
        owner_display=display_label(member) if member else None,
        type_snapshot={
            "id": version.pk,
            **{
                key: getattr(version, key)
                for key in (
                    "code",
                    "label",
                    "icon",
                    "is_other",
                    "report_evidence_min",
                    "close_evidence_min",
                )
            },
        },
        linked_record=linked_record(actor, incident),
        blockers=[
            {
                "id": blocker.pk,
                "kind": blocker.kind,
                "is_active": getattr(incident, "state", None) == "open"
                and str(blocker.pk) not in resolved,
                "resource": blocker_resource(actor, blocker),
            }
            for blocker in incident.blockers.all()
        ],
        evidence=evidence_projection(
            actor, [str(identifier) for event in events for identifier in event.evidence_ids]
        ),
        action_permissions=permissions,
        action_prerequisites=prerequisites,
    )
    return projection
