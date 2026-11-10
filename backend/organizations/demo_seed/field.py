"""Demo ovitraps and readings, ingested through the real sync pipeline (writes).

An ovitrap exists only as the effect of an `ovitrap.place` field event, so the seed sends events
exactly like a phone would. Event ids are derived from stable names, so a rerun skips what exists.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid5

from django.utils import timezone

from accounts.models import Device, User
from catalogs.history import remember_catalog_snapshot
from catalogs.selectors import build_catalog_snapshot
from field_sync.envelope import BatchContext, EventEnvelope, GpsFix, describe_payload
from field_sync.models import FieldEvent
from field_sync.services import sync_batch
from geography.models import SamplingPoint
from organizations.models import Organization

NAMESPACE = UUID("6f0e2f3a-1d2b-4c5e-9a77-358358358358")
PLACED_BLOCK = "Q-DEMO-01-B1"
CHECKED_COUNT = 3
STEP_SECONDS = 90  # 130 m in 90 s is under 6 km/h, below the speed lock
BAG_PREFIX = "B-DEMO-"
GPS_ACCURACY_M = 5


def demo_id(name: str) -> UUID:
    """Stable id for a demo identity (event, ovitrap, device)."""
    return uuid5(NAMESPACE, name)


def ovitrap_qr(ovitrap_id: UUID) -> str:
    """The text a printed ovitrap QR carries (see `ovitraps.qr`)."""
    return f"wbf:1:ovitrap:{ovitrap_id}"


@dataclass(frozen=True)
class DemoOvitrap:
    point_code: str
    ovitrap_id: UUID
    has_reading: bool
    bag_code: str | None

    @property
    def qr(self) -> str:
        return ovitrap_qr(self.ovitrap_id)


@dataclass(frozen=True)
class EventSpec:
    """A phone event to send: stable name (its id), type, payload and GPS fix [lng, lat]."""

    name: str
    event_type: str
    payload: dict[str, Any]
    location: list[float]
    at: datetime


@dataclass(frozen=True)
class Visit:
    """The courier at one point at one moment."""

    point: SamplingPoint
    item: DemoOvitrap
    at: datetime


@dataclass(frozen=True)
class Sender:
    """Who sends the events and under which catalog version."""

    batch: BatchContext
    catalog_version: str


def ensure_device(organization: Organization) -> Device:
    """The synthetic phone that sends the seeded events (writes Device)."""
    return Device.objects.get_or_create(
        id=demo_id("device"),
        defaults={"organization": organization, "label": "Demo seed phone"},
    )[0]


def _send(sender: Sender, spec: EventSpec) -> None:
    event_id = demo_id(spec.name)
    stored = FieldEvent.objects.filter(pk=event_id).first()
    if stored is not None:
        if stored.status != "accepted":
            raise RuntimeError(f"Stored demo event {spec.event_type} is {stored.status}")
        return
    envelope = EventEnvelope(
        index=0,
        id=event_id,
        type=spec.event_type,
        schema_version=1,
        device_time=spec.at,
        payload=spec.payload,
        payload_info=describe_payload(spec.payload),
        rules_version="demo-seed",
        catalog_version=sender.catalog_version,
        manual_capture=False,
        gps=GpsFix(spec.location[1], spec.location[0], GPS_ACCURACY_M),
    )
    result = sync_batch(sender.batch, [envelope], None).results[0]
    if result.status != "accepted":
        raise RuntimeError(f"Demo event {spec.event_type} was not accepted: {result.code}")


def _place(sender: Sender, visit: Visit) -> None:
    point, item, at = visit.point, visit.item, visit.at
    version = point.versions.order_by("-version").get()
    payload = {
        "sampling_point_id": str(point.pk),
        "ovitrap_id": str(item.ovitrap_id),
        "supply_refs": [],
        "evidence_ids": [],
    }
    _send(sender, EventSpec(f"place:{point.code}", "ovitrap.place", payload, version.location, at))


def _check(sender: Sender, visit: Visit) -> None:
    point, item = visit.point, visit.item
    at = visit.at + timedelta(seconds=10)
    version = point.versions.order_by("-version").get()
    payload = {
        "ovitrap_id": str(item.ovitrap_id),
        "finding": "intact",
        "paddle_present": True,
        "has_eggs": True,
        "temperature_c": 24,
        "humidity_pct": 70,
        "paddle_type": "standard",
        "is_lagged": False,
        "bag_code": item.bag_code,
    }
    _send(sender, EventSpec(f"check:{point.code}", "ovitrap.check", payload, version.location, at))


def ensure_ovitraps(organization: Organization, courier: User) -> list[DemoOvitrap]:
    """Place every point of the first demo block; read the first few and bag them (writes).

    The rest stay placed and unread so the courier can scan and check them on the phone. The speed
    lock compares consecutive captures of one courier, so each point is stamped later than the
    previous one (points are about 130 m apart).
    """
    now = timezone.now()
    batch = BatchContext(organization, courier, ensure_device(organization), now, now)
    snapshot = remember_catalog_snapshot(
        organization, courier, build_catalog_snapshot(organization)
    )
    sender = Sender(batch, snapshot.version)
    points = SamplingPoint.objects.filter(organization=organization, block__code=PLACED_BLOCK)
    items = []
    for number, point in enumerate(points.order_by("code")):
        has_reading = number < CHECKED_COUNT
        bag = f"{BAG_PREFIX}{number + 1:03d}" if has_reading else None
        item = DemoOvitrap(point.code, demo_id(f"ovitrap:{point.code}"), has_reading, bag)
        at = now + timedelta(seconds=STEP_SECONDS * number)
        visit = Visit(point, item, at)
        _place(sender, visit)
        if has_reading:
            _check(sender, visit)
        items.append(item)
    return items
