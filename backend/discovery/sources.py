"""Registry of the record types that search, history and the home can reach.

Every type reuses the visibility rule of its own domain (`incidents.selectors.scoped_incidents`,
`lab.shipments.selectors.shipment_rows`, or the paired action/center/quadrant filter), so a
record that cannot be opened through its own API never appears here either.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from django.db.models import Q, QuerySet

from geography.models import Quadrant, SamplingPoint
from geography.permissions import QUADRANT_READ
from incidents.permissions import INCIDENT_READ
from incidents.selectors import scoped_incidents
from lab.shipments.selectors import shipment_rows
from organizations.models import Membership
from organizations.scope import EffectiveScope
from organizations.selectors import filter_by_scope
from shifts.models import Motorcycle
from shifts.permissions import MOTORCYCLE_READ
from uploads.access import UploadActor

SHIPMENT_READ = "shipment.read"


@dataclass(frozen=True)
class RecordSource:
    """A searchable type: its read permission, its visible rows and how a void is recognized."""

    type: str
    permission: str
    rows: Callable[[Membership, EffectiveScope], QuerySet[Any]]
    voided: Q | None = None


def _scoped(model: Any, permission: str) -> Callable[[Membership, EffectiveScope], QuerySet[Any]]:  # noqa: ANN401
    def rows(member: Membership, effective: EffectiveScope) -> QuerySet[Any]:
        base = model.objects.filter(organization=member.organization)
        return filter_by_scope(base, effective, permission)

    return rows


def _incident_rows(member: Membership, effective: EffectiveScope) -> QuerySet[Any]:
    return scoped_incidents(member, INCIDENT_READ)


def _shipment_rows(member: Membership, effective: EffectiveScope) -> QuerySet[Any]:
    actor = UploadActor(member.user, member.organization)
    return shipment_rows(actor, SHIPMENT_READ)


SOURCES: tuple[RecordSource, ...] = (
    RecordSource("incident", INCIDENT_READ, _incident_rows, Q(state="voided")),
    RecordSource(
        "motorcycle",
        MOTORCYCLE_READ,
        _scoped(Motorcycle, MOTORCYCLE_READ),
        Q(voided_at__isnull=False),
    ),
    RecordSource("quadrant", QUADRANT_READ, _scoped(Quadrant, QUADRANT_READ)),
    RecordSource("sampling_point", QUADRANT_READ, _scoped(SamplingPoint, QUADRANT_READ)),
    RecordSource("shipment", SHIPMENT_READ, _shipment_rows, Q(void__isnull=False)),
)
SOURCE_BY_TYPE = {source.type: source for source in SOURCES}
RECORD_TYPES = tuple(SOURCE_BY_TYPE)
