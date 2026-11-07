"""Actual subject vectors; unresolved audit requires two explicit all bounds in one grant."""

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from django.core.exceptions import ValidationError
from django.http import Http404

from field_sync.envelope import EventEnvelope
from field_sync.models import FieldEvent
from organizations.models import Organization
from organizations.scope import EffectiveScope


@dataclass(frozen=True)
class SubjectFacts:
    resolved: bool = False
    contexts: tuple[dict[str, str | None], ...] = ()
    resource_kind: str = ""
    resource_id: UUID | None = None
    facts: dict[str, Any] = field(default_factory=dict)


def vector_allows(  # noqa: PLR0913 -- permission with the complete resolved subject vector
    scope: EffectiveScope, permission: str, contexts: list | tuple, resolved: bool = True
) -> bool:
    return (
        resolved
        and bool(contexts)
        and all(_allows_context(scope, permission, context) for context in contexts)
    )


def subject_allows(scope: EffectiveScope, permission: str, subjects: SubjectFacts) -> bool:
    """Transfer policy owns its stronger one-binding vector; old owner semantics remain exact."""
    if subjects.resource_kind == "transfer":
        from inventory.transfers.scope import allows_transfer_vector

        return subjects.resolved and allows_transfer_vector(scope, permission, subjects.contexts)
    return vector_allows(scope, permission, subjects.contexts, subjects.resolved)


def _allows_context(scope: EffectiveScope, permission: str, context: dict[str, Any]) -> bool:
    center, quadrant = context["center_id"], context["quadrant_id"]
    if center is None:
        return quadrant is None and any(
            permission in codes and grant["centers"]["mode"] == "all"
            for codes, grant in scope.grants
        )
    return scope.allows(permission, center, quadrant)


def unresolved_scope_allows(scope: EffectiveScope, permission: str) -> bool:
    return any(
        permission in codes
        and grant["centers"]["mode"] == "all"
        and grant["quadrants"]["mode"] == "all"
        for codes, grant in scope.grants
    )


def _payload(organization: Organization, envelope: EventEnvelope) -> dict[str, Any] | None:
    from field_sync.registry import OrgScopedRequest, get_handler

    handler = get_handler(envelope.type, envelope.schema_version)
    if handler is None:
        return None
    serializer = handler.payload_serializer(
        data=envelope.payload,
        context={"request": OrgScopedRequest(organization), "organization": organization},
    )
    return dict(serializer.validated_data) if serializer.is_valid() else None


def subject_facts(organization: Organization, envelope: EventEnvelope) -> SubjectFacts:
    data = _payload(organization, envelope)
    if data is None:
        return SubjectFacts()
    try:
        if envelope.type in {"transfer.dispatch", "transfer.receive"}:
            from inventory.transfers.models import Transfer
            from inventory.transfers.scope import transfer_contexts

            transfer = (
                Transfer.objects.filter(organization=organization, pk=data["transfer_id"])
                .select_related("origin", "destination")
                .first()
            )
            return (
                SubjectFacts()
                if transfer is None
                else SubjectFacts(
                    True,
                    transfer_contexts(transfer),
                    "transfer",
                    transfer.pk,
                    {"transfer_action": envelope.type},
                )
            )
        if envelope.type == "community.activity":
            from community.permissions import block_context
            from geography.models import Block

            block = (
                Block.objects.filter(organization=organization, pk=data["zone_id"])
                .select_related("quadrant")
                .first()
            )
            return (
                SubjectFacts()
                if block is None
                else SubjectFacts(True, (block_context(block),), "block", block.pk)
            )
        if envelope.type.startswith("ovitrap."):
            return _point_subject(organization, data)
        if envelope.type == "record.void":
            return _void_subject(organization, envelope)
        if envelope.type in {"incident.report", "emergency.accident"}:
            return _incident_subject(organization, envelope)
        if envelope.type in {"shift.open", "shift.close", "fuel.load"}:
            return _motorcycle_subject(organization, envelope, data)
    except (Http404, ValidationError, ValueError, TypeError):
        return SubjectFacts()
    return SubjectFacts()


