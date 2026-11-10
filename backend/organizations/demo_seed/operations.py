"""Demo fleet, quadrant assignments, task schedule and incident types (writes via services)."""

from dataclasses import dataclass

from django.utils import timezone

from catalogs.models import Catalog, CatalogItem
from core.time import local_today
from geography.models import Quadrant
from incidents.configuration import write_type
from organizations.models import Center, Membership, Organization
from scheduling.models import AssignmentVersion, ScheduledTask
from scheduling.services import AssignmentChange, change_assignment, generate_schedule
from shifts.models import Motorcycle
from shifts.services import create_motorcycle
from uploads.access import UploadActor


@dataclass(frozen=True)
class DemoIncidentType:
    code: str
    label: str
    severity: str


INCIDENT_TYPES = (
    DemoIncidentType("emergency-accident", "Accidente o emergencia", "critical"),
    DemoIncidentType("motorcycle-severe-check", "Falla grave de motocicleta", "high"),
    DemoIncidentType("access-denied", "Acceso negado en vivienda", "low"),
    DemoIncidentType("dog-aggression", "Perro agresivo", "medium"),
)
# Which courier covers which quadrant (courier username -> quadrant codes).
ASSIGNMENTS = {
    "demo-courier-1": ("Q-DEMO-01", "Q-DEMO-02"),
    "demo-courier-2": ("Q-DEMO-03",),
}
MOTORCYCLES = (("M-DEMO-01", "DEMO-001", "C-DEMO-01"), ("M-DEMO-02", "DEMO-002", "C-DEMO-02"))
SLA_SUPERVISOR_SECONDS = 900
SLA_COORDINATOR_SECONDS = 1800


def ensure_motorcycles(
    organization: Organization, centers: dict[str, Center], admin: Membership
) -> None:
    """Fleet of two motorcycles, found by code (writes Motorcycle)."""
    for code, plate, center_code in MOTORCYCLES:
        if Motorcycle.objects.filter(organization=organization, code=code).exists():
            continue
        values = {"code": code, "plate": plate, "center": centers[center_code]}
        create_motorcycle(organization, values, admin.user)


def ensure_assignments(
    quadrants: dict[str, Quadrant], couriers: dict[str, Membership], admin: Membership
) -> None:
    """Assign each quadrant to its courier once (writes AssignmentVersion)."""
    for username, codes in ASSIGNMENTS.items():
        courier = couriers[username]
        for code in codes:
            quadrant = quadrants[code]
            previous = (
                AssignmentVersion.objects.filter(quadrant=quadrant).order_by("-version").first()
            )
            if previous is not None and previous.courier_id == courier.user_id:
                continue
            revision = previous.version if previous else 0
            change_assignment(admin, AssignmentChange(quadrant.pk, courier.user_id, revision))


def ensure_schedule(organization: Organization, admin: Membership) -> None:
    """Generate this week's placing tasks once, before any ovitrap is placed (writes).

    Skipped when tasks exist: regenerating after placements would need the revisit rule to be in
    force since the start of the week, which a freshly seeded organization cannot satisfy.
    """
    if ScheduledTask.objects.filter(organization=organization).exists():
        return
    generate_schedule(admin, local_today(organization.timezone, timezone.now()))


def _type_data(
    spec: DemoIncidentType, admin: Membership, owners: dict[str, Membership]
) -> dict[str, object]:
    return {
        "code": spec.code,
        "label": spec.label,
        "severity": spec.severity,
        "terminal_id": admin.pk,
        "supervisor_id": owners["supervisor"].pk,
        "coordinator_id": owners["coordinator"].pk,
        "supervisor_sla_seconds": SLA_SUPERVISOR_SECONDS,
        "coordinator_sla_seconds": SLA_COORDINATOR_SECONDS,
        "report_evidence_min": 0,
        "close_evidence_min": 1,
        "blocker_kinds": [],
    }


def ensure_incident_types(
    organization: Organization, admin: Membership, owners: dict[str, Membership]
) -> None:
    """Configure the demo incident types; the catalog item is the identity (writes)."""
    catalog = Catalog.objects.get(organization=organization, slug="incident-type")
    actor = UploadActor(admin.user, organization)
    for spec in INCIDENT_TYPES:
        if CatalogItem.objects.filter(catalog=catalog, code=spec.code).exists():
            continue
        write_type(actor, _type_data(spec, admin, owners))
    other = CatalogItem.objects.get(catalog=catalog, is_other=True)
    if not other.incident_versions.exists():
        data = _type_data(INCIDENT_TYPES[3], admin, owners)
        write_type(
            actor,
            {key: value for key, value in data.items() if key not in {"code", "label"}},
            other.pk,
        )
