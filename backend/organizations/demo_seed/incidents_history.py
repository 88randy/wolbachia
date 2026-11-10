"""A handful of field incidents reported and worked through the incident services (writes)."""

from dataclasses import dataclass
from unittest.mock import patch

from incidents.models import Incident
from incidents.selectors import latest_types
from incidents.services import Decision, decide, report
from organizations.demo_seed.training import _evidence
from organizations.models import Membership, Organization
from uploads.access import UploadActor


@dataclass(frozen=True)
class DemoIncident:
    courier: str
    quadrant: str
    type_code: str
    description: str
    followup: str | None  # None stays open; "comment" adds a note; "close" closes it


INCIDENTS = (
    DemoIncident(
        "demo-courier-1",
        "Q-DEMO-01",
        "access-denied",
        "El propietario no permitió el acceso al patio para revisar la ovitrampa.",
        "close",
    ),
    DemoIncident(
        "demo-courier-1",
        "Q-DEMO-02",
        "dog-aggression",
        "Perro suelto en la banqueta; se omitió el punto por seguridad del repartidor.",
        "comment",
    ),
    DemoIncident(
        "demo-courier-2",
        "Q-DEMO-03",
        "access-denied",
        "Casa cerrada durante tres visitas seguidas; el vecino indica que viajaron.",
        None,
    ),
    DemoIncident(
        "demo-courier-3",
        "Q-DEMO-04",
        "motorcycle-severe-check",
        "El freno trasero hace ruido al frenar; se pide revisión antes del siguiente turno.",
        "close",
    ),
    DemoIncident(
        "demo-courier-4",
        "Q-DEMO-05",
        "dog-aggression",
        "Perro agresivo en la entrada de la vivienda; se avisó a la promotora de la colonia.",
        None,
    ),
    DemoIncident(
        "demo-courier-5",
        "Q-DEMO-06",
        "access-denied",
        "La vecina pidió que no se vuelva a colocar la ovitrampa en el patio.",
        "comment",
    ),
    DemoIncident(
        "demo-courier-5",
        "Q-DEMO-07",
        "emergency-accident",
        "Caída leve sin lesiones graves en el cruce; se revisó la moto y se continuó la ruta.",
        "close",
    ),
    DemoIncident(
        "demo-courier-6",
        "Q-DEMO-08",
        "motorcycle-severe-check",
        "Llanta delantera con desgaste visible; pendiente de cambio.",
        None,
    ),
)
CLOSE_TEXT = "Atendida con el repartidor; se verificó en campo y no requiere más acciones."
COMMENT_TEXT = "Seguimiento acordado con el repartidor; se revisará en la siguiente ruta."


def _latest_revision(incident: Incident) -> int:
    return int(incident.events.order_by("-revision").values_list("revision", flat=True)[0])


def _follow_up(item: DemoIncident, incident: Incident, supervisor: UploadActor) -> None:
    if item.followup is None:
        return
    revision = _latest_revision(incident)
    if item.followup == "comment":
        decide(supervisor, incident.pk, Decision("comment", revision, COMMENT_TEXT))
        return
    evidence = _evidence(supervisor)
    decide(supervisor, incident.pk, Decision("close", revision, CLOSE_TEXT, (evidence,)))


def ensure_incidents(
    organization: Organization,
    members: dict[str, Membership],
    quadrants: dict[str, object],
) -> int:
    """Report the demo incidents once; the notice task is not queued (no broker needed)."""
    if Incident.objects.filter(organization=organization).exists():
        return 0
    versions = {
        version.item.code: version for version in latest_types(organization).select_related("item")
    }
    supervisor = UploadActor(members["demo-supervisor"].user, organization)
    with patch("incidents.tasks.publish_incident_notices.delay", lambda *_args: None):
        for item in INCIDENTS:
            quadrant = quadrants[item.quadrant]
            actor = UploadActor(members[item.courier].user, organization)
            incident = report(
                actor,
                {
                    "type_id": versions[item.type_code].pk,
                    "description": item.description,
                    "evidence_ids": [],
                    "scope": {
                        "center_id": quadrant.center_id,  # type: ignore[attr-defined]
                        "quadrant_id": quadrant.pk,  # type: ignore[attr-defined]
                    },
                },
            )
            _follow_up(item, incident, supervisor)
    return len(INCIDENTS)
