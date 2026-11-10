"""Consume an existing effective collection; never fabricate a field source or result."""

from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import F, Q
from django.http import Http404

from catalogs.models import CatalogItem
from core.exceptions import FieldValidationError
from field_sync.models import FieldEvent
from inventory.allocations.scope import location_context, require_contexts
from inventory.models import Location, Lot
from lab.access import scoped_readings
from lab.exceptions import LabConflictError
from lab.models import LabMethodVersion
from lab.samples.models import WolbachiaSample
from lab.transactions import LabParticipants, lab_transaction
from uploads.access import UploadActor

SAMPLE_RECEIVE = "sample.receive"


@dataclass(frozen=True)
class SampleIdentityInput:
    identifier: UUID
    event_id: UUID
    code: str
    origin_id: UUID
    method_version_id: UUID
    location_id: UUID
    reading_id: UUID | None = None
    lot_id: UUID | None = None


def register_sample_identity(actor: UploadActor, request: SampleIdentityInput) -> WolbachiaSample:
    """Retain only an exact real source identity under whole-vector receiver authority."""
    source = _effective_collection(actor, request.event_id)
    if source.created_by_id is None:
        raise Http404
    prepared = _sample_references(actor, request)
    participants = _source_participants(source, prepared)
    with lab_transaction(actor, extra=participants):
        source = _effective_collection(actor, request.event_id)
        references = _sample_references(actor, request)
        if _source_participants(source, references) != participants:
            raise LabConflictError("sample_source_conflict")
        require_contexts(actor, SAMPLE_RECEIVE, references.pop("contexts"))
        _require_capture_identity(source, request, references["origin"])
        return _retain_identity(actor, (source, request), references)


def _source_participants(source: FieldEvent, references: dict[str, Any]) -> LabParticipants:
    events = [source]
    if references["reading"] is not None:
        reading = references["reading"]
        events.extend((reading.event, reading.ovitrap.event))
    if any(event.created_by_id is None for event in events):
        raise Http404
    identities = tuple(sorted({(event.pk, cast(UUID, event.created_by_id)) for event in events}))
    return LabParticipants(
        users=tuple(sorted({author for _, author in identities})), sources=identities
    )


def _effective_collection(actor: UploadActor, identifier: UUID) -> FieldEvent:
    source = (
        FieldEvent.objects.filter(
            organization=actor.organization,
            pk=identifier,
            type="sample.collect",
            voided_at__isnull=True,
        )
        .filter(Q(status="accepted") | Q(review_effect_receipt__payload_sha256=F("payload_sha256")))
        .first()
    )
    if source is None or source.created_by_id is None:
        raise Http404
    return cast(FieldEvent, source)


def _sample_references(actor: UploadActor, request: SampleIdentityInput) -> dict[str, Any]:
    origin = CatalogItem.objects.filter(
        organization=actor.organization,
        catalog__organization=actor.organization,
        catalog__slug="sample-origin",
        pk=request.origin_id,
    ).first()
    method = LabMethodVersion.objects.filter(
        organization=actor.organization,
        method__organization=actor.organization,
        pk=request.method_version_id,
    ).first()
    location = Location.objects.filter(
        organization=actor.organization,
        center__organization=actor.organization,
        pk=request.location_id,
    ).first()
    if origin is None or method is None or location is None:
        raise Http404
    contexts = [location_context(location)]
    source = _source_relation(actor, request)
    contexts.append(source.pop("context"))
    return {
        "origin": origin,
        "method_version": method,
        "location": location,
        "contexts": contexts,
        **source,
    }


def _source_relation(actor: UploadActor, request: SampleIdentityInput) -> dict[str, Any]:
    if (request.reading_id is None) == (request.lot_id is None):
        raise FieldValidationError("source_ref", "exactly_one_source_required")
    if request.reading_id is not None:
        reading = (
            scoped_readings(actor, SAMPLE_RECEIVE)
            .filter(
                pk=request.reading_id,
                event__voided_at__isnull=True,
                ovitrap__event__voided_at__isnull=True,
            )
            .filter(
                Q(event__status="accepted")
                | Q(event__review_effect_receipt__payload_sha256=F("event__payload_sha256"))
            )
            .filter(
                Q(ovitrap__event__status="accepted")
                | Q(
                    ovitrap__event__review_effect_receipt__payload_sha256=F(
                        "ovitrap__event__payload_sha256"
                    )
                )
            )
            .select_related("ovitrap__event")
            .first()
        )
        if reading is None:
            raise Http404
        quadrant = reading.ovitrap.sampling_point.block.quadrant
        return {
            "reading": reading,
            "lot": None,
            "context": {"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)},
        }
    lot = Lot.objects.filter(
        organization=actor.organization,
        center__organization=actor.organization,
        pk=cast(UUID, request.lot_id),
    ).first()
    if lot is None:
        raise Http404
    return {
        "reading": None,
        "lot": lot,
        "context": {
            "center_id": str(lot.center_id),
            "quadrant_id": str(lot.quadrant_id) if lot.quadrant_id else None,
        },
    }


def _require_capture_identity(
    source: FieldEvent, request: SampleIdentityInput, origin: CatalogItem
) -> None:
    if not request.code or len(request.code) > 50 or request.code != request.code.strip():
        raise FieldValidationError("code", "invalid")
    captured = {
        "sample_id": str(request.identifier),
        "code": request.code,
        "origin_code": origin.code,
        "method_version": str(request.method_version_id),
        "source_ref": {
            "kind": "reading" if request.reading_id else "lot",
            "id": str(request.reading_id or request.lot_id),
        },
    }
    if any(source.payload.get(key) != value for key, value in captured.items()):
        raise LabConflictError("sample_source_conflict")


def _retain_identity(
    actor: UploadActor,
    identity: tuple[FieldEvent, SampleIdentityInput],
    references: dict[str, Any],
) -> WolbachiaSample:
    source, request = identity
    existing = (
        WolbachiaSample.objects.filter(organization=actor.organization)
        .filter(Q(pk=request.identifier) | Q(event=source) | Q(code=request.code))
        .first()
    )
    if existing is not None:
        expected = {
            "pk": request.identifier,
            "event_id": source.pk,
            "code": request.code,
            "origin_id": request.origin_id,
            "method_version_id": request.method_version_id,
            "location_id": request.location_id,
            "reading_id": request.reading_id,
            "lot_id": request.lot_id,
            "collector_id": source.created_by_id,
        }
        if any(getattr(existing, key) != value for key, value in expected.items()):
            raise LabConflictError("sample_source_conflict")
        return cast(WolbachiaSample, existing)
    values = {
        "id": request.identifier,
        "organization": actor.organization,
        "created_by": actor.user,
        "code": request.code,
        "event": source,
        "collector_id": source.created_by_id,
        **references,
    }
    return cast(WolbachiaSample, WolbachiaSample.objects.create(**values))
