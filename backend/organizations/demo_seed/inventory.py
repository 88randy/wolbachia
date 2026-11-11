# ruff: noqa: PLR0913 -- seed helpers pass explicit row facts
"""Demo storage location, supply types, lots, readings and the courier's supply plan (writes)."""

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid5

from django.utils import timezone

from core.time import localdate
from geography.models import Quadrant
from inventory.allocations.commands import AssignmentWrite, ConfigurationWrite
from inventory.allocations.services import write_assignment
from inventory.allocations.transit import publish_transit_configuration
from inventory.conditions import ConditionCapture, record_condition
from inventory.masters import MasterChange, revise_location, revise_supply_type
from inventory.models import Location, Lot, SupplyType
from inventory.services import LotChange, revise_lot
from organizations.demo_seed.field import NAMESPACE
from organizations.models import Membership, Organization
from uploads.access import UploadActor

LOCATION_CODE = "LOC-MER-01"
HOME_QUADRANT = "Q-MER-01"
STOCK_CONDITIONS = (Decimal("15"), Decimal("35"))  # inside the demo protocol's ranges


@dataclass(frozen=True)
class SupplySpec:
    code: str
    label: str
    quantity: str
    biological: bool = False
    courier_quantity: str = "0"


SUPPLIES = (
    SupplySpec("S-MER-PADDLE", "Paletas de oviposición", "400", courier_quantity="40"),
    SupplySpec("S-MER-BAG", "Bolsas de muestra", "400", courier_quantity="40"),
    SupplySpec("S-MER-WOLB", "Huevos con Wolbachia", "50", biological=True, courier_quantity="10"),
)


@dataclass(frozen=True)
class DemoStock:
    location: Location
    lots: dict[str, Lot]


def _ensure_location(
    actor: UploadActor,
    quadrant: Quadrant,
    owner: Membership,
    code: str = LOCATION_CODE,
    name: str = "Almacén central",
) -> Location:
    existing = Location.objects.filter(organization=actor.organization, code=code).first()
    if existing is not None:
        return _rename_location(actor, existing, name)
    version = revise_location(
        MasterChange(
            actor,
            {
                "code": code,
                "center_id": quadrant.center_id,
                "quadrant_id": quadrant.pk,
                "name": name,
                "kind": "warehouse",
                "owner_id": owner.pk,
                "geometry": {"type": "Point", "coordinates": [-89.5925, 20.9674]},
                "is_insecticide_free": True,
            },
        )
    )
    return version.location


def _rename_location(actor: UploadActor, location: Location, name: str) -> Location:
    """Older demo data named every storage point the same; give each its own name (once)."""
    current = location.versions.order_by("-revision").first()
    if current is None or location.code == LOCATION_CODE or current.name != "Almacén central":
        return location
    change = MasterChange(
        actor, {"name": name}, identifier=location.pk, expected_revision=current.revision
    )
    revise_location(change)
    return location


def _supply_values(spec: SupplySpec) -> dict[str, Any]:
    values: dict[str, Any] = {
        "code": spec.code,
        "label": spec.label,
        "unit": "piece",
        "identity_kind": "lot",
        "is_biological": spec.biological,
        "expiry_required": spec.biological,
        "requires_insecticide_free": True if spec.biological else None,
    }
    if spec.biological:
        values["protocol"] = {
            "name": "demo-protocol",
            "shelf_life_seconds": 120 * 86400,
            "expiry_basis": "laid_on",
            "temperature_min": Decimal("10"),
            "temperature_max": Decimal("20"),
            "humidity_min": Decimal("30"),
            "humidity_max": Decimal("40"),
            "reading_windows": [[0, 720], [720, 1440]],
        }
    return values


def _ensure_supply(actor: UploadActor, spec: SupplySpec) -> SupplyType:
    existing = SupplyType.objects.filter(organization=actor.organization, code=spec.code).first()
    if existing is not None:
        return existing
    return revise_supply_type(MasterChange(actor, _supply_values(spec))).supply_type


def _lot_values(
    spec: SupplySpec, supply: SupplyType, location: Location, code: str | None = None
) -> dict[str, Any]:
    values: dict[str, Any] = {
        "code": code or f"L-{spec.code.removeprefix('S-')}",
        "supply_id": supply.pk,
        "initial_location_id": location.pk,
        "quantity": Decimal(spec.quantity),
        "provenance": "Synthetic demo receipt",
    }
    if spec.biological:
        values.update(
            species="Aedes aegypti (demo)",
            strain="demo strain",
            generation="F0",
            laid_on=localdate(location.organization),
            estimated_organism_count=Decimal("5000"),
        )
    return values


