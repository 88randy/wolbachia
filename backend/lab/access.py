"""Resolve authentic source identities under current whole paired action authority."""

from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import F, QuerySet
from django.shortcuts import get_object_or_404

from core.snapshots import snapshot_hash
from lab.exceptions import LabConflictError
from organizations.selectors import filter_by_scope
from ovitraps.models import Bag, OvitrapReading
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class LabTarget:
    kind: str
    identifier: UUID


@dataclass(frozen=True)
class PreparedLabSubject:
    reading_id: UUID
    source_id: UUID
    collector_id: UUID
    bag_id: UUID | None
    center_id: UUID
    quadrant_id: UUID
    author_ids: tuple[UUID, ...] = ()


def subject_authors(bag: Bag | None, action: tuple[LabTarget, str]) -> tuple[UUID, ...]:
    """Only authentic persisted authors of facts this command can republish are prepared."""
    from lab.models import BagReceipt, EggCountAttempt, LabRejection, ReceptionDiscrepancy
    from lab.permissions import BAG_RECEIVE

    target, permission = action
    if bag is None:
        return ()
    identifiers: set[UUID] = set(
        BagReceipt.objects.filter(organization=bag.organization, bag=bag)
        .exclude(created_by__isnull=True)
        .values_list("created_by_id", flat=True)
    )
    if permission == BAG_RECEIVE:
        rows = ReceptionDiscrepancy.objects.filter(organization=bag.organization, bag=bag)
    elif target.kind in {"count", "rejection"}:
        model = EggCountAttempt if target.kind == "count" else LabRejection
        rows = model.objects.filter(organization=bag.organization, bag=bag, pk=target.identifier)
    else:
        return tuple(sorted(identifiers))
    identifiers.update(
        rows.exclude(created_by__isnull=True).values_list("created_by_id", flat=True)
    )
    return tuple(sorted(identifiers))


def scoped_readings(actor: UploadActor, permission: str) -> QuerySet[OvitrapReading]:
    rows = OvitrapReading.objects.filter(
        organization=actor.organization,
        event__organization=actor.organization,
        point_version__organization=actor.organization,
        point_version__point_id=F("ovitrap__sampling_point_id"),
        ovitrap__organization=actor.organization,
        ovitrap__event__organization=actor.organization,
        ovitrap__sampling_point__organization=actor.organization,
        ovitrap__sampling_point__block__organization=actor.organization,
        ovitrap__sampling_point__block__quadrant__organization=actor.organization,
        ovitrap__sampling_point__block__quadrant__center__organization=actor.organization,
    ).select_related("event", "ovitrap__sampling_point__block__quadrant", "point_version")
    return cast(QuerySet[OvitrapReading], filter_by_scope(rows, current_scope(actor), permission))


def scoped_bags(actor: UploadActor, permission: str) -> QuerySet[Bag]:
    readings = scoped_readings(actor, permission)
    return Bag.objects.filter(organization=actor.organization, reading__in=readings).select_related(
        "reading__event", "reading__ovitrap__sampling_point__block__quadrant", "collector", "event"
    )


def prepare_lab_subject(actor: UploadActor, target: LabTarget, action: str) -> PreparedLabSubject:
    bag = target_bag(actor, target, action)
    reading = (
        bag.reading
        if bag is not None
        else get_object_or_404(scoped_readings(actor, action), pk=target.identifier)
    )
    if reading.event.created_by_id is None or (
        bag is not None
        and (bag.event_id != reading.event_id or bag.collector_id != reading.event.created_by_id)
    ):
        raise LabConflictError("lab_source_incoherent")
    quadrant = reading.ovitrap.sampling_point.block.quadrant
    return PreparedLabSubject(
        reading.pk,
        reading.event_id,
        reading.event.created_by_id,
        None if bag is None else bag.pk,
        quadrant.center_id,
        quadrant.pk,
        subject_authors(bag, (target, action)),
    )


def target_bag(actor: UploadActor, target: LabTarget, action: str) -> Bag | None:
    bags = scoped_bags(actor, action)
    if target.kind == "reading":
        return None
    if target.kind in {"count", "rejection"}:
        from lab.models import EggCountAttempt, LabRejection

        model = EggCountAttempt if target.kind == "count" else LabRejection
        result = get_object_or_404(
            model.objects.filter(organization=actor.organization, bag__in=bags),
            pk=target.identifier,
        )
        return cast(Bag, result.bag)
    return get_object_or_404(bags, pk=target.identifier)


def reading_source_proof(reading: OvitrapReading) -> dict[str, Any]:
    source = reading.event
    point = reading.ovitrap.sampling_point
    receipt = getattr(source, "review_effect_receipt", None)
    return {
        "reading_id": str(reading.pk),
        "source_event_id": str(source.pk),
        "collector_id": str(source.created_by_id),
        "payload_sha256": source.payload_sha256,
        "device_time": source.device_time.isoformat(),
        "server_received_at": source.server_received_at.isoformat(),
        "point_id": str(point.pk),
        "point_code": point.code,
        "point_version_id": str(reading.point_version_id),
        "rule_version_ids": reading.rule_version_ids,
        "evaluated_rules": reading.evaluated_rules,
        "has_eggs": reading.has_eggs,
        "paddle_present": reading.paddle_present,
        "is_lagged": reading.is_lagged,
        "is_index_excluded": reading.is_index_excluded,
        "source_voided_at": None if source.voided_at is None else source.voided_at.isoformat(),
        "source_status": source.status,
        "source_rules_version": source.rules_version,
        "source_catalog_version": source.catalog_version,
        "review_effect": None
        if receipt is None
        else {
            "id": str(receipt.pk),
            "decision_id": str(receipt.decision_id),
            "mode": receipt.mode,
            "payload_sha256": receipt.payload_sha256,
        },
        "proof_hash": snapshot_hash({"source": str(source.pk), "hash": source.payload_sha256}),
    }
