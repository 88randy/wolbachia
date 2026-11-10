"""Demo storage location, supply types, lots, readings and the courier's supply plan (writes)."""

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid5

from django.utils import timezone

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

LOCATION_CODE = "LOC-DEMO-01"
HOME_QUADRANT = "Q-DEMO-01"
STOCK_CONDITIONS = (Decimal("15"), Decimal("35"))  # inside the demo protocol's ranges


@dataclass(frozen=True)
class SupplySpec:
    code: str
    label: str
    quantity: str
    biological: bool = False
    courier_quantity: str = "0"


SUPPLIES = (
    SupplySpec("S-DEMO-PADDLE", "Demo egg paddles", "400", courier_quantity="40"),
    SupplySpec("S-DEMO-BAG", "Demo sample bags", "400", courier_quantity="40"),
    SupplySpec("S-DEMO-WOLB", "Demo Wolbachia eggs", "50", biological=True, courier_quantity="10"),
)


@dataclass(frozen=True)
class DemoStock:
    location: Location
    lots: dict[str, Lot]


def _ensure_location(actor: UploadActor, quadrant: Quadrant, owner: Membership) -> Location:
    existing = Location.objects.filter(organization=actor.organization, code=LOCATION_CODE).first()
    if existing is not None:
        return existing
    version = revise_location(
        MasterChange(
            actor,
            {
                "code": LOCATION_CODE,
                "center_id": quadrant.center_id,
                "quadrant_id": quadrant.pk,
                "name": "Demo warehouse",
                "kind": "warehouse",
                "owner_id": owner.pk,
                "geometry": {"type": "Point", "coordinates": [-99.137, 19.403]},
                "is_insecticide_free": True,
            },
        )
    )
    return version.location


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
            "shelf_life_seconds": 30 * 86400,
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


def _lot_values(spec: SupplySpec, supply: SupplyType, location: Location) -> dict[str, Any]:
    values: dict[str, Any] = {
        "code": f"L-{spec.code.removeprefix('S-')}",
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
            laid_on=timezone.localdate(),
            estimated_organism_count=Decimal("5000"),
        )
    return values


def _ensure_lot(actor: UploadActor, spec: SupplySpec, location: Location) -> Lot:
    supply = SupplyType.objects.get(organization=actor.organization, code=spec.code)
    values = _lot_values(spec, supply, location)
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


def ensure_courier_plan(actor: UploadActor, courier: Membership, stock: DemoStock) -> None:
    """Plan today supplies for the courier; the command id makes a rerun a replay (writes)."""
    lines = []
    for spec in SUPPLIES:
        lot = stock.lots[spec.code]
        version = lot.supply.versions.order_by("-revision").first()
        if version is None:
            continue
        line_id = uuid5(NAMESPACE, f"assignment-line:{spec.code}")
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
        "command_id": uuid5(NAMESPACE, "assignment-command"),
        "courier_id": courier.user_id,
        "origin_id": stock.location.pk,
        "date": timezone.localdate(),
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
