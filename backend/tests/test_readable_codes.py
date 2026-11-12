"""Short human codes of shifts (JOR-0128) and releases (LIB-0042): allocation, races, backfill,
lookup by code and by id, and idempotency with field sync."""

import threading
from types import SimpleNamespace
from typing import Any

import pytest
from django.db import DatabaseError, OperationalError, connection, transaction
from rest_framework.test import APIClient

from core.exceptions import ImmutableRecordError
from organizations.code_backfill import BackfillTarget, backfill_codes
from organizations.codes import RELEASE_CODE, SHIFT_CODE, allocate_code, allocate_codes
from organizations.models import CodeCounter, Organization
from releases.models import Release
from shifts.models import Shift
from shifts.permissions import SHIFT_READ
from tests.conftest import MemberFactory
from tests.factories import MotorcycleFactory, ShiftFactory
from tests.fleet_support import grant_fleet_scope
from tests.releases_support import accept_release, release_setup
from tests.shift_support import close_event, make_check_items, open_event
from tests.sync_support import make_phone

# --- allocation -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_codes_are_sequential_per_organization_and_kind(
    org_a: Organization, org_b: Organization
) -> None:
    assert allocate_code(org_a, SHIFT_CODE) == "JOR-0001"
    assert allocate_code(org_a, SHIFT_CODE) == "JOR-0002"
    assert allocate_code(org_b, SHIFT_CODE) == "JOR-0001"
    assert allocate_code(org_a, RELEASE_CODE) == "LIB-0001"
    assert allocate_codes(org_a, SHIFT_CODE, 2) == ["JOR-0003", "JOR-0004"]


def _allocate_then_fail(organization: Organization) -> None:
    allocate_code(organization, SHIFT_CODE)
    raise RuntimeError


@pytest.mark.django_db
def test_a_rolled_back_allocation_gives_the_number_back(org_a: Organization) -> None:
    with pytest.raises(RuntimeError), transaction.atomic():
        _allocate_then_fail(org_a)
    assert allocate_code(org_a, SHIFT_CODE) == "JOR-0001"


@pytest.mark.django_db
def test_the_number_grows_past_the_padding(org_a: Organization) -> None:
    CodeCounter.objects.create(organization=org_a, kind=SHIFT_CODE.kind, last_number=9999)
    assert allocate_code(org_a, SHIFT_CODE) == "JOR-10000"


# --- races (deterministic: events and barriers, never sleeps) -------------------------------


@pytest.mark.django_db(transaction=True)
def test_a_busy_counter_answers_lock_not_available_and_the_retry_gets_the_next_number(
    org_a: Organization,
) -> None:
    # The row exists already: only the very first allocation of an organization can wait on the
    # unique index instead (bounded by the batch lock timeout), never on the counter row.
    CodeCounter.objects.create(organization=org_a, kind=SHIFT_CODE.kind)
    holding, release_lock = threading.Event(), threading.Event()
    held: list[str] = []

    def holder() -> None:
        try:
            with transaction.atomic():
                held.append(allocate_code(org_a, SHIFT_CODE))
                holding.set()
                assert release_lock.wait(15)
        finally:
            connection.close()

    thread = threading.Thread(target=holder)
    thread.start()
    try:
        assert holding.wait(15)
        # The counter row exists and is locked by the other transaction: no wait, no duplicate.
        with pytest.raises(OperationalError) as busy, transaction.atomic():
            allocate_code(org_a, SHIFT_CODE)
        assert getattr(busy.value.__cause__, "sqlstate", None) == "55P03"
    finally:
        release_lock.set()
        thread.join(timeout=15)
    assert held == ["JOR-0001"]
    with transaction.atomic():
        assert allocate_code(org_a, SHIFT_CODE) == "JOR-0002"