def _point_subject(organization: Organization, data: dict[str, Any]) -> SubjectFacts:
    from geography.models import SamplingPoint
    from ovitraps.models import Ovitrap

    point = None
    if identifier := data.get("sampling_point_id"):
        point = (
            SamplingPoint.objects.filter(organization=organization, pk=identifier)
            .select_related("block__quadrant")
            .first()
        )
    elif identifier := data.get("ovitrap_id"):
        identity = (
            Ovitrap.objects.filter(organization=organization, client_uuid=identifier)
            .select_related("sampling_point__block__quadrant")
            .first()
        )
        point = None if identity is None else identity.sampling_point
        if identity is None:
            from reviews.models import ReviewParentClaim, ReviewSourceSnapshot

            claim = ReviewParentClaim.objects.filter(
                organization=organization, kind="ovitrap", identity=identifier
            ).first()
            snapshot = (
                None
                if claim is None
                else ReviewSourceSnapshot.objects.filter(
                    source_event_id=claim.source_event_id, resource_kind="sampling_point"
                ).first()
            )
            if snapshot is not None:
                point = (
                    SamplingPoint.objects.filter(organization=organization, pk=snapshot.resource_id)
                    .select_related("block__quadrant")
                    .first()
                )
    if point is None:
        return SubjectFacts()
    return SubjectFacts(
        True,
        (
            {
                "center_id": str(point.block.quadrant.center_id),
                "quadrant_id": str(point.block.quadrant_id),
            },
        ),
        "sampling_point",
        point.pk,
    )


def _void_subject(organization: Organization, envelope: EventEnvelope) -> SubjectFacts:
    from reviews.inspection import original_source_envelope

    if envelope.voids_event_id is None:
        return SubjectFacts()
    target = FieldEvent.objects.filter(
        organization=organization, pk=envelope.voids_event_id
    ).first()
    if target is None or target.type == "record.void":
        return SubjectFacts()
    declaration = FieldEvent.objects.filter(organization=organization, pk=envelope.id).first()
    if declaration is not None and target.created_by_id != declaration.created_by_id:
        return SubjectFacts()
    return subject_facts(organization, original_source_envelope(target))


def _incident_subject(organization: Organization, envelope: EventEnvelope) -> SubjectFacts:
    from incidents.selectors import resource_context

    context = resource_context(organization, envelope.payload, envelope.shift_id)
    kind, resource_id = context.resource_kind or "", context.resource_id
    if (
        not kind
        and envelope.shift_id is not None
        and not envelope.payload.get("scope")
        and not envelope.payload.get("resource_ref")
    ):
        from shifts.models import Shift

        shift = Shift.objects.filter(organization=organization, pk=envelope.shift_id).first()
        if shift is not None:
            kind, resource_id = "motorcycle", shift.motorcycle_id
    return SubjectFacts(
        True,
        (
            {
                "center_id": str(context.center_id),
                "quadrant_id": None if context.quadrant_id is None else str(context.quadrant_id),
            },
        ),
        kind,
        resource_id,
    )


def _motorcycle_subject(
    organization: Organization, envelope: EventEnvelope, data: dict[str, Any]
) -> SubjectFacts:
    from shifts.models import Motorcycle, Shift

    motorcycle = None
    if envelope.type in {"shift.open", "fuel.load"}:
        code = data.get("motorcycle_code", data.get("motorcycle_id"))
        motorcycle = Motorcycle.objects.filter(organization=organization, code=code).first()
    elif envelope.shift_id is not None:
        shift = (
            Shift.objects.filter(organization=organization, pk=envelope.shift_id)
            .select_related("motorcycle")
            .first()
        )
        motorcycle = None if shift is None else shift.motorcycle
    if motorcycle is None:
        return SubjectFacts()
    return SubjectFacts(
        True,
        (
            {
                "center_id": None if motorcycle.center_id is None else str(motorcycle.center_id),
                "quadrant_id": None,
            },
        ),
        "motorcycle",
        motorcycle.pk,
    )
