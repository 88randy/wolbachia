"""Immutable readings, owned holds and idempotent automatic-source recovery."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

from django.db.models import Q
from django.http import Http404

from core.exceptions import FieldValidationError
from core.snapshots import snapshot_hash
from core.time import server_now
from incidents.automatic import AutomaticIncidentCapture, create_automatic_incident
from incidents.exceptions import IncidentConfigurationUnavailableError
from incidents.selectors import latest_types
from inventory.access import require_scope
from inventory.exceptions import InventoryConflictError
from inventory.models import (
    ConditionBreach,
    ConditionIncidentLink,
    ConditionReading,
    Location,
    LocationVersion,
    Lot,
)
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
    location_id: UUID | None = None


@dataclass(frozen=True)
class _ConditionReceipt:
    organization: Organization
    received_at: datetime
    content_hash: str
    location_version: LocationVersion | None = None
    capture_mode: str = "legacy_initial"


def record_condition(command: ConditionCapture) -> ConditionReading:
    """Named legacy initial-admission adapter; explicit callers use the strict entry point."""
    if command.location_id is not None:
        raise FieldValidationError("location_id", "invalid")
    return _record_condition(command, "legacy_initial")


def record_condition_at_location(command: ConditionCapture) -> ConditionReading:
    if command.location_id is None:
        raise FieldValidationError("location_id", "required")
    return _record_condition(command, "explicit_location")


def _record_condition(command: ConditionCapture, mode: str) -> ConditionReading:
    with inventory_transaction(command.actor) as organization:
        lot = Lot.objects.filter(organization=organization, pk=command.lot_id).first()
        if lot is None:
            raise Http404
        location = _capture_location(command, lot)
        Lot.objects.select_for_update(nowait=True, no_key=True).get(pk=lot.pk)
        now = server_now()
        if command.device_time > now:
            raise FieldValidationError("device_time", "device_time_in_future")
        facts = {
            "temperature": str(command.temperature_c.normalize()),
            "humidity": str(command.humidity_pct.normalize()),
        }
        if mode == "explicit_location":
            facts["location_id"] = str(command.location_id)
        digest = snapshot_hash(facts)
        previous = _previous_capture(command, lot, location)
        if previous is not None:
            if (
                previous.temperature_c != command.temperature_c
                or previous.humidity_pct != command.humidity_pct
            ):
                raise InventoryConflictError("inventory_identity_conflict")
            return cast(ConditionReading, previous)
        return _new_reading(
            command,
            lot,
            _ConditionReceipt(
                organization, now, digest, current_location(location) if location else None, mode
            ),
        )


def _capture_location(command: ConditionCapture, lot: Lot) -> Location | None:
    if command.location_id is None:
        require_scope(command.actor, "condition.create", lot)
        return cast(Location | None, current_lot(lot).initial_location)
    location = (
        Location.objects.filter(organization=command.actor.organization, pk=command.location_id)
        .select_related("center")
        .first()
    )
    if location is None:
        raise Http404
    require_scope(command.actor, "condition.create", location)
    if not location.center.is_active:
        raise InventoryConflictError("transfer_storage_unavailable")
    return cast(Location, location)


def _previous_capture(
    command: ConditionCapture, lot: Lot, location: Location | None
) -> ConditionReading | None:
    query = ConditionReading.objects.filter(
        organization=lot.organization, lot=lot, device_time=command.device_time
    )
    if location is None:
        previous = query.filter(
            capture_mode="legacy_initial", location_version__isnull=True
        ).first()
    else:
        previous = query.filter(
            Q(capture_mode="explicit_location", capture_location=location)
            | Q(capture_mode="legacy_initial", location_version__location=location)
        ).first()
    if (
        previous is None
        and command.location_id is None
        and query.filter(capture_mode="legacy_initial").exists()
    ):
        raise InventoryConflictError("inventory_identity_conflict")
    return previous


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
        location_version=receipt.location_version,
        capture_mode=receipt.capture_mode,
        capture_location_id=receipt.location_version.location_id
        if receipt.capture_mode == "explicit_location" and receipt.location_version
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


def reading_context(reading: ConditionReading) -> Location | Lot:
    """Original captured placement proves observation scope, never custody or a latest location."""
    if reading.capture_mode == "explicit_location" and reading.capture_location is not None:
        return reading.capture_location
    if reading.location_version is not None:
        return reading.location_version.location
    return reading.lot
