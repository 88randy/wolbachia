# ruff: noqa: PLR0913, ANN401 -- seed helpers pass explicit facts
"""Stock, custody and releases of the last weeks, built through the real services and sync.

The whole chain runs with a frozen clock, day by day, so every rule sees consistent times: lot
admission and condition readings, a shift opened on the phone, the courier's plan, the warehouse
release, the signed receipt, the release scheduled and recorded on the phone and the supervisor
decision. Nothing is written around the services. A few of the latest releases stay in review so
the supervisor queue has items.
"""

import random
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import Max
from django.utils import timezone

from accounts.models import Device
from catalogs.models import Catalog
from core.time import local_today
from field_sync.envelope import BatchContext, EventEnvelope, GpsFix, describe_payload
from field_sync.models import FieldEvent
from field_sync.services import sync_batch
from geography.models import Quadrant, SamplingPoint
from inventory.allocations.commands import AssignmentWrite, IntentExecution
from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
from inventory.allocations.models import OriginReleaseLine
from inventory.allocations.services import write_assignment
from inventory.conditions import ConditionCapture, record_condition
from inventory.models import ConditionReading, Lot
from organizations.demo_seed import inventory, operations, people, releases, training
from organizations.demo_seed.field import demo_id
from organizations.models import ConfigurationRevision, Membership, Organization
from releases.models import Permit, Release, ReleaseDevice
from releases.planning import schedule_release
from releases.selectors import permit_revision
from reviews.actions import ReviewDecisionRequest, decide_review
from reviews.models import ReviewItem
from scheduling.models import ScheduledTask
from shifts.models import Motorcycle, Shift
from shifts.selectors import highest_recorded_km
from uploads.access import UploadActor

WEEKS = 3  # weeks of release history before the current one
QUADRANTS = range(1, 7)
REVIEW_FROM_WEEK = 1  # the releases of this week for the quadrants below stay in review
IN_REVIEW_QUADRANTS = frozenset({4, 5, 6})
PLAN_QUANTITY = Decimal("4")
RELEASE_QUANTITY = "2"
START_ODOMETER = 8000  # above the bulk history, which is never checked
RULES_VERSION = "demo-seed"
ACCEPT_REASON = "Revisadas las fotos del traslado y la seguridad actual del lote."


@dataclass
class _Clock:
    now: datetime

    def tick(self, minutes: int = 2) -> datetime:
        self.now += timedelta(minutes=minutes)
        return self.now


@contextmanager
def frozen_clock(start: datetime) -> Iterator[_Clock]:
    """Run the real services as of `start`; `tick` moves the shared clock forward."""
    clock = _Clock(start)
    with patch("django.utils.timezone.now", lambda: clock.now):
        yield clock


def _local(day: date, at: time, zone: ZoneInfo) -> datetime:
    return datetime.combine(day, at, tzinfo=zone).astimezone(ZoneInfo("UTC"))


def lot_code(number: int) -> str:
    return "L-MER-WOLB" if number == 1 else f"L-MER-WOLB-{number:02d}"


def _owner(quadrant_code: str) -> str:
    return next(user for user, codes in operations.ASSIGNMENTS.items() if quadrant_code in codes)


@dataclass
class _Facts:
    organization: Organization
    members: dict[str, Membership]
    device: Device
    catalog_version: str
    admin: UploadActor
    quadrants: dict[str, Quadrant]
    odometers: dict[str, int]
    zone: ZoneInfo


def _send(
    facts: _Facts,
    courier: str,
    clock: _Clock,
    spec: tuple[str, str, dict[str, Any]],
    shift_id: UUID | None,
    gps: list[float] | None = None,
) -> Any:
    name, event_type, payload = spec
    now = clock.tick(1)
    user = facts.members[courier].user
    batch = BatchContext(facts.organization, user, facts.device, now, now)
    envelope = EventEnvelope(
        index=0,
        id=_event_id(name)[0],
        type=event_type,
        schema_version=1,
        device_time=now,
        payload=payload,
        payload_info=describe_payload(payload),
        rules_version=RULES_VERSION,
        catalog_version=facts.catalog_version,
        manual_capture=False,
        shift_id=shift_id,
        gps=None if gps is None else GpsFix(gps[1], gps[0], 3),
    )
    return sync_batch(batch, [envelope], None).results[0]


def _check_items(organization: Organization) -> list[dict[str, str]]:
    catalog = Catalog.objects.get(organization=organization, slug="motorcycle-check-item")
    codes = catalog.items.filter(is_active=True, is_other=False).values_list("code", flat=True)
    return [{"item": code, "result": "ok"} for code in codes]


