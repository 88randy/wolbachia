"""Small authored B-08 factories; synthetic protocols never become production defaults."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from incidents.configuration import write_type
from inventory.conditions import ConditionCapture
from inventory.masters import MasterChange, revise_location, revise_supply_type
from inventory.permissions import ADMIN_CODES
from inventory.selectors import current_lot, lot_safety
from inventory.services import LotChange, revise_lot
from organizations.models import Center, all_scope
from tests.factories import CatalogFactory
from uploads.access import UploadActor

AT = datetime(2026, 11, 6, 18, tzinfo=UTC)


def allow_all(member):
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    for profile in member.profiles.all():
        profile.scope = all_scope()
        profile.save(update_fields=["scope"])


@dataclass
class InventoryContext:
    actor: object
    member: object
    profile: object
    center: object
    location: object
    supply: object
    supply_version: object
    lot: object
    version: object
    incident_type: object = None

    def safety(self):
        return lot_safety(current_lot(self.lot), AT)


def inventory_context(organization, make_member, **options):
    codes = (
        *ADMIN_CODES,
        "field.upload",
        "incident.read",
        "incident.close",
        "incident.manage_type",
        "organization.update",
        "role.update",
    )
    user, member = make_member(organization, codes)
    allow_all(member)
    profile = member.profiles.get()
    actor = UploadActor(user, organization)
    suffix = uuid4().hex[:8]
    quadrant = options.get("quadrant")
    center = (
        quadrant.center
        if quadrant
        else Center.objects.create(
            organization=organization, created_by=user, code=f"C-{suffix}", name="Synthetic center"
        )
    )
    location = revise_location(
        MasterChange(
            actor,
            {
                "code": f"LOC-{suffix}",
                "center_id": center.pk,
                "quadrant_id": quadrant.pk if quadrant else None,
                "name": "Synthetic store",
                "kind": "warehouse",
                "owner_id": member.pk,
                "geometry": {"type": "Point", "coordinates": [-99.0, 19.0]},
                "is_insecticide_free": True,
            },
        )
    ).location
    biological = options.get("biological", False)
    values = {
        "code": f"S-{suffix}",
        "label": "Synthetic supply",
        "unit": "piece",
        "identity_kind": options.get("identity_kind", "lot"),
        "is_biological": biological,
        "expiry_required": biological,
        "requires_insecticide_free": True if biological else None,
    }
    if biological:
        values["protocol"] = {
            "name": "synthetic-test-protocol",
            "shelf_life_seconds": 864000,
            "expiry_basis": "laid_on",
            "temperature_min": Decimal("10"),
            "temperature_max": Decimal("20"),
            "humidity_min": Decimal("30"),
            "humidity_max": Decimal("40"),
            "reading_windows": [[0, 720], [720, 1440]],
        }
    supply_version = revise_supply_type(MasterChange(actor, values))
    lot_values = {
        "code": f"L-{suffix}",
        "supply_id": supply_version.supply_type_id,
        "initial_location_id": location.pk,
        "quantity": Decimal(options.get("quantity", "3")),
        "provenance": "Synthetic authored receipt",
    }
    if biological:
        lot_values.update(
            species="synthetic species",
            strain="synthetic strain",
            generation="synthetic generation",
            laid_on=AT.date() - timedelta(days=1),
            estimated_organism_count=Decimal("2"),
        )
    version = revise_lot(LotChange(actor, lot_values))
    return InventoryContext(
        actor,
        member,
        profile,
        center,
        location,
        supply_version.supply_type,
        supply_version,
        version.lot,
        version,
    )


def biological_context(organization, make_member, monkeypatch, *, configured=True):
    monkeypatch.setattr("inventory.conditions.server_now", lambda: AT + timedelta(hours=1))
    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *args: None)
    context = inventory_context(organization, make_member, biological=True)
    if configured:
        configure_incident(context)
    return context


def configure_incident(context):
    CatalogFactory(organization=context.actor.organization, slug="incident-type")
    incident_type = write_type(
        context.actor,
        {
            "code": f"condition-{uuid4().hex[:8]}",
            "label": "Synthetic condition incident",
            "severity": "high",
            "terminal_id": context.member.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 60,
            "report_evidence_min": 0,
            "close_evidence_min": 1,
            "blocker_kinds": ["lot_dispatch"],
        },
    )
    context.supply_version = revise_supply_type(
        MasterChange(
            context.actor,
            {"protocol": {"incident_type_id": incident_type.pk}},
            context.supply.pk,
            context.supply_version.revision,
        )
    )
    context.version = revise_lot(
        LotChange(
            context.actor,
            {
                "observations": "Configured incident policy",
                "supply_version_id": context.supply_version.pk,
            },
            context.lot.pk,
            context.version.revision,
        )
    )
    context.incident_type = incident_type
    return incident_type


def capture(context, at, temperature, humidity):
    return ConditionCapture(
        context.actor, context.lot.pk, at, Decimal(temperature), Decimal(humidity)
    )
