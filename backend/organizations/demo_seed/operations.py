"""Demo fleet, quadrant assignments, task schedule and incident types (writes via services)."""

from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from accounts.models import User
from catalogs.models import Catalog, CatalogItem
from core.time import local_today
from geography.models import Quadrant
from incidents.configuration import write_type
from organizations.models import Center, Membership, Organization
from rules.models import RuleParameter, RuleParameterVersion
from scheduling.models import AssignmentVersion
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
    "demo-courier-1": ("Q-MER-01", "Q-MER-02"),
    "demo-courier-2": ("Q-MER-03",),
    "demo-courier-3": ("Q-MER-04",),
    "demo-courier-4": ("Q-MER-05",),
    "demo-courier-5": ("Q-MER-06", "Q-MER-07"),
    "demo-courier-6": ("Q-MER-08",),
}
# code, plate (synthetic) and center; motorcycle N is ridden by courier N in the history.
MOTORCYCLES = (
    ("M-DEMO-01", "YY-1021-A", "C-DEMO-01"),
    ("M-DEMO-02", "YY-1022-A", "C-DEMO-02"),
    ("M-DEMO-03", "YY-1023-A", "C-DEMO-01"),
    ("M-DEMO-04", "YY-1024-A", "C-DEMO-01"),
    ("M-DEMO-05", "YY-1025-A", "C-DEMO-02"),
    ("M-DEMO-06", "YY-1026-A", "C-DEMO-01"),
)
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
    """Generate this week's missing tasks (writes); the planner skips identities that exist."""
    _backdate_revisit_rule(organization, admin.user)
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


def _backdate_revisit_rule(organization: Organization, admin: User) -> None:
    """Make the revisit rule apply since the first demo week, so the history gets weekly checks.

    The planner evaluates the rule at each local midnight of the week; the seeded version starts
    now, which a fresh organization cannot satisfy once traps with history exist. An earlier
    version with the same value is a plain insert-only row.
    """
    parameter = RuleParameter.objects.get(organization=organization, key="revisit_interval_days")
    current = parameter.versions.order_by("effective_from").first()
    start = timezone.now() - timedelta(days=90)
    if current is None or current.effective_from <= start:
        return
    RuleParameterVersion.objects.create(
        organization=organization,
        created_by=admin,
        parameter=parameter,
        value=current.value,
        effective_from=start,
        effective_date=local_today(organization.timezone, start),
        reason="Demo seed: rule in force since the first demo week",
    )
