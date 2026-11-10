# ruff: noqa: PLR0913, ANN401 -- seed helpers pass explicit row facts
"""Eight weeks of synthetic field history: shifts, fuel, ovitrap placements, readings and bags.

The events are written as accepted rows with the ORM in one transaction, exactly the shape the sync
pipeline stores (a `FieldEvent` plus its effect rows), because the pipeline refuses captures dated
in the past. Rows stay insert-only and carry the organization; nothing is edited or deleted. Ids
come from stable names, so a rerun finds the first event and writes nothing.
"""

import hashlib
import json
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from accounts.models import Device
from core.time import epi_week_label, local_today
from field_sync.models import FieldEvent
from fleet.models import EfficiencyStatus, FuelLoad
from geography.models import SamplingPoint
from organizations.demo_seed import operations
from organizations.demo_seed.field import demo_id
from organizations.models import Membership, Organization
from ovitraps.models import Bag, Ovitrap, OvitrapReading, PlacementAttempt
from rules.selectors import list_parameters_with_current, to_number
from shifts.models import Motorcycle, Shift

WEEKS = 8  # weeks of readings before the current week
SEED = 358
SKIPPED_BLOCK = "Q-DEMO-01-B1"  # placed live through the sync pipeline, on the phone
RULES_VERSION = "demo-seed"
LOCAL_START = time(8, 0)
PRICE_PER_LITRE = Decimal("24.30")
BASE_ODOMETER = 1800

# Eggs seasonality, from week 8 (mid September) to week 1 (early November): the rainy season peaks
# in early October and fades towards the dry months.
POSITIVITY_BY_WEEK = {8: 0.70, 7: 0.75, 6: 0.80, 5: 0.78, 4: 0.72, 3: 0.64, 2: 0.57, 1: 0.50}
MEAN_EGGS_BY_WEEK = {8: 58, 7: 68, 6: 78, 5: 73, 4: 64, 3: 53, 2: 45, 1: 38}
ZONE_FACTOR = {
    "Q-DEMO-01": 0.80,
    "Q-DEMO-02": 0.85,
    "Q-DEMO-03": 1.25,
    "Q-DEMO-04": 1.15,
    "Q-DEMO-05": 0.90,
    "Q-DEMO-06": 1.00,
    "Q-DEMO-07": 0.75,
    "Q-DEMO-08": 1.10,
}
# (finding code, share). Findings without a paddle leave no bag.
FINDINGS = (
    ("intact", 0.90),
    ("dry", 0.03),
    ("damaged", 0.01),
    ("closed-house", 0.04),
    ("absent", 0.02),
)
WITHOUT_PADDLE = frozenset({"closed-house", "absent"})


@dataclass
class VisitPlan:
    """One ovitrap visit: a point on a day, either the placement or a weekly reading."""

    point: SamplingPoint
    courier: str
    day: date
    weeks_ago: int  # 9 = placement
    at: datetime | None = None


@dataclass
class HistoryResult:
    shifts: int
    ovitraps: int
    readings: int
    bags: int
    fuel_loads: int
    events: int


def _utc(day: date, at: time, zone: ZoneInfo) -> datetime:
    return datetime.combine(day, at, tzinfo=zone).astimezone(ZoneInfo("UTC"))


