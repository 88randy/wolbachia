"""Closed parent registry. Identities and bytes never authorize a resource by themselves."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.http import Http404

from field_sync.models import FieldEvent
from field_sync.permissions import FIELD_EVENT_SYNC
from geography.models import SamplingPoint
from organizations.scope import EffectiveScope
from ovitraps.models import Ovitrap
from shifts.models import Motorcycle, MotorcycleBlockEvent
from uploads.access import UploadActor, current_scope
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload

OVITRAP_EVENTS = frozenset(
    {"ovitrap.place", "ovitrap.check", "ovitrap.replace", "ovitrap.relocate", "ovitrap.remove"}
)
INCIDENT_EVENTS = frozenset({"incident.report", "emergency.accident"})
TRANSFER_EVENTS = frozenset({"transfer.dispatch", "transfer.receive"})
SUPPLY_EVENTS = frozenset({"supplies.receive", "supplies.reconcile"})
RELEASE_EVENTS = frozenset({"release.record"})


@dataclass(frozen=True)
class AttachmentTarget:
    kind: str
    identifier: UUID


def _allows_motorcycle(scope: EffectiveScope, permission: str, motorcycle: Motorcycle) -> bool:
    # Match shifts.access.authorize_center: an unassigned motorcycle needs explicit all.
    if motorcycle.center_id is None:
        return any(
            permission in codes and grant["centers"]["mode"] == "all"
            for codes, grant in scope.grants
        )
    return scope.allows(permission, str(motorcycle.center_id))


def declared_upload_ids(event: FieldEvent) -> set[UUID]:
    if (
        event.type
        not in OVITRAP_EVENTS | INCIDENT_EVENTS | TRANSFER_EVENTS | SUPPLY_EVENTS | RELEASE_EVENTS
        and event.type != "fuel.load"
    ):
        return set()
    references: Any = event.payload.get("evidence_ids", [])
    if event.type == "fuel.load":
        references = [event.payload.get("receipt_upload_id")]
    if event.type in TRANSFER_EVENTS:
        if not isinstance(references, list):
            return set()
        references = [*references, event.payload.get("signature_upload_id")]
    if event.type in SUPPLY_EVENTS:
        references = _supply_upload_references(event.payload)
    if not isinstance(references, list):
        return set()
    identifiers = set()
    for reference in references:
        try:
            identifiers.add(UUID(str(reference)))
        except (ValueError, TypeError, AttributeError):
            continue
    return identifiers


def _supply_upload_references(payload: dict[str, Any]) -> list[Any]:
    references = [payload.get("signature_upload_id")]
    for key, field in (("used", "transit_evidence_ids"), ("shrinkage", "evidence_ids")):
        for row in payload.get(key, []):
            if isinstance(row, dict) and isinstance(row.get(field), list):
                references.extend(row[field])
    return references


def _event_dimensions(event: FieldEvent) -> tuple[str | None, str | None]:
    if event.type in RELEASE_EVENTS:
        from releases.models import Permit

        permit = Permit.objects.filter(
            organization_id=event.organization_id, pk=event.payload.get("permit_id")
        ).first()
        if permit is None:
            raise Http404
        return str(permit.center_id), str(permit.quadrant_id)
    if event.type in INCIDENT_EVENTS:
        from incidents.selectors import resource_context

        try:
            context = resource_context(event.organization, event.payload, event.shift_id)
        except (ValueError, KeyError, TypeError):
            raise Http404 from None
        return str(context.center_id), str(context.quadrant_id) if context.quadrant_id else None
    if event.type == "fuel.load":
        motorcycle = Motorcycle.objects.filter(
            organization_id=event.organization_id, code=event.payload.get("motorcycle_id")
        ).first()
        if motorcycle is None:
            raise Http404
        return str(motorcycle.center_id) if motorcycle.center_id else None, None
    return _ovitrap_event_dimensions(event)


def _ovitrap_event_dimensions(event: FieldEvent) -> tuple[str, str]:
    if event.type not in OVITRAP_EVENTS:
        raise Http404
    try:
        if event.type == "ovitrap.place":
            point_id = UUID(str(event.payload.get("sampling_point_id")))
        else:
            trap = Ovitrap.objects.filter(
                organization_id=event.organization_id,
                client_uuid=UUID(str(event.payload.get("ovitrap_id"))),
            ).first()
            if trap is None:
                raise Http404
            point_id = trap.sampling_point_id
    except (ValueError, TypeError, AttributeError):
        raise Http404 from None
    point = (
        SamplingPoint.objects.select_related("block__quadrant")
        .filter(organization_id=event.organization_id, pk=point_id)
        .first()
    )
    if point is None:
        raise Http404
    return str(point.center_id), str(point.quadrant_id)


def authorize_target(
    actor: UploadActor, target: AttachmentTarget, upload: Upload
) -> dict[str, object]:
    """Current attach authority; no parent row locks or public-key-based authority."""
    scope = current_scope(actor)
    if target.kind in {
        "inventory_intent",
        "lab_rejection",
        "transfer_event",
        "certification",
        "lab_paddle_command",
        "material_request",
    }:
        return _domain_attachment_target(actor, target, upload)
    if target.kind == "review_item":
        return _review_attachment_target(actor, target, scope)
    if target.kind == "incident":
        from incidents.models import Incident

        incident = Incident.objects.filter(
            organization=actor.organization, pk=target.identifier
        ).first()
        if (
            incident is None
            or not scope.allows(
                "incident.close",
                str(incident.center_id),
                str(incident.quadrant_id) if incident.quadrant_id else None,
            )
            or not scope.allows(
                FIELD_UPLOAD,
                str(incident.center_id),
                str(incident.quadrant_id) if incident.quadrant_id else None,
            )
        ):
            raise Http404
        return {"incident": incident}
    if target.kind == "motorcycle_fault":
        fault = (
            MotorcycleBlockEvent.objects.select_related("motorcycle")
            .filter(
                organization=actor.organization,
                pk=target.identifier,
                action="block",
                blocked_reason="severe_check",
            )
            .first()
        )
        if fault is None:
            raise Http404
        can_attach = _allows_motorcycle(scope, "motorcycle.service_clear", fault.motorcycle) or (
            fault.created_by_id == actor.user.pk
            and _allows_motorcycle(scope, FIELD_EVENT_SYNC, fault.motorcycle)
        )
        if not can_attach or not _allows_motorcycle(scope, FIELD_UPLOAD, fault.motorcycle):
            raise Http404
        return {"fault": fault}
    if target.kind != "field_event":
        raise Http404
    return _field_attachment_target(actor, target, upload)


def _domain_attachment_target(
    actor: UploadActor, target: AttachmentTarget, upload: Upload
) -> dict[str, object]:
    if target.kind == "material_request":
        from lab.shipments.evidence import authorize_request_attachment

        return authorize_request_attachment(actor, target.identifier, upload)
    if target.kind == "certification":
        from people.evidence import authorize_certification_attachment

        return authorize_certification_attachment(actor, target.identifier, upload)
    if target.kind == "inventory_intent":
        from inventory.allocations.evidence import authorize_intent_attachment

        return authorize_intent_attachment(actor, target.identifier, upload)
    if target.kind == "lab_rejection":
        from lab.evidence import authorize_rejection_attachment

        return authorize_rejection_attachment(actor, target.identifier, upload)
    if target.kind == "lab_paddle_command":
        from lab.independent_qa.evidence import authorize_paddle_attachment

        return authorize_paddle_attachment(actor, target.identifier, upload)
    if target.kind == "transfer_event":
        return _transfer_attachment_target(actor, target, upload)
    raise Http404


def _field_attachment_target(
    actor: UploadActor, target: AttachmentTarget, upload: Upload
) -> dict[str, object]:
    event = FieldEvent.objects.filter(organization=actor.organization, pk=target.identifier).first()
    if (
        event is None
        or event.status == "rejected"
        or upload.public_id not in declared_upload_ids(event)
    ):
        raise Http404
    if (
        event.created_by_id != upload.uploader_id
        or event.created_by_id != actor.user.pk
        or event.device_id != upload.device_id
        or actor.device_id != event.device_id
        or not has_event_upload_scope(current_scope(actor), event)
    ):
        raise Http404
    return {"field_event": event}


def _review_attachment_target(
    actor: UploadActor, target: AttachmentTarget, scope: EffectiveScope
) -> dict[str, object]:
    from reviews.inspection import original_source_envelope
    from reviews.models import ReviewItem
    from reviews.scope import subject_allows, subject_facts

    item = (
        ReviewItem.objects.filter(organization=actor.organization, pk=target.identifier)
        .select_related("field_event")
        .first()
    )
    if item is None:
        raise Http404
    try:
        facts = subject_facts(actor.organization, original_source_envelope(item.field_event))
    except ValueError:
        raise Http404 from None
    if not all(
        subject_allows(scope, permission, facts)
        for permission in ("review_item.decide", FIELD_UPLOAD)
    ):
        raise Http404
    return {"review_item": item}


def authorize_download(actor: UploadActor, link: AttachmentLink) -> None:
    """Follow current parent read/history policy, including authorized voided history."""
    from uploads.services import _resolve_link_target

    parent = _resolve_link_target(link)
    if parent.kind == "material_request":
        from lab.shipments.evidence import authorize_request_download

        authorize_request_download(actor, parent.identifier)
        return
    if parent.kind == "certification":
        from people.evidence import authorize_certification_download

        authorize_certification_download(actor, parent.identifier)
        return
    if parent.kind == "inventory_intent":
        from inventory.allocations.evidence import authorize_intent_download

        authorize_intent_download(actor, parent.identifier)
        return
    if parent.kind == "lab_rejection":
        from lab.evidence import authorize_rejection_download

        authorize_rejection_download(actor, parent.identifier)
        return
    if parent.kind == "lab_paddle_command":
        from lab.independent_qa.evidence import authorize_paddle_download

        authorize_paddle_download(actor, parent.identifier)
        return
    _authorize_other_download(actor, link, parent)


def _authorize_other_download(
    actor: UploadActor, link: AttachmentLink, parent: AttachmentTarget
) -> None:
    scope = current_scope(actor)
    if parent.kind == "transfer_event":
        _authorize_transfer_download(actor, parent.identifier)
        return
    if link.review_item_id:
        from reviews.inspection import original_source_envelope
        from reviews.models import ReviewItem
        from reviews.scope import subject_allows, subject_facts

        item = (
            ReviewItem.objects.filter(organization=actor.organization, pk=link.review_item_id)
            .select_related("field_event")
            .first()
        )
        if item is None:
            raise Http404
        try:
            facts = subject_facts(actor.organization, original_source_envelope(item.field_event))
        except ValueError:
            raise Http404 from None
        if not subject_allows(scope, "review_item.read", facts):
            raise Http404
        return
    if link.incident_id:
        from incidents.models import Incident

        incident = Incident.objects.filter(
            organization=actor.organization, pk=link.incident_id
        ).first()
        if incident is None or not scope.allows(
            "incident.read",
            str(incident.center_id),
            str(incident.quadrant_id) if incident.quadrant_id else None,
        ):
            raise Http404
        return
    if link.fault_id:
        fault = MotorcycleBlockEvent.objects.select_related("motorcycle").get(
            pk=link.fault_id, organization=actor.organization
        )
        if not _allows_motorcycle(scope, "motorcycle.read", fault.motorcycle):
            raise Http404
        return
    _authorize_event_download(actor, scope, link.field_event_id)


def _transfer_attachment_target(
    actor: UploadActor, target: AttachmentTarget, upload: Upload
) -> dict[str, object]:
    from inventory.transfers.commands import TransferAuthority
    from inventory.transfers.models import TransferEvent
    from inventory.transfers.scope import require_transfer_scope

    event = (
        TransferEvent.objects.filter(
            organization=actor.organization, pk=target.identifier, declared_source_uuid__isnull=True
        )
        .select_related("transfer__origin", "transfer__destination")
        .first()
    )
    if (
        event is None
        or event.created_by_id != actor.user.pk
        or not event.evidence_refs.filter(upload=upload).exists()
    ):
        raise Http404
    permission = "discrepancy.close" if event.kind == "resolution" else f"transfer.{event.kind}"
    require_transfer_scope(TransferAuthority(actor), permission, event.transfer)
    if (
        event.kind == "resolution"
        and event.resolution.outcomes.filter(kind__in=["recover_dest", "return_origin"]).exists()
    ):
        require_transfer_scope(TransferAuthority(actor), "transfer.receive", event.transfer)
    require_transfer_scope(TransferAuthority(actor), FIELD_UPLOAD, event.transfer)
    return {"transfer_event": event}


def _authorize_transfer_download(actor: UploadActor, identifier: UUID) -> None:
    from inventory.transfers.commands import TransferAuthority
    from inventory.transfers.models import TransferEvent
    from inventory.transfers.scope import require_transfer_scope

    event = (
        TransferEvent.objects.filter(organization=actor.organization, pk=identifier)
        .select_related("transfer__origin", "transfer__destination")
        .first()
    )
    if event is None:
        raise Http404
    require_transfer_scope(TransferAuthority(actor), "transfer.read", event.transfer)


def _authorize_event_download(
    actor: UploadActor, scope: EffectiveScope, event_id: UUID | None
) -> None:
    if event_id is None:
        raise Http404
    event = FieldEvent.objects.filter(pk=event_id, organization=actor.organization).first()
    if event is None:
        raise Http404
    if event.type in RELEASE_EVENTS:
        _authorize_release_download(scope, event)
        return
    if event.type in SUPPLY_EVENTS:
        from inventory.allocations.evidence import authorize_source_download

        authorize_source_download(actor, event)
        return
    if event.type in TRANSFER_EVENTS:
        _authorize_transfer_source_download(actor, scope, event)
        return
    if event.type == "fuel.load":
        motorcycle = Motorcycle.objects.filter(
            organization=actor.organization, code=event.payload.get("motorcycle_id")
        ).first()
        if motorcycle is None or not _allows_motorcycle(scope, "motorcycle.read", motorcycle):
            raise Http404
        return
    center, quadrant = _event_dimensions(event)
    permission = (
        "incident.read"
        if event.type in INCIDENT_EVENTS
        else ("reading.read" if event.type == "ovitrap.check" else "ovitrap.read")
    )
    if not scope.allows(permission, center, quadrant):
        raise Http404
    if (
        event.type in INCIDENT_EVENTS
        and event.status == "in_review"
        and not scope.allows("review_item.read", center, quadrant)
    ):
        raise Http404


def has_event_upload_scope(scope: EffectiveScope, event: FieldEvent) -> bool:
    if event.type in RELEASE_EVENTS:
        from reviews.scope import subject_allows

        facts = _release_event_subjects(event)
        return all(
            subject_allows(scope, permission, facts)
            for permission in (FIELD_UPLOAD, FIELD_EVENT_SYNC)
        )
    if event.type in SUPPLY_EVENTS:
        from inventory.allocations.permissions import SOURCE_PERMISSIONS
        from inventory.allocations.scope import allows_supply_vector
        from reviews.inspection import original_source_envelope
        from reviews.scope import subject_facts

        facts = subject_facts(event.organization, original_source_envelope(event))
        return facts.resolved and all(
            allows_supply_vector(scope, permission, list(facts.contexts))
            for permission in (FIELD_UPLOAD, FIELD_EVENT_SYNC, SOURCE_PERMISSIONS[event.type])
        )
    if event.type in TRANSFER_EVENTS:
        from reviews.inspection import original_source_envelope
        from reviews.scope import subject_allows, subject_facts

        facts = subject_facts(event.organization, original_source_envelope(event))
        return all(
            subject_allows(scope, permission, facts)
            for permission in (FIELD_UPLOAD, FIELD_EVENT_SYNC, event.type)
        )
    if event.type == "fuel.load":
        motorcycle = Motorcycle.objects.filter(
            organization_id=event.organization_id, code=event.payload.get("motorcycle_id")
        ).first()
        return (
            motorcycle is not None
            and _allows_motorcycle(scope, FIELD_UPLOAD, motorcycle)
            and _allows_motorcycle(scope, FIELD_EVENT_SYNC, motorcycle)
        )
    center, quadrant = _event_dimensions(event)
    return scope.allows(FIELD_UPLOAD, center, quadrant) and scope.allows(
        FIELD_EVENT_SYNC, center, quadrant
    )


def _release_event_subjects(event: FieldEvent) -> Any:  # noqa: ANN401 -- concrete SubjectFacts, imported locally to avoid model cycles
    from releases.payloads import ReleasePayload
    from reviews.scope import SubjectFacts, release_subjects

    payload = ReleasePayload(data=event.payload)
    if not payload.is_valid():
        return SubjectFacts()
    return release_subjects(event.organization, dict(payload.validated_data))


def _authorize_release_download(scope: EffectiveScope, event: FieldEvent) -> None:
    from reviews.scope import subject_allows

    facts = _release_event_subjects(event)
    if not subject_allows(scope, "release.read", facts) or (
        event.status == "in_review" and not subject_allows(scope, "review_item.read", facts)
    ):
        raise Http404


def _authorize_transfer_source_download(
    actor: UploadActor, scope: EffectiveScope, event: FieldEvent
) -> None:
    from reviews.inspection import original_source_envelope
    from reviews.scope import subject_allows, subject_facts

    facts = subject_facts(actor.organization, original_source_envelope(event))
    if not subject_allows(scope, "transfer.read", facts) or (
        event.status == "in_review" and not subject_allows(scope, "review_item.read", facts)
    ):
        raise Http404