def _record_conditions(admin: UploadActor, lots: list[Lot], day: date, zone: ZoneInfo) -> None:
    """Two in-range readings of the day for every biological lot (frozen clock = the reading)."""
    for lot in lots:
        for hour in (8, 14):
            at = _local(day, time(hour, 5), zone)
            temperature, humidity = inventory.STOCK_CONDITIONS
            with frozen_clock(at):
                record_condition(ConditionCapture(admin, lot.pk, at, temperature, humidity))


def _release(
    facts: _Facts, number: int, day: date, clock: _Clock, accept: bool, rng: random.Random
) -> None:
    """One courier day: shift, plan, warehouse release, signed receipt, release, decision."""
    organization, quadrant_code = facts.organization, f"Q-MER-{number:02d}"
    if _release_done(day, number):
        return
    courier = _owner(quadrant_code)
    courier_actor = UploadActor(facts.members[courier].user, organization, facts.device.pk)
    tag = f"{quadrant_code}:{day.isoformat()}"
    shift_id = demo_id(f"chain:shift:{tag}")
    last = FieldEvent.objects.filter(shift_id=shift_id).aggregate(last=Max("device_time"))["last"]
    if last is not None:  # resuming an interrupted day: never go back before its own events
        clock.now = max(clock.now, last + timedelta(minutes=2))
    motorcycle = operations.MOTORCYCLES[people.COURIER_USERNAMES.index(courier)][0]
    bike = Motorcycle.objects.get(organization=organization, code=motorcycle)
    odometer = max(START_ODOMETER, (highest_recorded_km(bike) or 0) + 5)
    if _stored(f"shift-open:{tag}"):  # an interrupted run already opened this shift
        opened = None
    else:
        opened = _send(
            facts,
            courier,
            clock,
            (
                f"shift-open:{tag}",
                "shift.open",
                {
                    "motorcycle_code": motorcycle,
                    "odometer_km": odometer,
                    "checks": _check_items(organization),
                },
            ),
            shift_id,
        )
        _require(opened, "accepted")
    odometer = Shift.objects.get(pk=shift_id).odometer_open_km
    lot = Lot.objects.get(organization=organization, code=lot_code(number))
    permit = Permit.objects.get(organization=organization, code=f"PERMIT-MER-{number:02d}")
    release_device = ReleaseDevice.objects.get(
        organization=organization,
        code=releases.DEVICE_CODE if number == 1 else f"RD-MER-{number:02d}",
    )
    if not _stored(f"receive:{tag}"):
        _custody(facts, courier_actor, (number, tag), lot, shift_id, clock, courier)
    point = SamplingPoint.objects.get(organization=organization, code=f"{quadrant_code}-REL-P1")
    if not _stored(f"release:{tag}"):
        planned = ScheduledTask.objects.filter(
            organization=organization, point=point, action="release", due_date=day
        ).first()
        if planned is None:  # an interrupted run may already have scheduled it
            task_id = schedule_release(
                facts.admin,
                permit.pk,
                {
                    "point_id": point.pk,
                    "courier_id": facts.members[courier].user_id,
                    "due_date": day,
                    "expected_revision": permit_revision(permit),
                },
            )["task_id"]
        else:
            task_id = planned.pk
        evidence = training._evidence(courier_actor)
        location = point.versions.order_by("-version").get().location
        payload = {
            "permit_id": str(permit.pk),
            "release_device_id": str(release_device.pk),
            "lot_id": str(lot.pk),
            "quantity": RELEASE_QUANTITY,
            "schedule_task_id": str(task_id),
            "training_version": str(training.course_version(organization).pk),
            "evidence_ids": [str(evidence)],
        }
        result = _send(
            facts, courier, clock, (f"release:{tag}", "release.record", payload), shift_id, location
        )
        _require(result, "release_transit_review_required")
    event_id = _event_id(f"release:{tag}")[0]
    decided = Release.objects.filter(declared_event_id=event_id).exists()
    if accept and not decided:
        item = ReviewItem.objects.get(field_event_id=event_id)
        decide_review(facts.admin, item.pk, ReviewDecisionRequest("accept", 0, ACCEPT_REASON))
    km = 28 + rng.randint(0, 20)
    closed = _send(
        facts,
        courier,
        clock,
        (f"shift-close:{tag}", "shift.close", {"odometer_km": odometer + km}),
        shift_id,
    )
    _require(closed, "accepted")


