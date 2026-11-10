"""Freeze genuine B18 and inventory identities; unknown sample UUIDs fail closed."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.http import Http404

from inventory.access import scoped_inventory
from inventory.allocations.scope import require_contexts
from inventory.models import Lot, LotVersion
from lab.access import (
    LabTarget,
    PreparedLabSubject,
    prepare_lab_subject,
    reading_source_proof,
    scoped_bags,
)
from lab.exceptions import LabConflictError
from lab.samples.models import WolbachiaSample
from lab.samples.selectors import sample_contexts, sample_rows
from lab.shipments.models import ShipmentSource, UiebShipment
from lab.transactions import LabParticipants
from ovitraps.models import Bag
from reviews.effect_receipts import is_effective
from uploads.access import UploadActor


@dataclass(frozen=True)
class ShipmentSelection:
    bags: tuple[Bag, ...]
    lots: tuple[Lot, ...]
    prepared: tuple[PreparedLabSubject, ...]
    samples: tuple[WolbachiaSample, ...]
    participants: LabParticipants


def resolve_sources(actor: UploadActor, identifiers: list[UUID]) -> ShipmentSelection:
    requested = set(identifiers)
    bags = tuple(scoped_bags(actor, "shipment.create").filter(pk__in=requested).order_by("pk"))
    lots = tuple(
        scoped_inventory(Lot.objects.all(), actor, "shipment.create")
        .filter(pk__in=requested)
        .order_by("pk")
    )
    samples = tuple(sample_rows(actor, "shipment.create").filter(pk__in=requested).order_by("pk"))
    if (
        len(requested) != len(identifiers)
        or len(bags) + len(lots) + len(samples) != len(requested)
        or {row.pk for row in (*bags, *lots, *samples)} != requested
    ):
        raise Http404
    prepared = tuple(
        prepare_lab_subject(actor, LabTarget("bag", bag.pk), "shipment.create") for bag in bags
    )
    contexts = [
        {
            "center_id": str(row.center_id),
            "quadrant_id": str(row.quadrant_id) if row.quadrant_id else None,
        }
        for row in lots
    ] + [{"center_id": str(row.center_id), "quadrant_id": str(row.quadrant_id)} for row in prepared]
    contexts.extend(context for sample in samples for context in sample_contexts(sample))
    require_contexts(actor, "shipment.create", contexts)
    participants = sample_participants(samples)
    return ShipmentSelection(bags, lots, prepared, samples, participants)


def sample_participants(samples: tuple[WolbachiaSample, ...]) -> LabParticipants:
    events = {sample.event.pk: sample.event for sample in samples}
    for sample in samples:
        if sample.reading is not None:
            events[sample.reading.event_id] = sample.reading.event
    if any(event.created_by_id is None for event in events.values()):
        raise LabConflictError("shipment_source_unavailable")
    return LabParticipants(
        sources=tuple((event.pk, cast(UUID, event.created_by_id)) for event in events.values())
    )


def freeze_sources(selection: ShipmentSelection, cutoff: datetime) -> list[dict[str, Any]]:
    snapshots = []
    for sample in selection.samples:
        snapshots.append(freeze_sample(sample, cutoff))
    for bag in selection.bags:
        if bag.created_at > cutoff or not is_effective(bag.event):
            raise LabConflictError("shipment_source_unavailable")
        snapshots.append(
            {
                "kind": "bag",
                "id": str(bag.pk),
                "code": bag.code,
                **reading_source_proof(bag.reading),
            }
        )
    for lot in selection.lots:
        version = (
            LotVersion.objects.filter(lot=lot, created_at__lte=cutoff).order_by("-revision").first()
        )
        if version is None:
            raise LabConflictError("shipment_source_unavailable")
        snapshots.append(
            {
                "kind": "lot",
                "id": str(lot.pk),
                "code": lot.code,
                "version_id": str(version.pk),
                "supply_version_id": str(version.supply_version_id),
                "protocol_id": str(version.protocol_id) if version.protocol_id else None,
                "species": version.species,
                "strain": version.strain,
                "generation": version.generation,
                "laid_on": version.laid_on.isoformat() if version.laid_on else None,
                "author_id": str(version.created_by_id),
                "created_at": version.created_at.isoformat(),
            }
        )
    return sorted(snapshots, key=lambda row: row["id"])


def freeze_sample(sample: WolbachiaSample, cutoff: datetime) -> dict[str, Any]:
    source = sample.event
    if (
        sample.created_at > cutoff
        or not is_effective(source)
        or (sample.reading is not None and not is_effective(sample.reading.event))
    ):
        raise LabConflictError("shipment_source_unavailable")
    receipt = getattr(source, "review_effect_receipt", None)
    lot_version = None
    if sample.lot_id:
        lot_version = (
            LotVersion.objects.filter(lot_id=sample.lot_id, created_at__lte=cutoff)
            .order_by("-revision")
            .first()
        )
        if lot_version is None:
            raise LabConflictError("shipment_source_unavailable")
    return {
        "kind": "sample",
        "id": str(sample.pk),
        "code": sample.code,
        "source_event_id": str(source.pk),
        "payload_sha256": source.payload_sha256,
        "device_time": source.device_time.isoformat(),
        "server_received_at": source.server_received_at.isoformat(),
        "source_status": source.status,
        "rules_version": source.rules_version,
        "catalog_version": source.catalog_version,
        "origin_id": str(sample.origin_id),
        "method_version_id": str(sample.method_version_id),
        "location_id": str(sample.location_id),
        "reading_id": str(sample.reading_id) if sample.reading_id else None,
        "lot_id": str(sample.lot_id) if sample.lot_id else None,
        "lot_version_id": str(lot_version.pk) if lot_version else None,
        "collector_id": str(sample.collector_id),
        "review_effect_receipt_id": str(receipt.pk) if receipt else None,
    }


def append_sources(shipment: UiebShipment, selection: ShipmentSelection) -> None:
    for sample in selection.samples:
        ShipmentSource.objects.create(
            organization=shipment.organization,
            created_by=shipment.created_by,
            shipment=shipment,
            sample=sample,
            center_id=sample.location.center_id,
            quadrant_id=sample.location.quadrant_id,
        )
    for bag in selection.bags:
        quadrant = bag.reading.ovitrap.sampling_point.block.quadrant
        ShipmentSource.objects.create(
            organization=shipment.organization,
            created_by=shipment.created_by,
            shipment=shipment,
            bag=bag,
            center_id=quadrant.center_id,
            quadrant=quadrant,
        )
    for lot in selection.lots:
        ShipmentSource.objects.create(
            organization=shipment.organization,
            created_by=shipment.created_by,
            shipment=shipment,
            lot=lot,
            center_id=lot.center_id,
            quadrant_id=lot.quadrant_id,
        )
