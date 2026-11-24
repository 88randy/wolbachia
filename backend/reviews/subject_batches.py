"""Request-local batching of the same current subject facts used by write preflights."""

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from field_sync.envelope import EventEnvelope
from field_sync.models import FieldEvent
from geography.models import SamplingPoint
from organizations.models import Organization
from ovitraps.models import Ovitrap
from reviews.inspection import envelope_of_source
from reviews.models import ReviewParentClaim, ReviewSourceSnapshot
from reviews.scope import (
    SubjectFacts,
    _payload,
    _release_subjects_many,
    subject_facts,
)
from shifts.models import Motorcycle, Shift

MOTORCYCLE_TYPES = frozenset({"shift.open", "shift.close", "fuel.load", "track.segment"})
# Resolved through the shift they name, not a motorcycle code in the payload.
SHIFT_SUBJECT_TYPES = frozenset({"shift.close", "track.segment"})


def source_subject_facts(
    organization: Organization, sources: Iterable[FieldEvent]
) -> dict[UUID, SubjectFacts]:
    """Load original source envelopes once, retaining unresolved identity failures."""
    rows = list(sources)
    if not rows:
        return {}
    snapshots = {
        row.source_event_id: row
        for row in ReviewSourceSnapshot.objects.filter(source_event_id__in=[row.pk for row in rows])
    }
    facts, envelopes = {}, []
    for source in rows:
        try:
            envelopes.append(envelope_of_source(source, snapshots.get(source.pk)))
        except ValueError:
            facts[source.pk] = SubjectFacts()
    facts.update(resolve_many(organization, envelopes))
    return facts


def resolve_many(
    organization: Organization, envelopes: list[EventEnvelope]
) -> dict[UUID, SubjectFacts]:
    """Resolve supported families in bulk, retaining the canonical selector for other kinds."""
    facts = {}
    grouped: dict[str, dict[UUID, dict[str, Any]]] = {"point": {}, "motorcycle": {}, "release": {}}
    for envelope in envelopes:
        kind = _batch_kind(envelope.type)
        if kind is None:
            facts[envelope.id] = subject_facts(organization, envelope)
        elif (values := _payload(organization, envelope)) is None:
            facts[envelope.id] = SubjectFacts()
        else:
            grouped[kind][envelope.id] = values
    if grouped["release"]:
        facts.update(_release_subjects_many(organization, grouped["release"]))
    if grouped["point"]:
        facts.update(_point_subjects_many(organization, grouped["point"]))
    if grouped["motorcycle"]:
        facts.update(_motorcycle_subjects_many(organization, envelopes, grouped["motorcycle"]))
    return facts


def _batch_kind(event_type: str) -> str | None:
    if event_type == "release.record":
        return "release"
    if event_type.startswith("ovitrap."):
        return "point"
    return "motorcycle" if event_type in MOTORCYCLE_TYPES else None


def _point_subjects_many(
    organization: Organization, payloads: dict[UUID, dict[str, Any]]
) -> dict[UUID, SubjectFacts]:
    trap_ids = {
        values["ovitrap_id"]
        for values in payloads.values()
        if not values.get("sampling_point_id") and values.get("ovitrap_id")
    }
    traps = {
        row.client_uuid: row
        for row in Ovitrap.objects.filter(
            organization=organization, client_uuid__in=trap_ids
        ).select_related("sampling_point__block__quadrant")
    }
    claims = {
        row.identity: row
        for row in ReviewParentClaim.objects.filter(
            organization=organization, kind="ovitrap", identity__in=trap_ids - traps.keys()
        )
    }
    snapshots = {
        row.source_event_id: row
        for row in ReviewSourceSnapshot.objects.filter(
            source_event_id__in=[row.source_event_id for row in claims.values()],
            resource_kind="sampling_point",
        )
    }
    point_ids = {
        values["sampling_point_id"]
        for values in payloads.values()
        if values.get("sampling_point_id")
    }
    point_ids.update(row.resource_id for row in snapshots.values() if row.resource_id)
    points = (
        SamplingPoint.objects.filter(organization=organization)
        .select_related("block__quadrant")
        .in_bulk(point_ids)
    )
    facts = {}
    for identifier, values in payloads.items():
        point = points.get(values.get("sampling_point_id"))
        if not values.get("sampling_point_id"):
            trap_id = values.get("ovitrap_id")
            trap, claim = traps.get(trap_id), claims.get(trap_id)
            snapshot = None if claim is None else snapshots.get(claim.source_event_id)
            point = (
                trap.sampling_point
                if trap
                else points.get(None if snapshot is None else snapshot.resource_id)
            )
        facts[identifier] = _point_facts(point)
    return facts


def _point_facts(point: SamplingPoint | None) -> SubjectFacts:
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


def _motorcycle_subjects_many(
    organization: Organization,
    envelopes: list[EventEnvelope],
    payloads: dict[UUID, dict[str, Any]],
) -> dict[UUID, SubjectFacts]:
    sources = [envelope for envelope in envelopes if envelope.id in payloads]
    codes = {
        payloads[row.id].get("motorcycle_code", payloads[row.id].get("motorcycle_id"))
        for row in sources
        if row.type not in SHIFT_SUBJECT_TYPES
    }
    motorcycles = {
        row.code: row
        for row in Motorcycle.objects.filter(organization=organization, code__in=codes)
    }
    shifts = (
        Shift.objects.filter(organization=organization)
        .select_related("motorcycle")
        .in_bulk(
            {row.shift_id for row in sources if row.type in SHIFT_SUBJECT_TYPES and row.shift_id}
        )
    )
    facts = {}
    for envelope in sources:
        values = payloads[envelope.id]
        if envelope.type in SHIFT_SUBJECT_TYPES:
            shift = shifts.get(envelope.shift_id)
            motorcycle = None if shift is None else shift.motorcycle
        else:
            motorcycle = motorcycles.get(values.get("motorcycle_code", values.get("motorcycle_id")))
        facts[envelope.id] = _motorcycle_facts(motorcycle)
    return facts


def _motorcycle_facts(motorcycle: Motorcycle | None) -> SubjectFacts:
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