def _custody(
    facts: _Facts,
    courier_actor: UploadActor,
    ids: tuple[int, str],
    lot: Lot,
    shift_id: UUID,
    clock: _Clock,
    courier: str,
) -> Any:
    """Plan, warehouse release and the courier's signed receipt for one lot."""
    number, tag = ids
    version = lot.supply.versions.order_by("-revision").first()
    planned = write_assignment(
        AssignmentWrite(
            facts.admin,
            {
                "command_id": demo_id(f"chain:plan:{tag}"),
                "courier_id": facts.members[courier].user_id,
                "origin_id": lot.versions.order_by("-revision").first().initial_location_id,
                "date": clock.now.astimezone(facts.zone).date(),
                "shift_id": shift_id,
                "lines": [
                    {
                        "id": demo_id(f"chain:line:{tag}"),
                        "lot_id": lot.pk,
                        "piece_id": None,
                        "unit_version_id": version.pk,
                        "quantity": PLAN_QUANTITY,
                    }
                ],
            },
        )
    )
    assignment_id = UUID(planned.body["assignment"]["id"])
    prepared = prepare_inventory_intent(
        facts.admin,
        {
            "command_id": demo_id(f"chain:intent:{tag}"),
            "kind": "assignment_release",
            "assignment_id": assignment_id,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    executed = execute_inventory_intent(
        facts.admin,
        IntentExecution(UUID(prepared.body["intent"]["id"]), "assignment_release", assignment_id),
    )
    release_id = UUID(executed.body["release"]["id"])
    line = OriginReleaseLine.objects.get(release_id=release_id)
    payload = {
        "command_id": str(demo_id(f"chain:receive-command:{tag}")),
        "assignment_id": str(assignment_id),
        "expected_revision": 0,
        "plan_revision": 1,
        "release_id": str(release_id),
        "signature_upload_id": str(training._evidence(courier_actor)),
        "actual_lines": [
            {
                "id": str(demo_id(f"chain:receipt-line:{tag}")),
                "release_line_id": str(line.pk),
                "quantity": str(PLAN_QUANTITY),
            }
        ],
        "discrepancies": [],
    }
    result = _send(facts, courier, clock, (f"receive:{tag}", "supplies.receive", payload), shift_id)
    _require(result, "accepted")
    return result


def _require(result: Any, code: str) -> None:
    if result.code != code:
        raise RuntimeError(f"Demo custody step answered {result.code}, expected {code}")


def _release_days(today: date, after: date | None = None) -> list[tuple[date, int, bool]]:
    """(day, quadrant number, accepted) for each release, oldest first; none on or before `after`."""
    rows = []
    for weeks_ago in range(WEEKS, 0, -1):
        day = today - timedelta(days=7 * weeks_ago)
        day -= timedelta(days=(day.weekday() - 2) % 7)  # the Wednesday of that week
        if after is not None and day <= after:
            continue
        for number in QUADRANTS:
            waiting = weeks_ago == REVIEW_FROM_WEEK and number in IN_REVIEW_QUADRANTS
            rows.append((day, number, not waiting))
    return rows


def _tag(number: int, day: date) -> str:
    return f"Q-MER-{number:02d}:{day.isoformat()}"


def _event_id(name: str) -> tuple[UUID, bool]:
    """The id of a chain event and whether it is already stored.

    A rejected event burns its id, so a resumed run retries under the next suffix.
    """
    for attempt in range(1, 5):
        candidate = name if attempt == 1 else f"{name}:retry{attempt}"
        identifier = demo_id(f"chain:{candidate}")
        stored = FieldEvent.objects.filter(pk=identifier).first()
        if stored is None or stored.status != "rejected":
            return identifier, stored is not None
    raise RuntimeError(f"Demo event {name} was rejected repeatedly")


def _stored(name: str) -> bool:
    return _event_id(name)[1]


def _release_done(day: date, number: int) -> bool:
    """Whether the shift of that release was closed, which is the last step of its chain."""
    return FieldEvent.objects.filter(pk=demo_id(f"chain:shift-close:{_tag(number, day)}")).exists()


def history_start(slug: str = people.DEMO_SLUG, tz: str = people.DEMO_TIMEZONE) -> datetime:
    """The instant the demo world "begins": people, geography and stock exist from then on.

    The supervisor's review uses the courier's authority as of the release day, so nothing can
    predate the first configuration revision of an organization seeded earlier: the start moves
    after the newest one (the history then holds fewer weeks, or none).
    """
    now = timezone.now()
    first = _release_days(local_today(tz, now))[0][0] - timedelta(days=3)
    start = _local(first, time(7, 0), ZoneInfo(tz))
    organization = Organization.objects.filter(slug=slug).first()
    if organization is not None:
        newest = ConfigurationRevision.objects.filter(organization=organization).aggregate(
            newest=Max("created_at")
        )["newest"]
        if newest is not None:
            start = max(start, newest + timedelta(hours=1))
    return min(start, now)


def ensure_stock_and_releases(
    organization: Organization,
    members: dict[str, Membership],
    quadrants: dict[str, Quadrant],
    catalog_version: str,
    device: Device,
) -> None:
    """Stock, permits, devices and certifications as of three weeks ago, then the release days
    one by one, then today's plan and release task. Safe to rerun: each step finds its rows."""
    zone = ZoneInfo(organization.timezone)
    today = local_today(organization.timezone, timezone.now())
    start = history_start(organization.slug, organization.timezone)
    admin = UploadActor(members["demo-admin"].user, organization)
    couriers = [members[name] for name in people.COURIER_USERNAMES]
    plan = _release_days(today, start.astimezone(zone).date())
    seeded = not plan or _release_done(plan[-1][0], plan[-1][1])
    with frozen_clock(start):
        stock = inventory.ensure_stock(admin, quadrants["Q-MER-01"], members["demo-warehouse"])
        inventory.ensure_transit_policies(admin)
        permit = releases.ensure_permit(organization, admin, quadrants["Q-MER-01"])
        for number in range(2, 7):
            code = f"PERMIT-MER-{number:02d}"
            releases.ensure_permit(organization, admin, quadrants[f"Q-MER-{number:02d}"], code)
        training.ensure_release_points(admin, range(1, 7))
        for number in range(2, 7):
            lot = inventory.ensure_quadrant_lot(
                admin, quadrants[f"Q-MER-{number:02d}"], members["demo-warehouse"], number
            )
            releases.ensure_release_device(organization, admin, lot, f"RD-MER-{number:02d}")
        releases.ensure_release_device(organization, admin, stock.lots["S-MER-WOLB"])
        training.ensure_certifications(admin, quadrants["Q-MER-01"], couriers)
        for number in range(2, 7):
            code = f"Q-MER-{number:02d}"
            owner = [members[_owner(code)]]
            training.ensure_certifications(admin, quadrants[code], owner)
    if not seeded:
        _history(organization, members, quadrants, catalog_version, device, (today, zone, start))
    inventory.ensure_transit_policies(admin)
    _today_conditions(admin, organization)
    inventory.ensure_courier_plan(admin, members["demo-courier-1"], stock)
    for name in people.COURIER_USERNAMES[1:]:
        inventory.ensure_courier_plan(admin, members[name], stock, biological=False)
    training.ensure_release_task(admin, permit, couriers[0])


def _history(
    organization: Organization,
    members: dict[str, Membership],
    quadrants: dict[str, Quadrant],
    catalog_version: str,
    device: Device,
    when: tuple[date, ZoneInfo, datetime],
) -> None:
    today, zone, start = when
    admin = UploadActor(members["demo-admin"].user, organization)
    facts = _Facts(organization, members, device, catalog_version, admin, quadrants, {}, zone)
    lots = list(Lot.objects.filter(organization=organization, code__startswith="L-MER-WOLB"))
    rng = random.Random(358)  # noqa: S311 -- deterministic synthetic data
    plan = _release_days(today, start.astimezone(zone).date())
    day = start.astimezone(zone).date()
    while day < today:
        _record_conditions(admin, lots, day, zone)
        for release_day, number, accepted in plan:
            if release_day != day:
                continue
            start = _local(day, time(9, 0), zone) + timedelta(minutes=45 * number)
            with frozen_clock(start) as clock:
                _release(facts, number, day, clock, accepted, rng)
        day += timedelta(days=1)


def _today_conditions(admin: UploadActor, organization: Organization) -> None:
    """Today's two in-range readings for every biological lot, once."""
    now = timezone.now()
    for lot in Lot.objects.filter(organization=organization, code__startswith="L-MER-WOLB"):
        if ConditionReading.objects.filter(
            lot=lot, local_date=timezone.localdate(now, ZoneInfo(organization.timezone))
        ).exists():
            continue
        for at in (now - timedelta(minutes=2), now - timedelta(minutes=1)):
            temperature, humidity = inventory.STOCK_CONDITIONS
            record_condition(ConditionCapture(admin, lot.pk, at, temperature, humidity))