def _ensure_lot(
    actor: UploadActor, spec: SupplySpec, location: Location, code: str | None = None
) -> Lot:
    supply = SupplyType.objects.get(organization=actor.organization, code=spec.code)
    values = _lot_values(spec, supply, location, code)
    existing = Lot.objects.filter(organization=actor.organization, code=values["code"]).first()
    if existing is not None:
        return existing
    lot = revise_lot(LotChange(actor, values)).lot
    if spec.biological:
        _record_stock_conditions(actor, lot)
    return lot


def _record_stock_conditions(actor: UploadActor, lot: Lot) -> None:
    """Two in-range readings so the biological lot is safe to dispatch (writes)."""
    now = timezone.now()
    for at in (now - timedelta(minutes=2), now - timedelta(minutes=1)):
        temperature, humidity = STOCK_CONDITIONS
        record_condition(ConditionCapture(actor, lot.pk, at, temperature, humidity))


def ensure_stock(actor: UploadActor, home: Quadrant, owner: Membership) -> DemoStock:
    """Location, supply types and one lot per supply, each found by code (writes)."""
    location = _ensure_location(actor, home, owner)
    lots = {}
    for spec in SUPPLIES:
        _ensure_supply(actor, spec)
        lots[spec.code] = _ensure_lot(actor, spec, location)
    return DemoStock(location, lots)


def ensure_quadrant_lot(
    actor: UploadActor, quadrant: Quadrant, owner: Membership, number: int
) -> Lot:
    """A small storage point and biological lot inside one release quadrant (writes).

    A release device, its permit and its source lot must share the quadrant, so each release
    quadrant beyond the home one gets its own.
    """
    location = _ensure_location(
        actor, quadrant, owner, f"LOC-MER-{number:02d}", f"Punto de resguardo {quadrant.code}"
    )
    spec = SupplySpec("S-MER-WOLB", "Huevos con Wolbachia", "20", biological=True)
    return _ensure_lot(actor, spec, location, f"L-MER-WOLB-{number:02d}")


def _transit_policy(actor: UploadActor, supply: SupplyType) -> None:
    version = supply.versions.order_by("-revision").first()
    if version is None:
        return
    values = {
        "supply_version_id": version.pk,
        "expected_revision": 0,
        "name": "Demo reviewed transit",
        "procedure": "Review the transit photos",
        "reference": "Synthetic demo configuration",
        "mode": "manual_evidence_review",
        "proof_roles": ["photo"],
        "is_active": True,
    }
    publish_transit_configuration(ConfigurationWrite(actor, supply.pk, values))


def ensure_courier_plan(
    actor: UploadActor, courier: Membership, stock: DemoStock, biological: bool = True
) -> None:
    """Plan today supplies for the courier; the command id makes a rerun a replay (writes)."""
    lines = []
    for spec in SUPPLIES:
        if spec.biological and not biological:
            continue  # the biological lot only covers the first couriers
        lot = stock.lots[spec.code]
        version = lot.supply.versions.order_by("-revision").first()
        if version is None:
            continue
        line_id = uuid5(NAMESPACE, f"assignment-line:{courier.user_id}:{spec.code}")
        lines.append(
            {
                "id": line_id,
                "lot_id": lot.pk,
                "piece_id": None,
                "unit_version_id": version.pk,
                "quantity": Decimal(spec.courier_quantity),
            }
        )
    if not lines or _plan_exists(actor.organization, courier):
        return
    values = {
        "command_id": uuid5(NAMESPACE, f"assignment-command:{courier.user_id}"),
        "courier_id": courier.user_id,
        "origin_id": stock.location.pk,
        "date": localdate(actor.organization),
        "shift_id": None,
        "lines": lines,
    }
    write_assignment(AssignmentWrite(actor, values))


def _plan_exists(organization: Organization, courier: Membership) -> bool:
    from inventory.allocations.models import SupplyAssignment

    return SupplyAssignment.objects.filter(
        organization=organization, courier_id=courier.user_id
    ).exists()