@pytest.mark.django_db(transaction=True)
def test_concurrent_writers_never_share_a_number_and_leave_no_gap(org_a: Organization) -> None:
    writers = 6
    barrier = threading.Barrier(writers)
    codes: list[str] = []
    guard = threading.Lock()

    def writer() -> None:
        try:
            barrier.wait(timeout=15)
            while True:
                try:
                    with transaction.atomic():
                        code = allocate_code(org_a, SHIFT_CODE)
                    break
                except OperationalError:
                    continue  # the sync pipeline answers 429; the phone retries
            with guard:
                codes.append(code)
        finally:
            connection.close()

    threads = [threading.Thread(target=writer) for _ in range(writers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    assert not any(thread.is_alive() for thread in threads)
    assert sorted(codes) == [f"JOR-{number:04d}" for number in range(1, writers + 1)]


# --- sync idempotency -----------------------------------------------------------------------


@pytest.mark.django_db
def test_a_replayed_shift_event_keeps_its_code_and_consumes_no_number(
    org_a: Organization, make_member: MemberFactory
) -> None:
    make_check_items(org_a)
    MotorcycleFactory(organization=org_a, code="M-03")
    phone = make_phone(
        lambda *args, **kwargs: grant_fleet_scope(make_member(*args, **kwargs)), org_a
    )
    opened = open_event("M-03")

    assert phone.sync([opened]).data["results"][0]["status"] == "accepted"
    assert phone.sync([opened]).data["results"][0]["status"] == "accepted"  # the replay
    assert phone.sync([close_event(opened["shift_id"])]).status_code == 200

    shift = Shift.objects.get(pk=opened["shift_id"])
    assert shift.code == "JOR-0001"
    assert CodeCounter.objects.get(organization=org_a, kind=SHIFT_CODE.kind).last_number == 1
    # The next shift of the organization continues the sequence.
    other = ShiftFactory(organization=org_a, code="JOR-0002")
    assert other.code == "JOR-0002"


@pytest.mark.django_db
def test_a_rejected_shift_open_consumes_no_number(
    org_a: Organization, make_member: MemberFactory
) -> None:
    make_check_items(org_a)
    phone = make_phone(
        lambda *args, **kwargs: grant_fleet_scope(make_member(*args, **kwargs)), org_a
    )

    result = phone.sync([open_event("NO-SUCH")]).data["results"][0]

    assert result["status"] == "rejected"
    assert not CodeCounter.objects.filter(organization=org_a, kind=SHIFT_CODE.kind).exists()


@pytest.mark.django_db(transaction=True)
def test_a_replayed_release_keeps_its_code_and_consumes_no_number(
    org_a: Organization, make_member: MemberFactory, monkeypatch: Any, settings: Any, tmp_path: Any
) -> None:
    context = release_setup(org_a, make_member, monkeypatch, settings, tmp_path)

    release = accept_release(context)
    context.phone.sync([context.capture])  # replay of the same event

    assert release.code == "LIB-0001"
    assert Release.objects.filter(organization=org_a).count() == 1
    assert CodeCounter.objects.get(organization=org_a, kind=RELEASE_CODE.kind).last_number == 1
    # The release is found by its code and by its id; the id keeps working for old links.
    client = APIClient()
    client.force_authenticate(context.phone.user)
    by_code = client.get("/api/v1/releases/", {"code": "LIB-0001"})
    assert [row["id"] for row in by_code.data["results"]] == [str(release.pk)]
    assert client.get("/api/v1/releases/", {"code": "LIB-0002"}).data["results"] == []
    by_id = client.get(f"/api/v1/releases/{release.pk}/")
    assert by_id.status_code == 200
    assert by_id.data["code"] == "LIB-0001"


# --- backfill -------------------------------------------------------------------------------


@pytest.mark.django_db
def test_backfill_numbers_existing_shifts_by_creation_time_and_reseals_the_guard(
    org_a: Organization, org_b: Organization
) -> None:
    first, second = ShiftFactory(organization=org_a), ShiftFactory(organization=org_a)
    other_org = ShiftFactory(organization=org_b)
    with connection.cursor() as cursor:
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")  # the fixtures leave no pending events
        cursor.execute("ALTER TABLE shifts_shift DISABLE TRIGGER shifts_shift_guard")
        cursor.execute(
            "ALTER TABLE shifts_shift DROP CONSTRAINT shift_unique_code_per_organization"
        )
        cursor.execute("UPDATE shifts_shift SET code = ''")
        # The older row is the one created first, whatever the order of the ids.
        cursor.execute(
            "UPDATE shifts_shift SET created_at = created_at - interval '1 day' WHERE id = %s",
            [str(second.pk)],
        )
        cursor.execute("ALTER TABLE shifts_shift ENABLE TRIGGER shifts_shift_guard")

    backfill_codes(
        SimpleNamespace(connection=connection),
        BackfillTarget("shifts_shift", "shifts_shift_guard", SHIFT_CODE),
    )

    codes = dict(Shift.objects.values_list("pk", "code"))
    assert codes[second.pk] == "JOR-0001"
    assert codes[first.pk] == "JOR-0002"
    assert codes[other_org.pk] == "JOR-0001"
    assert CodeCounter.objects.get(organization=org_a, kind=SHIFT_CODE.kind).last_number == 2
    assert CodeCounter.objects.get(organization=org_b, kind=SHIFT_CODE.kind).last_number == 1
    # The guard is back on: changing anything but the close fields is refused again.
    with pytest.raises(DatabaseError, match="insert-only"), transaction.atomic():
        _raw_code_update(first.pk)
    first.code = "JOR-9999"
    with pytest.raises(ImmutableRecordError):
        first.save()


def _raw_code_update(pk: Any) -> None:  # noqa: ANN401
    with connection.cursor() as cursor:
        cursor.execute("UPDATE shifts_shift SET code = 'X' WHERE id = %s", [str(pk)])


# --- lookup by code and by id ---------------------------------------------------------------


@pytest.fixture
def supervisor(org_a: Organization, make_member: MemberFactory) -> APIClient:
    user, _ = grant_fleet_scope(make_member(org_a, (SHIFT_READ,)))
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_a_shift_is_found_by_code_and_by_id_and_another_organizations_code_is_unknown(
    org_a: Organization, org_b: Organization, supervisor: APIClient
) -> None:
    mine = ShiftFactory(organization=org_a, code="JOR-0128")
    foreign = ShiftFactory(organization=org_b, code="JOR-0129")

    by_code = supervisor.get("/api/v1/shifts/", {"code": "JOR-0128"})
    by_id = supervisor.get(f"/api/v1/shifts/{mine.pk}/")
    foreign_code = supervisor.get("/api/v1/shifts/", {"code": foreign.code})

    assert [row["id"] for row in by_code.data["results"]] == [str(mine.pk)]
    assert by_code.data["results"][0]["code"] == "JOR-0128"
    assert by_id.status_code == 200
    assert by_id.data["code"] == "JOR-0128"
    assert foreign_code.data["results"] == []
    assert supervisor.get(f"/api/v1/shifts/{foreign.pk}/").status_code == 404
