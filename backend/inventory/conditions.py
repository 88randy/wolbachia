"""Immutable readings, owned holds and idempotent automatic-source recovery."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

from django.http import Http404

from core.exceptions import FieldValidationError
from core.snapshots import snapshot_hash
from core.time import server_now
from incidents.automatic import AutomaticIncidentCapture, create_automatic_incident
from incidents.exceptions import IncidentConfigurationUnavailableError
from incidents.selectors import latest_types
from inventory.access import require_scope
from inventory.exceptions import InventoryConflictError
from inventory.models import ConditionBreach, ConditionIncidentLink, ConditionReading, Lot
from inventory.policy import assess_condition, reading_slot
from inventory.selectors import current_location, current_lot, protocol_ready, protocol_snapshot
from inventory.transactions import inventory_transaction, require_inventory_lock
from organizations.models import Organization
from uploads.access import UploadActor


@dataclass(frozen=True)
class ConditionCapture:
    actor: UploadActor
    lot_id: UUID
    device_time: datetime
    temperature_c: Decimal
    humidity_pct: Decimal


@dataclass(frozen=True)
class _ConditionReceipt:
    organization: Organization
    received_at: datetime
    content_hash: str


def record_condition(command: ConditionCapture) -> ConditionReading:
    with inventory_transaction(command.actor) as organization:
        lot = Lot.objects.filter(organization=organization, pk=command.lot_id).first()
        if lot is None:
            raise Http404
        require_scope(command.actor, "condition.create", lot)
        Lot.objects.select_for_update(nowait=True, no_key=True).get(pk=lot.pk)
        now = server_now()
        if command.device_time > now:
            raise FieldValidationError("device_time", "device_time_in_future")
        digest = snapshot_hash(
            {
                "temperature": str(command.temperature_c.normalize()),
                "humidity": str(command.humidity_pct.normalize()),
            }
        )
        previous = ConditionReading.objects.filter(
            organization=command.actor.organization, lot=lot, device_time=command.device_time
        ).first()
        if previous is not None:
            if previous.content_hash != digest:
                raise InventoryConflictError("inventory_identity_conflict")
            return cast(ConditionReading, previous)
        return _new_reading(command, lot, _ConditionReceipt(organization, now, digest))


def _new_reading(
    command: ConditionCapture, lot: Lot, receipt: _ConditionReceipt
) -> ConditionReading:
    version = current_lot(lot)
    if not version.supply_version.is_biological:
        raise InventoryConflictError("condition_not_applicable")
    protocol = protocol_snapshot(version.protocol)
    local_date, slot = reading_slot(protocol, command.device_time, receipt.organization.timezone)
    evaluation = (
        assess_condition(protocol, command.temperature_c, command.humidity_pct)
        if protocol_ready(version.protocol)
        else "unassessed"
    )
    reading = ConditionReading.objects.create(
        organization=receipt.organization,
        created_by=command.actor.user,
        lot=lot,
        lot_version=version,
        protocol=version.protocol,
        location_version=current_location(version.initial_location)
        if version.initial_location
        else None,
        device_time=command.device_time,
        server_received_at=receipt.received_at,
        temperature_c=command.temperature_c,
        humidity_pct=command.humidity_pct,
        local_date=local_date,
        slot=slot,
        timezone=receipt.organization.timezone,
        evaluation=evaluation,
        content_hash=receipt.content_hash,
    )
    if evaluation == "breach":
        breach = ConditionBreach.objects.create(
            organization=receipt.organization, created_by=command.actor.user, reading=reading
        )
        _link_incident(breach)
    return cast(ConditionReading, reading)


def _link_incident(breach: ConditionBreach) -> ConditionIncidentLink | None:
    require_inventory_lock(breach.organization_id)
    existing = ConditionIncidentLink.objects.filter(breach=breach).first()
    if existing is not None:
        return cast(ConditionIncidentLink, existing)
    protocol = current_lot(breach.reading.lot).protocol
    if not protocol_ready(protocol) or protocol is None or protocol.incident_type_id is None:
        return None
    pinned_type = protocol.incident_type
    if pinned_type is None:
        return None
    configured = latest_types(breach.organization).filter(item_id=pinned_type.item_id).first()
    if configured is None:
        return None
    try:
        incident = create_automatic_incident(
            AutomaticIncidentCapture(breach.reading, configured.pk)
        )
    except IncidentConfigurationUnavailableError:
        return None
    return ConditionIncidentLink.objects.create(
        organization=breach.organization,
        created_by=None,
        actor_kind="system",
        breach=breach,
        incident=incident,
    )


def reconcile_condition_incident(breach: ConditionBreach) -> ConditionIncidentLink | None:
    """Recovery takes no late account/source lock and never rewrites the original reading."""
    with inventory_transaction(organization=breach.organization):
        Lot.objects.select_for_update(nowait=True, no_key=True).get(pk=breach.reading.lot_id)
        return _link_incident(breach)