def ensure_transit_policies(actor: UploadActor) -> None:
    """Courier transit policy per demo supply, once (writes)."""
    from inventory.allocations.models import CourierTransitPolicyVersion

    for spec in SUPPLIES:
        supply = SupplyType.objects.get(organization=actor.organization, code=spec.code)
        if CourierTransitPolicyVersion.objects.filter(supply_version__supply_type=supply).exists():
            continue
        _transit_policy(actor, supply)


SECOND_WAREHOUSE_CODE = "LOC-MER-07"
DEMO_TRANSFER_CODE = "T-DEMO-01"


def ensure_second_warehouse(
    actor: UploadActor, quadrants: dict[str, Quadrant], owner: Membership
) -> Location:
    """A second warehouse in the other center, so there is somewhere to move material to."""
    home = quadrants[HOME_QUADRANT]
    other = next((row for row in quadrants.values() if row.center_id != home.center_id), home)
    return _ensure_location(actor, other, owner, SECOND_WAREHOUSE_CODE, "Almacén Poniente")


def ensure_demo_transfer(actor: UploadActor, stock: DemoStock, destination: Location) -> None:
    """One prepared shipment of bags from the central warehouse, waiting to be sent (writes)."""
    from inventory.transfers.commands import PrepareTransferCommand
    from inventory.transfers.models import Transfer
    from inventory.transfers.services import prepare_transfer

    if Transfer.objects.filter(organization=actor.organization, code=DEMO_TRANSFER_CODE).exists():
        return
    lot = stock.lots["S-MER-BAG"]
    version = lot.supply.versions.order_by("-revision").first()
    if version is None:
        return
    values = {
        "code": DEMO_TRANSFER_CODE,
        "origin_id": stock.location.pk,
        "destination_id": destination.pk,
        "lines": [
            {
                "lot_id": lot.pk,
                "piece_id": None,
                "unit_version_id": version.pk,
                "quantity": Decimal("20"),
            }
        ],
    }
    prepare_transfer(PrepareTransferCommand(actor, values))


def apply_inventory_additions(
    organization: Organization, members: dict[str, Membership], quadrants: dict[str, Quadrant]
) -> None:
    """Only the inventory demo additions, on an existing demo database (writes, idempotent).

    Names the storage points, adds the second warehouse and the prepared shipment. Nothing is
    created twice: each step finds its rows by code.
    """
    actor = UploadActor(members["demo-admin"].user, organization)
    owner = members["demo-warehouse"]
    home = Location.objects.get(organization=organization, code=LOCATION_CODE)
    lots = {
        spec.code: Lot.objects.get(
            organization=organization, code=f"L-{spec.code.removeprefix('S-')}"
        )
        for spec in SUPPLIES
    }
    for number in range(2, 7):
        location = Location.objects.filter(
            organization=organization, code=f"LOC-MER-{number:02d}"
        ).first()
        if location is not None:
            quadrant = quadrants[f"Q-MER-{number:02d}"]
            _rename_location(actor, location, f"Punto de resguardo {quadrant.code}")
    second = ensure_second_warehouse(actor, quadrants, owner)
    ensure_demo_transfer(actor, DemoStock(home, lots), second)
    ensure_material_mappings(actor)


MATERIAL_PER_TASK = (("place", "S-MER-PADDLE"), ("check", "S-MER-BAG"))


def ensure_material_mappings(actor: UploadActor) -> None:
    """How much material each task carries: one paddle to place a trap, one bag to check it.

    Without these the courier delivery screen cannot suggest quantities (writes, idempotent).
    """
    from inventory.allocations.models import SupplyMaterialMappingVersion
    from inventory.allocations.transit import publish_transit_configuration

    for action, supply_code in MATERIAL_PER_TASK:
        supply = SupplyType.objects.filter(
            organization=actor.organization, code=supply_code
        ).first()
        version = supply.versions.order_by("-revision").first() if supply else None
        if supply is None or version is None:
            continue
        if SupplyMaterialMappingVersion.objects.filter(
            supply_version=version, action=action
        ).exists():
            continue
        values = {
            "supply_version_id": version.pk,
            "expected_revision": 0,
            "action": action,
            "quantity": Decimal("1"),
            "reference": "Synthetic demo configuration",
            "is_active": True,
        }
        publish_transit_configuration(ConfigurationWrite(actor, supply.pk, values, mapping=True))
