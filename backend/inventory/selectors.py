"""Current immutable snapshots, SQL-filtered safety and ledger projections."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import (
    BooleanField,
    Case,
    CharField,
    Exists,
    OuterRef,
    Q,
    QuerySet,
    Subquery,
    Sum,
    Value,
    When,
)
from django.http import Http404

from core.time import server_now
from incidents.models import IncidentEvent
from inventory.access import require_scope, scoped_inventory
from inventory.models import (
    BiologicalProtocolVersion,
    ConditionBreach,
    ConditionIncidentLink,
    ConditionReading,
    InventoryRecord,
    Location,
    LocationVersion,
    Lot,
    LotVersion,
    StockMovement,
    SupplyType,
    SupplyTypeVersion,
)
from inventory.policy import BIOLOGICAL_FIELDS, LotSafety, LotSafetySnapshot, Protocol, evaluate_lot
from uploads.access import UploadActor, current_scope


def latest_versions(model: type[InventoryRecord], parent: str) -> QuerySet[Any]:
    latest = (
        model.objects.filter(**{parent: OuterRef(parent)}).order_by("-revision").values("pk")[:1]
    )
    return cast(QuerySet[Any], model.objects.filter(pk=Subquery(latest)))


def current_supply(supply: SupplyType) -> SupplyTypeVersion:
    return cast(SupplyTypeVersion, supply.versions.order_by("-revision")[0])


def current_location(location: Location) -> LocationVersion:
    return cast(LocationVersion, location.versions.order_by("-revision")[0])


def current_lot(lot: Lot) -> LotVersion:
    return cast(
        LotVersion,
        lot.versions.select_related(
            "supply_version__supply_type",
            "supply_version__protocol__incident_type",
            "protocol__incident_type",
            "initial_location",
            "location_version__location",
            "lot__organization",
            "lot__admission",
        ).order_by("-revision")[0],
    )


def protocol_snapshot(protocol: BiologicalProtocolVersion | None) -> Protocol:
    if protocol is None:
        return Protocol("", None, None, None, None, ())
    windows = tuple((int(row[0]), int(row[1])) for row in protocol.reading_windows)
    return Protocol(
        protocol.name,
        protocol.temperature_min,
        protocol.temperature_max,
        protocol.humidity_min,
        protocol.humidity_max,
        windows,
    )


def protocol_ready(protocol: BiologicalProtocolVersion | None) -> bool:
    if protocol is None:
        return False
    snapshot = protocol_snapshot(protocol)
    return (
        snapshot.has_ranges
        and len(snapshot.windows) == 2
        and bool(protocol.shelf_life_seconds)
        and protocol.expiry_basis == "laid_on"
    )


def missing_fields(version: LotVersion) -> tuple[str, ...]:
    missing = [
        name
        for name in ("quantity", "initial_location_id", "provenance")
        if not getattr(version, name)
    ]
    supply = version.supply_version
    if supply.expiry_required is None:
        missing.append("expiry_required")
    if (supply.expiry_required or supply.is_biological) and version.expires_at is None:
        missing.append("expiry")
    if supply.is_biological:
        required = set(BIOLOGICAL_FIELDS) | set(
            version.protocol.required_fields if version.protocol else []
        )
        missing.extend(sorted(field for field in required if not getattr(version, field)))
    return tuple(missing)


def unresolved_breaches(lot: Lot) -> QuerySet[ConditionBreach]:
    state = (
        IncidentEvent.objects.filter(incident_id=OuterRef("incident_link__incident_id"))
        .order_by("-revision")
        .values("state")[:1]
    )
    query: QuerySet[ConditionBreach] = (
        ConditionBreach.objects.filter(organization=lot.organization, reading__lot=lot)
        .annotate(_state=Subquery(state))
        .filter(Q(_state__isnull=True) | ~Q(_state="closed"))
    )
    return query


def daily_condition_readings(
    version: LotVersion, at: datetime, location: Location | None
) -> QuerySet[ConditionReading]:
    """Only assessed facts for the exact current pin, site and organization-local day count."""
    from zoneinfo import ZoneInfo

    organization = version.lot.organization
    readings = ConditionReading.objects.filter(
        organization=organization,
        lot=version.lot,
        protocol=version.protocol,
        local_date=at.astimezone(ZoneInfo(organization.timezone)).date(),
        timezone=organization.timezone,
        slot__isnull=False,
    ).exclude(evaluation="unassessed")
    return (
        readings.filter(
            Q(capture_location=location, capture_mode="explicit_location")
            | Q(capture_mode="legacy_initial", location_version__location=location)
        )
        if location
        else readings.none()
    )


def lot_safety(
    version: LotVersion, at: datetime | None = None, location: Location | None = None
) -> LotSafety:
    now = at or server_now()
    organization = version.lot.organization
    requested_location = location or version.initial_location
    readings = daily_condition_readings(version, now, requested_location)
    storage = current_location(requested_location) if requested_location else None
    from inventory.transfers.models import TransferHold

    holds = TransferHold.objects.filter(
        organization=organization,
        lot=version.lot,
        location=requested_location,
        resolution__isnull=True,
    )
    snapshot = LotSafetySnapshot(
        version.supply_version.is_biological,
        current_supply(version.lot.supply).is_active,
        missing_fields(version),
        version.expires_at,
        protocol_ready(version.protocol),
        version.supply_version.requires_insecticide_free,
        storage.is_insecticide_free if storage else None,
        frozenset(slot for slot in readings.values_list("slot", flat=True) if slot is not None),
        tuple(str(pk) for pk in unresolved_breaches(version.lot).values_list("pk", flat=True)),
        tuple(str(pk) for pk in holds.values_list("pk", flat=True)),
    )
    return evaluate_lot(snapshot, now)


def lot_safety_batch(
    versions: Sequence[LotVersion], location: Location | None = None
) -> dict[UUID, LotSafety]:
    """`lot_safety` for a page of lot versions with a fixed number of queries.

    Same facts and the same evaluation as the per-version function; only the reads are shared.
    Needs `lot__organization`, `supply_version`, `protocol` and `initial_location` loaded.
    """
    from zoneinfo import ZoneInfo

    from inventory.transfers.models import TransferHold

    if not versions:
        return {}
    now = server_now()
    requested = {version.pk: location or version.initial_location for version in versions}
    lot_ids = {version.lot_id for version in versions}
    location_ids = {place.pk for place in requested.values() if place is not None}
    supply_ids = {version.lot.supply_id for version in versions}
    days = {
        version.pk: now.astimezone(ZoneInfo(version.lot.organization.timezone)).date()
        for version in versions
    }
    storage = {
        row.location_id: row
        for row in LocationVersion.objects.filter(location_id__in=location_ids)
        .order_by("location_id", "-revision")
        .distinct("location_id")
    }
    supplies = {
        row.supply_type_id: row
        for row in SupplyTypeVersion.objects.filter(supply_type_id__in=supply_ids)
        .order_by("supply_type_id", "-revision")
        .distinct("supply_type_id")
    }
    readings = list(
        ConditionReading.objects.filter(
            lot_id__in=lot_ids, slot__isnull=False, local_date__in=set(days.values())
        )
        .exclude(evaluation="unassessed")
        .values(
            "lot_id",
            "protocol_id",
            "local_date",
            "timezone",
            "slot",
            "capture_mode",
            "capture_location_id",
            "location_version__location_id",
        )
    )
    holds = list(
        TransferHold.objects.filter(lot_id__in=lot_ids, resolution__isnull=True).values_list(
            "pk", "lot_id", "location_id"
        )
    )
    state = (
        IncidentEvent.objects.filter(incident_id=OuterRef("incident_link__incident_id"))
        .order_by("-revision")
        .values("state")[:1]
    )
    breaches = list(
        ConditionBreach.objects.filter(reading__lot_id__in=lot_ids)
        .annotate(_state=Subquery(state))
        .filter(Q(_state__isnull=True) | ~Q(_state="closed"))
        .values_list("pk", "reading__lot_id")
    )
    result: dict[UUID, LotSafety] = {}
    for version in versions:
        place = requested[version.pk]
        place_id = place.pk if place is not None else None
        organization = version.lot.organization
        slots = frozenset(
            row["slot"]
            for row in readings
            if place_id is not None
            and row["lot_id"] == version.lot_id
            and row["protocol_id"] == version.protocol_id
            and row["local_date"] == days[version.pk]
            and row["timezone"] == organization.timezone
            and (
                (
                    row["capture_mode"] == "explicit_location"
                    and row["capture_location_id"] == place_id
                )
                or (
                    row["capture_mode"] == "legacy_initial"
                    and row["location_version__location_id"] == place_id
                )
            )
        )
        current_storage = storage.get(place_id) if place is not None else None
        snapshot = LotSafetySnapshot(
            version.supply_version.is_biological,
            supplies[version.lot.supply_id].is_active,
            missing_fields(version),
            version.expires_at,
            protocol_ready(version.protocol),
            version.supply_version.requires_insecticide_free,
            current_storage.is_insecticide_free if current_storage else None,
            slots,
            tuple(str(pk) for pk, lot_id in breaches if lot_id == version.lot_id),
            tuple(
                str(pk)
                for pk, lot_id, held_at in holds
                if lot_id == version.lot_id and held_at == place_id
            ),
        )
        result[version.pk] = evaluate_lot(snapshot, now)
    return result


def condition_status(actor: UploadActor, target: tuple[Lot, Location | None]) -> dict[str, Any]:
    """Expose one current monitoring frame after the caller authorizes its real target pair."""
    from zoneinfo import ZoneInfo

    lot, location = target
    version = _condition_status_version(actor, target)
    now = server_now()
    timezone = version.lot.organization.timezone
    safety = lot_safety(version, now, location)
    placement = location or lot
    return {
        "lot_id": lot.pk,
        "lot_version_id": version.pk,
        "protocol_id": version.protocol_id,
        "location_id": location.pk if location else None,
        "evaluated_at": now,
        "local_date": now.astimezone(ZoneInfo(timezone)).date(),
        "timezone": timezone,
        "protocol": version.protocol,
        "is_protocol_configured": protocol_ready(version.protocol),
        "can_create_condition": current_scope(actor).allows(
            "condition.create",
            str(placement.center_id),
            str(placement.quadrant_id) if placement.quadrant_id else None,
        ),
        "slots": _condition_slots(version, (now, location)),
        "status": safety.status,
        "blocked_by": safety.blocked_by,
        "blocking_incidents": _blocking_condition_incidents(actor, lot),
    }


def _condition_status_version(
    actor: UploadActor, target: tuple[Lot, Location | None]
) -> LotVersion:
    lot, location = target
    require_scope(actor, "lot.read", location or lot)
    original = current_scope(actor).allows(
        "lot.read", str(lot.center_id), str(lot.quadrant_id) if lot.quadrant_id else None
    )
    query = lot_versions(actor, "lot.read", None if original else location)
    version = query.filter(lot=lot).first()
    if version is None:
        raise Http404
    return cast(LotVersion, version)


def _condition_slots(
    version: LotVersion, context: tuple[datetime, Location | None]
) -> list[dict[str, Any]]:
    readings = daily_condition_readings(version, *context).order_by("slot", "-device_time", "-pk")
    latest: dict[int, UUID] = {}
    for reading in readings:
        if reading.slot is not None:
            latest.setdefault(reading.slot, reading.pk)
    windows = version.protocol.reading_windows if version.protocol else []
    return [
        {
            "slot": slot,
            "window": windows[slot] if slot < len(windows) else None,
            "is_complete": slot in latest,
            "reading_id": latest.get(slot),
        }
        for slot in (0, 1)
    ]


def _blocking_condition_incidents(actor: UploadActor, lot: Lot) -> list[dict[str, Any]]:
    scope = current_scope(actor)
    links = (
        ConditionIncidentLink.objects.filter(
            organization=actor.organization,
            incident__organization=actor.organization,
            breach__in=unresolved_breaches(lot),
        )
        .select_related("incident")
        .order_by("incident__code", "incident_id")
    )
    return [
        {"id": link.incident_id, "code": link.incident.code}
        for link in links
        if all(
            scope.allows(
                permission,
                str(link.incident.center_id),
                str(link.incident.quadrant_id) if link.incident.quadrant_id else None,
            )
            for permission in ("lot.read", "incident.read")
        )
    ]


def location_stock(actor: UploadActor, location: Location) -> QuerySet[Any]:
    require_scope(actor, "location.read", location)
    from inventory.transfers.custody import scoped_legs

    query = scoped_legs(actor).filter(location=location)
    result: QuerySet[Any] = (
        query.values("lot_id", "lot__code", "lot__supply_id", "piece_id", "unit_version__unit")
        .annotate(
            quantity=Sum("quantity"),
            source_ids=ArrayAgg("operation_id", distinct=True, order_by="operation_id"),
        )
        .exclude(quantity=0)
        .order_by("lot__code", "piece_id")
    )
    return result


def location_movements(actor: UploadActor, location: Location) -> QuerySet[StockMovement]:
    require_scope(actor, "location.read", location)
    from inventory.transfers.custody import scoped_legs

    return (
        scoped_legs(actor)
        .filter(location=location)
        .select_related(
            "lot",
            "location",
            "operation",
            "unit_version",
            "operation__supply_source__event__assignment",
            "operation__supply_source__compensation__event__assignment",
            "operation__supply_source__execution__return_effect__declaration__event__assignment",
            "operation__supply_source__execution__lot_effect__location",
        )
    )


def lot_versions(
    actor: UploadActor, permission: str, location: Location | None = None
) -> QuerySet[Any]:
    """Safety annotation supports server status/expiry filters before page-number paging."""
    from zoneinfo import ZoneInfo

    now = server_now()
    today = now.astimezone(ZoneInfo(actor.organization.timezone)).date()
    query = scoped_inventory(latest_versions(LotVersion, "lot_id"), actor, permission)
    if location is not None and permission == "lot.read":
        from inventory.transfers.custody import custody_lots

        query = latest_versions(LotVersion, "lot_id").filter(organization=actor.organization)
        query = query.annotate(_custody=custody_lots(actor, "lot_id", location)).filter(
            _custody=True
        )
    storage_id = location.pk if location else OuterRef("initial_location_id")
    active = (
        SupplyTypeVersion.objects.filter(supply_type_id=OuterRef("lot__supply_id"))
        .order_by("-revision")
        .values("is_active")[:1]
    )
    safety = (
        LocationVersion.objects.filter(location_id=storage_id)
        .order_by("-revision")
        .values("is_insecticide_free")[:1]
    )
    readings = (
        ConditionReading.objects.filter(
            lot_id=OuterRef("lot_id"),
            protocol_id=OuterRef("protocol_id"),
            local_date=today,
            timezone=actor.organization.timezone,
        )
        .exclude(evaluation="unassessed")
        .filter(
            Q(capture_mode="explicit_location", capture_location_id=storage_id)
            | Q(capture_mode="legacy_initial", location_version__location_id=storage_id)
        )
    )
    holds = _breach_query()
    from inventory.transfers.models import TransferHold

    transfer_holds = TransferHold.objects.filter(
        organization=actor.organization,
        lot_id=OuterRef("lot_id"),
        location_id=storage_id,
        resolution__isnull=True,
    )
    query = query.annotate(
        _active=Subquery(active),
        _safe=Subquery(safety),
        _slot0=Exists(readings.filter(slot=0)),
        _slot1=Exists(readings.filter(slot=1)),
        _held=Exists(holds),
        _transfer_held=Exists(transfer_holds),
        _ready=Case(
            When(_protocol_configured(), then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        ),
    )
    query = query.annotate(
        **{
            f"blocker_{name}": Case(
                When(predicate, then=Value(True)), default=Value(False), output_field=BooleanField()
            )
            for name, predicate in blocker_predicates(now).items()
        }
    )
    result: QuerySet[Any] = query.annotate(
        computed_status=Case(
            When(~_metadata_complete(), then=Value("draft")),
            When(_blocked(now), then=Value("blocked")),
            default=Value("available"),
            output_field=CharField(),
        )
    ).select_related(
        "lot__supply",
        "lot__center",
        "lot__organization",
        "supply_version",
        "supply_version__supply_type",
        "supply_version__protocol__incident_type",
        "protocol",
        "protocol__incident_type",
        "initial_location",
        "location_version__location",
        "lot__admission",
    )
    return result


def _breach_query() -> QuerySet[ConditionBreach]:
    state = (
        IncidentEvent.objects.filter(incident_id=OuterRef("incident_link__incident_id"))
        .order_by("-revision")
        .values("state")[:1]
    )
    query: QuerySet[ConditionBreach] = (
        ConditionBreach.objects.filter(reading__lot_id=OuterRef("lot_id"))
        .annotate(_state=Subquery(state))
        .filter(Q(_state__isnull=True) | ~Q(_state="closed"))
    )
    return query


def _metadata_complete() -> Q:
    base = Q(
        quantity__gt=0,
        initial_location__isnull=False,
        supply_version__expiry_required__isnull=False,
    ) & ~Q(provenance="")
    expiry = Q(supply_version__expiry_required=False, supply_version__is_biological=False) | Q(
        expires_at__isnull=False
    )
    biology = (
        Q(laid_on__isnull=False, estimated_organism_count__gt=0)
        & ~Q(species="")
        & ~Q(strain="")
        & ~Q(generation="")
    )
    return base & expiry & (Q(supply_version__is_biological=False) | biology)


def _protocol_configured() -> Q:
    return Q(
        protocol__name__gt="",
        protocol__shelf_life_seconds__gt=0,
        protocol__expiry_basis="laid_on",
        protocol__temperature_min__isnull=False,
        protocol__temperature_max__isnull=False,
        protocol__humidity_min__isnull=False,
        protocol__humidity_max__isnull=False,
        protocol__reading_windows__0__isnull=False,
        protocol__reading_windows__1__isnull=False,
        protocol__reading_windows__2__isnull=True,
    )


def blocker_predicates(now: datetime) -> dict[str, Q]:
    biology = Q(supply_version__is_biological=True)
    return {
        "supply_type_inactive": Q(_active=False),
        "lot_expired": Q(expires_at__lte=now),
        "protocol_not_configured": biology & Q(_ready=False),
        "storage_safety_not_configured": biology
        & Q(supply_version__requires_insecticide_free__isnull=True),
        "insecticide_free_required": biology
        & Q(supply_version__requires_insecticide_free=True)
        & (Q(_safe=False) | Q(_safe__isnull=True)),
        "condition_slot_missing": biology & (Q(_slot0=False) | Q(_slot1=False)),
        "condition_breach": Q(_held=True),
        "transfer_discrepancy_hold": Q(_transfer_held=True),
    }


def _blocked(now: datetime) -> Q:
    predicate = Q(pk__in=[])
    for reason in blocker_predicates(now):
        predicate |= Q(**{f"blocker_{reason}": True})
    return predicate
