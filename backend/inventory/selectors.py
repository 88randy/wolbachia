"""Current immutable snapshots, SQL-filtered safety and ledger projections."""

from datetime import datetime
from typing import Any, cast

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

from core.time import server_now
from incidents.models import IncidentEvent
from inventory.access import require_scope, scoped_inventory
from inventory.models import (
    BiologicalProtocolVersion,
    ConditionBreach,
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
from uploads.access import UploadActor


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


def lot_safety(version: LotVersion, at: datetime | None = None) -> LotSafety:
    now = at or server_now()
    from zoneinfo import ZoneInfo

    organization = version.lot.organization
    local_date = now.astimezone(ZoneInfo(organization.timezone)).date()
    readings = ConditionReading.objects.filter(
        lot=version.lot,
        protocol=version.protocol,
        local_date=local_date,
        timezone=organization.timezone,
        slot__isnull=False,
    ).exclude(evaluation="unassessed")
    location = current_location(version.initial_location) if version.initial_location else None
    snapshot = LotSafetySnapshot(
        version.supply_version.is_biological,
        current_supply(version.lot.supply).is_active,
        missing_fields(version),
        version.expires_at,
        protocol_ready(version.protocol),
        version.supply_version.requires_insecticide_free,
        location.is_insecticide_free if location else None,
        frozenset(readings.values_list("slot", flat=True)),
        tuple(str(pk) for pk in unresolved_breaches(version.lot).values_list("pk", flat=True)),
    )
    return evaluate_lot(snapshot, now)


def location_stock(actor: UploadActor, location: Location) -> QuerySet[Any]:
    require_scope(actor, "location.read", location)
    visible = scoped_inventory(Lot.objects.all(), actor, "lot.read")
    query = scoped_inventory(
        StockMovement.objects.filter(location=location, lot__in=visible), actor, "location.read"
    )
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
    visible = scoped_inventory(Lot.objects.all(), actor, "lot.read")
    return scoped_inventory(
        StockMovement.objects.filter(
            location=location,
            lot__in=visible,
            operation__organization=actor.organization,
            operation__admission__organization=actor.organization,
        ),
        actor,
        "location.read",
    ).select_related("lot", "location", "operation", "unit_version")


def lot_versions(actor: UploadActor, permission: str) -> QuerySet[Any]:
    """Safety annotation supports server status/expiry filters before page-number paging."""
    from zoneinfo import ZoneInfo

    now = server_now()
    today = now.astimezone(ZoneInfo(actor.organization.timezone)).date()
    query = scoped_inventory(latest_versions(LotVersion, "lot_id"), actor, permission)
    active = (
        SupplyTypeVersion.objects.filter(supply_type_id=OuterRef("lot__supply_id"))
        .order_by("-revision")
        .values("is_active")[:1]
    )
    safety = (
        LocationVersion.objects.filter(location_id=OuterRef("initial_location_id"))
        .order_by("-revision")
        .values("is_insecticide_free")[:1]
    )
    readings = ConditionReading.objects.filter(
        lot_id=OuterRef("lot_id"),
        protocol_id=OuterRef("protocol_id"),
        local_date=today,
        timezone=actor.organization.timezone,
    ).exclude(evaluation="unassessed")
    holds = _breach_query()
    query = query.annotate(
        _active=Subquery(active),
        _safe=Subquery(safety),
        _slot0=Exists(readings.filter(slot=0)),
        _slot1=Exists(readings.filter(slot=1)),
        _held=Exists(holds),
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
    }


def _blocked(now: datetime) -> Q:
    predicate = Q(pk__in=[])
    for reason in blocker_predicates(now):
        predicate |= Q(**{f"blocker_{reason}": True})
    return predicate
