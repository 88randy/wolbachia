"""Resolve one genuine source and preserve its immutable provenance, never custody."""

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from django.http import Http404

from field_sync.models import FieldEvent
from inventory.models import Lot
from organizations.models import Organization
from ovitraps.models import OvitrapReading
from releases.models import Release
from reviews.effect_receipts import is_effective
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class SampleSource:
    center_id: UUID
    quadrant_id: UUID | None
    author_id: UUID | None = None
    event_id: UUID | None = None
    reading_id: UUID | None = None
    lot_id: UUID | None = None
    release_id: UUID | None = None
    provenance: dict[str, Any] = field(default_factory=dict)


def require_source_scope(actor: UploadActor, source: SampleSource, permission: str) -> None:
    if not current_scope(actor).allows(
        permission, str(source.center_id), str(source.quadrant_id) if source.quadrant_id else None
    ):
        raise Http404


def resolve_source(organization: Organization, source_ref: dict[str, Any]) -> SampleSource:
    """Resolve identity for authorization even when a source is no longer effective."""
    kind = source_ref.get("kind")
    if not isinstance(kind, str):
        raise Http404
    resolver = {"reading": _reading, "lot": _lot, "release": _release}.get(kind)
    if resolver is None:
        raise Http404
    try:
        identifier = UUID(str(source_ref["id"]))
    except (ValueError, TypeError, KeyError):
        raise Http404 from None
    return resolver(organization, identifier)


def _reading(organization: Organization, identifier: UUID) -> SampleSource:
    reading = (
        OvitrapReading.objects.filter(
            organization=organization,
            pk=identifier,
            ovitrap__organization=organization,
            ovitrap__sampling_point__organization=organization,
            ovitrap__sampling_point__block__organization=organization,
            ovitrap__sampling_point__block__quadrant__organization=organization,
            ovitrap__sampling_point__block__quadrant__center__organization=organization,
            event__organization=organization,
        )
        .select_related("ovitrap__sampling_point__block__quadrant", "event")
        .first()
    )
    if reading is None:
        raise Http404
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    return SampleSource(
        quadrant.center_id,
        quadrant.pk,
        reading.event.created_by_id,
        reading.event_id,
        reading_id=reading.pk,
        provenance={
            "kind": "reading",
            "id": str(reading.pk),
            "event_id": str(reading.event_id),
            "payload_sha256": reading.event.payload_sha256,
            "point_version_id": str(reading.point_version_id),
        },
    )


def _lot(organization: Organization, identifier: UUID) -> SampleSource:
    lot = Lot.objects.filter(
        organization=organization, pk=identifier, center__organization=organization
    ).first()
    if lot is None or (
        lot.quadrant_id
        and (
            lot.quadrant.organization_id != organization.pk
            or lot.quadrant.center_id != lot.center_id
        )
    ):
        raise Http404
    return SampleSource(
        lot.center_id, lot.quadrant_id, lot_id=lot.pk, provenance={"kind": "lot", "id": str(lot.pk)}
    )


def _release(organization: Organization, identifier: UUID) -> SampleSource:
    release = (
        Release.objects.filter(
            organization=organization,
            pk=identifier,
            permit_version__organization=organization,
            permit_version__permit__organization=organization,
            permit_version__permit__center__organization=organization,
            permit_version__permit__quadrant__organization=organization,
        )
        .select_related("permit_version__permit")
        .first()
    )
    if release is None:
        raise Http404
    permit = release.permit_version.permit
    return SampleSource(
        permit.center_id,
        permit.quadrant_id,
        release.created_by_id,
        release.declared_event_id,
        release_id=release.pk,
        provenance={
            "kind": "release",
            "id": str(release.pk),
            "event_id": str(release.declared_event_id),
            "lot_id": str(release.lot_id),
            "permit_version_id": str(release.permit_version_id),
        },
    )


def source_is_effective(source: SampleSource) -> bool:
    if source.event_id is None:
        return True
    event = FieldEvent.objects.filter(pk=source.event_id).first()
    return event is not None and is_effective(event)
