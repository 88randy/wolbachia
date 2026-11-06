"""Explicit inventory producer adapter; no human incident.create grant is borrowed."""

from dataclasses import dataclass
from typing import cast
from uuid import UUID

from django.db.models import Max

from core.snapshots import snapshot_hash
from incidents.configuration import chain
from incidents.exceptions import IncidentConfigurationUnavailableError, IncidentConflictError
from incidents.models import AutomaticIncidentOrigin, Incident, IncidentBlocker, IncidentTypeVersion
from incidents.policy import next_stage
from incidents.selectors import ResourceContext, latest_types
from incidents.services import _deadline, append_event
from inventory.models import ConditionReading
from inventory.transactions import require_inventory_lock


@dataclass(frozen=True)
class AutomaticIncidentCapture:
    reading: ConditionReading
    type_id: UUID


def create_automatic_incident(capture: AutomaticIncidentCapture) -> Incident:
    """Caller owns Organization; validate the concrete persisted source before effects."""
    require_inventory_lock(capture.reading.organization_id)
    reading = (
        ConditionReading.objects.select_related("lot", "organization")
        .filter(
            pk=capture.reading.pk, organization=capture.reading.organization, evaluation="breach"
        )
        .first()
    )
    if reading is None:
        raise IncidentConflictError("automatic_source_invalid")
    existing = (
        AutomaticIncidentOrigin.objects.filter(
            organization=reading.organization,
            source_kind="inventory_condition",
            source_id=reading.pk,
        )
        .select_related("incident")
        .first()
    )
    if existing is not None:
        return cast(Incident, existing.incident)
    version = _automatic_type(AutomaticIncidentCapture(reading, capture.type_id))
    context = ResourceContext(reading.lot.center_id, reading.lot.quadrant_id, "lot", reading.lot_id)
    owners = chain(version, context)
    stage = next_stage(-1, tuple(owner is not None for owner in owners))
    incident = _identity(reading, version)
    _origin(reading, incident)
    IncidentBlocker.objects.create(
        organization=reading.organization,
        created_by=None,
        incident=incident,
        resource_kind="lot",
        resource_id=reading.lot_id,
        kind="lot_dispatch",
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
            "stage_entered_at": reading.server_received_at,
            "deadline": _deadline(version, stage, reading.server_received_at),
            "last_reminder_at": reading.server_received_at,
            "evidence_ids": [],
        },
        None,
    )
    return incident


def _automatic_type(capture: AutomaticIncidentCapture) -> IncidentTypeVersion:
    version = (
        IncidentTypeVersion.objects.filter(
            organization=capture.reading.organization, pk=capture.type_id
        )
        .select_related("organization", "item")
        .first()
    )
    if version is None:
        raise IncidentConfigurationUnavailableError
    current = latest_types(capture.reading.organization).filter(item=version.item).first()
    if (
        current is None
        or not version.is_active
        or not current.is_active
        or not version.item.is_active
        or version.report_evidence_min != 0
        or version.blocker_kinds != ["lot_dispatch"]
    ):
        raise IncidentConfigurationUnavailableError
    return cast(IncidentTypeVersion, version)


def _identity(reading: ConditionReading, version: IncidentTypeVersion) -> Incident:
    highest = (
        Incident.objects.filter(organization=reading.organization).aggregate(
            highest=Max("sequence")
        )["highest"]
        or 0
    )
    return cast(
        Incident,
        Incident.objects.create(
            organization=reading.organization,
            created_by=None,
            sequence=highest + 1,
            code=f"I-{highest + 1:06d}",
            type_version=version,
            center_id=reading.lot.center_id,
            quadrant_id=reading.lot.quadrant_id,
            device_time=reading.device_time,
            server_received_at=reading.server_received_at,
            description="Biological condition reading outside its named protocol range.",
        ),
    )


def _origin(reading: ConditionReading, incident: Incident) -> None:
    AutomaticIncidentOrigin.objects.create(
        organization=reading.organization,
        created_by=None,
        actor_kind="system",
        policy_version="inventory.v1",
        incident=incident,
        source_kind="inventory_condition",
        source_id=reading.pk,
        content_hash=snapshot_hash(
            {
                "reading": str(reading.pk),
                "content_hash": reading.content_hash,
                "protocol": str(reading.protocol_id),
            }
        ),
    )