def _sha(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def _courier_by_quadrant() -> dict[str, str]:
    return {code: user for user, codes in operations.ASSIGNMENTS.items() for code in codes}


def _rule_snapshot(organization: Organization) -> tuple[dict[str, Any], dict[str, str]]:
    rows = list(
        list_parameters_with_current(organization, timezone.now()).values(
            "key", "value_type", "current_value", "current_version_id"
        )
    )
    values = {
        row["key"]: None
        if row["current_value"] is None
        else to_number(row["value_type"], row["current_value"])
        for row in rows
    }
    versions = {
        row["key"]: str(row["current_version_id"])
        for row in rows
        if row["current_version_id"] is not None
    }
    return values, versions


def _plan_visits(points: list[SamplingPoint], today: date, rng: random.Random) -> list[VisitPlan]:
    """Each point keeps its weekday (Monday to Friday); a point is read once per week."""
    owner = _courier_by_quadrant()
    plans = []
    for point in points:
        courier = owner[point.block.quadrant.code]
        shift_days = rng.choice((-3, -2, -1, 0, 0, 1))  # today-7k-d: Fri .. Mon when today is Tue
        for weeks_ago in range(WEEKS + 1, 0, -1):
            day = today - timedelta(days=7 * weeks_ago + shift_days)
            if day.weekday() > 4:  # keep field days on weekdays
                day -= timedelta(days=day.weekday() - 4)
            plans.append(VisitPlan(point, courier, day, weeks_ago))
    return plans


def _pick_finding(rng: random.Random) -> str:
    roll, total = rng.random(), 0.0
    for code, share in FINDINGS:
        total += share
        if roll <= total:
            return code
    return "intact"


def _egg_count(zone: float, point_factor: float, weeks_ago: int, rng: random.Random) -> int:
    mean = MEAN_EGGS_BY_WEEK[weeks_ago] * zone * point_factor
    return max(3, min(420, int(rng.gauss(mean, mean * 0.35))))


class _Writer:
    """Collects the rows of every table and inserts them together."""

    def __init__(self, organization: Organization, device: Device, catalog: dict[str, Any]) -> None:
        self.organization = organization
        self.device = device
        self.catalog_version = catalog["version"]
        self.items = {
            (catalog_entry["slug"], item["code"]): item
            for catalog_entry in catalog["catalogs"]
            for item in catalog_entry["items"]
        }
        self.rules, self.rule_versions = _rule_snapshot(organization)
        self.events: list[FieldEvent] = []
        self.ovitraps: list[Ovitrap] = []
        self.placements: list[PlacementAttempt] = []
        self.readings: list[OvitrapReading] = []
        self.bags: list[Bag] = []
        self.shifts: list[Shift] = []
        self.fuel_loads: list[FuelLoad] = []

    def event(
        self, name: str, event_type: str, payload: dict[str, Any], **fields: Any
    ) -> FieldEvent:  # noqa: ANN401
        at: datetime = fields.pop("at")
        received: datetime = fields.pop("received")
        courier = fields.pop("courier")
        gps: list[float] | None = fields.pop("gps", None)
        row = FieldEvent(
            id=demo_id(name),
            organization=self.organization,
            created_by=courier,
            type=event_type,
            schema_version=1,
            payload=payload,
            payload_sha256=_sha(payload),
            device=self.device,
            shift_id=fields.pop("shift_id", None),
            device_time=at,
            server_received_at=received,
            clock_skew_seconds=0,
            gps_lng=None if gps is None else gps[0],
            gps_lat=None if gps is None else gps[1],
            gps_accuracy_m=None if gps is None else 6.0,
            rules_version=RULES_VERSION,
            catalog_version=self.catalog_version,
            manual_capture=False,
            status="accepted",
            status_code="accepted",
            status_params={},
            is_final_upload=True,
        )
        self.events.append(row)
        return row

    def flush(self) -> None:
        FieldEvent.objects.bulk_create(self.events)
        Ovitrap.objects.bulk_create(self.ovitraps)
        PlacementAttempt.objects.bulk_create(self.placements)
        OvitrapReading.objects.bulk_create(self.readings)
        Bag.objects.bulk_create(self.bags)
        Shift.objects.bulk_create(self.shifts)
        FuelLoad.objects.bulk_create(self.fuel_loads)


@dataclass
class _Fleet:
    """Odometer and fuel state of one motorcycle while the history is built forwards in time."""

    motorcycle: Motorcycle
    odometer: int
    last_full: FuelLoad | None = None
    last_fuel_week: str = ""


def _fuel_thresholds(organization: Organization) -> tuple[Decimal | None, Decimal | None]:
    rows = {
        row["key"]: row["current_value"]
        for row in list_parameters_with_current(organization, timezone.now())
        .filter(key__in=["fuel_efficiency_min_km_l", "fuel_efficiency_max_km_l"])
        .values("key", "current_value")
    }
    return rows.get("fuel_efficiency_min_km_l"), rows.get("fuel_efficiency_max_km_l")


def _visit_rows(
    writer: _Writer, plan: VisitPlan, state: dict[str, Any], shift: tuple[Any, datetime]
) -> None:
    """Event and effect rows of one visit (placement or reading)."""
    point, rng = plan.point, state["rng"]
    version = point.versions.order_by("-version").get()
    gps = [
        round(version.location[0] + rng.uniform(-0.00004, 0.00004), 6),
        round(version.location[1] + rng.uniform(-0.00004, 0.00004), 6),
    ]
    courier, shift_id = state["users"][plan.courier], shift[0]
    at = plan.at
    received = shift[1]
    ovitrap_id = demo_id(f"ovitrap:{point.code}")
    base = {"courier": courier, "at": at, "received": received, "gps": gps, "shift_id": shift_id}
    if plan.weeks_ago == WEEKS + 1:
        payload = {
            "sampling_point_id": str(point.pk),
            "ovitrap_id": str(ovitrap_id),
            "supply_refs": [],
            "evidence_ids": [],
        }
        event = writer.event(f"hist:place:{point.code}", "ovitrap.place", payload, **base)
        ovitrap = Ovitrap(
            organization=writer.organization,
            created_by=courier,
            event=event,
            client_uuid=ovitrap_id,
            sampling_point=point,
            point_version=version,
        )
        writer.ovitraps.append(ovitrap)
        writer.placements.append(
            PlacementAttempt(
                organization=writer.organization,
                created_by=courier,
                event=event,
                ovitrap=ovitrap,
                supply_refs=[],
                evidence_ids=[],
                evaluated_rules=writer.rules,
                rule_version_ids=writer.rule_versions,
            )
        )
        state["ovitraps"][point.code] = ovitrap
        return
    _reading_rows(writer, plan, state, base)


def _reading_rows(
    writer: _Writer, plan: VisitPlan, state: dict[str, Any], base: dict[str, Any]
) -> None:
    point, rng, organization = plan.point, state["rng"], writer.organization
    zone = ZONE_FACTOR[point.block.quadrant.code]
    point_factor = hotspot_factor(point.code)
    finding_code = _pick_finding(rng)
    has_paddle = finding_code not in WITHOUT_PADDLE
    positive = rng.random() < min(0.95, POSITIVITY_BY_WEEK[plan.weeks_ago] * zone * point_factor)
    has_eggs = positive if has_paddle else None
    bag_code = None
    if has_paddle:
        week = epi_week_label(plan.day, organization.epi_week).replace("-", "")
        state["bag_number"] += 1
        bag_code = f"B-{week}-{state['bag_number']:04d}"
    payload = {
        "ovitrap_id": str(demo_id(f"ovitrap:{point.code}")),
        "finding": finding_code,
        "paddle_present": has_paddle,
        "has_eggs": has_eggs,
        "temperature_c": round(rng.uniform(26.5, 32.0), 1),
        "humidity_pct": round(rng.uniform(62, 86), 0),
        "paddle_type": "standard" if has_paddle else None,
        "is_lagged": False,
        "bag_code": bag_code,
    }
    event = writer.event(
        f"hist:check:{point.code}:{plan.weeks_ago}", "ovitrap.check", payload, **base
    )
    finding = writer.items[("ovitrap-finding", finding_code)]
    paddle = writer.items[("paddle-type", "standard")] if has_paddle else None
    reading = OvitrapReading(
        organization=organization,
        created_by=base["courier"],
        event=event,
        ovitrap=state["ovitraps"][point.code],
        point_version=point.versions.order_by("-version").get(),
        finding_id=finding["id"],
        finding_code=finding_code,
        finding_label={"es-MX": finding["label_es"], "en": finding["label_en"]},
        other_text="",
        paddle_present=has_paddle,
        has_eggs=has_eggs,
        temperature_c=payload["temperature_c"],
        humidity_pct=payload["humidity_pct"],
        paddle_type_id=None if paddle is None else paddle["id"],
        is_lagged=False,
        is_index_excluded=False,
        index_exclusion_reason="",
        epi_week=epi_week_label(plan.day, organization.epi_week),
        evaluated_rules=writer.rules,
        rule_version_ids=writer.rule_versions,
    )
    writer.readings.append(reading)
    if has_paddle:
        writer.bags.append(
            Bag(
                organization=organization,
                created_by=base["courier"],
                event=event,
                code=bag_code,
                reading=reading,
                collector=base["courier"],
                field_flags={"has_eggs": has_eggs, "is_lagged": False, "is_index_excluded": False},
            )
        )


def _shift_rows(
    writer: _Writer, courier_name: str, day: date, plans: list[VisitPlan], state: dict[str, Any]
) -> None:
    """One closed shift of a courier-day with its visits, odometer and, on the first day of an
    epi week, a fuel load."""
    rng, zone = state["rng"], state["zone"]
    users, fleet = state["users"], state["fleet"][courier_name]
    courier = users[courier_name]
    opened = _utc(day, LOCAL_START, zone) + timedelta(minutes=rng.randint(0, 20))
    clock = opened + timedelta(minutes=40)
    for plan in sorted(plans, key=lambda item: item.point.code):
        plan.at = clock
        clock += timedelta(minutes=rng.randint(11, 24))
    closed = clock + timedelta(minutes=rng.randint(15, 40))
    received = closed + timedelta(minutes=rng.randint(2, 9))
    shift_id = demo_id(f"hist:shift:{courier_name}:{day.isoformat()}")
    km = 38 + 3 * len(plans) + rng.randint(0, 14)
    odometer_open, odometer_close = fleet.odometer, fleet.odometer + km
    fleet.odometer = odometer_close + rng.randint(0, 3)
    motorcycle = fleet.motorcycle
    base = {"courier": courier, "shift_id": shift_id, "received": received}
    opened_event = writer.event(
        f"hist:shift-open:{shift_id}",
        "shift.open",
        {
            "motorcycle_code": motorcycle.code,
            "odometer_km": odometer_open,
            "checks": [],
            "note": "",
        },
        at=opened,
        **base,
    )
    for plan in plans:
        _visit_rows(writer, plan, state, (shift_id, received))
    closed_event = writer.event(
        f"hist:shift-close:{shift_id}",
        "shift.close",
        {"odometer_km": odometer_close, "note": ""},
        at=closed,
        **base,
    )
    writer.shifts.append(
        Shift(
            id=shift_id,
            organization=writer.organization,
            created_by=courier,
            courier=courier,
            device=writer.device,
            motorcycle=motorcycle,
            status="closed",
            opened_at_device=opened,
            opened_event=opened_event,
            odometer_open_km=odometer_open,
            closed_at_device=closed,
            closed_event=closed_event,
            odometer_close_km=odometer_close,
        )
    )
    week = epi_week_label(day, writer.organization.epi_week)
    if fleet.last_fuel_week != week and day.weekday() in (0, 1):
        when = (shift_id, opened + timedelta(minutes=12), received)
        _fuel_rows(writer, state, courier_name, when, odometer_open)
        fleet.last_fuel_week = week


def _fuel_rows(
    writer: _Writer,
    state: dict[str, Any],
    courier_name: str,
    when: tuple[Any, datetime, datetime],
    odometer: int,
) -> None:
    shift_id, at, received = when
    rng, fleet = state["rng"], state["fleet"][courier_name]
    motorcycle, courier = fleet.motorcycle, state["users"][courier_name]
    previous = fleet.last_full
    efficiency = Decimal(str(round(rng.uniform(31.0, 39.0), 2)))
    if previous is None:
        litres, ratio, status = Decimal("6.500"), None, EfficiencyStatus.UNAVAILABLE
    else:
        distance = Decimal(odometer - previous.odometer_km)
        litres = (distance / efficiency).quantize(Decimal("0.001"))
        ratio, status = (distance / litres).quantize(Decimal("0.000001")), EfficiencyStatus.OK
    amount = (litres * PRICE_PER_LITRE).quantize(Decimal("0.01"))
    payload = {
        "motorcycle_id": motorcycle.code,
        "litres": str(litres),
        "amount": str(amount),
        "currency": "MXN",
        "odometer_km": odometer,
        "receipt_upload_id": None,
        "is_full_refill": True,
    }
    event = writer.event(
        f"hist:fuel:{shift_id}",
        "fuel.load",
        payload,
        courier=courier,
        at=at,
        received=received,
        shift_id=shift_id,
    )
    minimum, maximum = state["fuel_limits"]
    load = FuelLoad(
        organization=writer.organization,
        created_by=courier,
        event=event,
        shift_id=shift_id,
        motorcycle=motorcycle,
        litres=litres,
        amount=amount,
        currency="MXN",
        odometer_km=odometer,
        receipt_upload_id=None,
        receipt_pending=False,
        is_full_refill=True,
        efficiency_km_l=ratio,
        efficiency_status=status,
        threshold_min=minimum,
        threshold_max=maximum,
        rule_provenance={},
        baseline=previous,
        provisional=False,
    )
    writer.fuel_loads.append(load)
    fleet.last_full = load


def hotspot_factor(point_code: str) -> float:
    """How favourable a point is for the mosquito; stable per point, so lab counts can reuse it."""
    return random.Random(f"{SEED}:{point_code}").choice((0.55, 0.8, 1.0, 1.0, 1.2, 1.5))  # noqa: S311


def already_seeded(organization: Organization) -> bool:
    """A closed shift exists only after the history ran (the phone's shifts are never closed)."""
    return Shift.objects.filter(organization=organization, status="closed").exists()


def ensure_history(
    organization: Organization,
    members: dict[str, Membership],
    device: Device,
    catalog: dict[str, Any],
) -> HistoryResult:
    """Insert the history once and return what was written (all zero on a rerun)."""
    if already_seeded(organization):
        return HistoryResult(0, 0, 0, 0, 0, 0)
    rng = random.Random(SEED)  # noqa: S311 -- deterministic synthetic data
    zone = ZoneInfo(organization.timezone)
    today = local_today(organization.timezone, timezone.now())
    points = list(
        SamplingPoint.objects.filter(organization=organization)
        .exclude(block__code=SKIPPED_BLOCK)
        .select_related("block__quadrant")
        .order_by("code")
    )
    fleets = {
        username: _Fleet(
            Motorcycle.objects.get(organization=organization, code=operations.MOTORCYCLES[i][0]),
            BASE_ODOMETER + 230 * i,
        )
        for i, username in enumerate(operations.ASSIGNMENTS)
    }
    state: dict[str, Any] = {
        "rng": rng,
        "zone": zone,
        "users": {name: member.user for name, member in members.items()},
        "fleet": fleets,
        "fuel_limits": _fuel_thresholds(organization),
        "ovitraps": {},
        "bag_number": 0,
    }
    writer = _Writer(organization, device, catalog)
    by_day: dict[tuple[date, str], list[VisitPlan]] = {}
    for plan in _plan_visits(points, today, rng):
        by_day.setdefault((plan.day, plan.courier), []).append(plan)
    with transaction.atomic():
        for (day, courier_name), plans in sorted(by_day.items()):
            _shift_rows(writer, courier_name, day, plans, state)
        writer.flush()
    return HistoryResult(
        len(writer.shifts),
        len(writer.ovitraps),
        len(writer.readings),
        len(writer.bags),
        len(writer.fuel_loads),
        len(writer.events),
    )
