"""The one-open-shift-per-courier rule under real concurrency, and the database rules behind it."""

import threading
import uuid
from typing import Any

import pytest
from django.db import DatabaseError, IntegrityError, connection, transaction

from catalogs.models import CatalogItem
from core.exceptions import ImmutableRecordError
from field_sync.services import check_deferred_constraints_now
from organizations.models import Organization
from shifts.models import CheckResult, Motorcycle, MotorcycleCheck, Shift, ShiftStatus
from tests.conftest import MemberFactory
from tests.factories import (
    CatalogItemFactory,
    FieldEventFactory,
    MotorcycleFactory,
    ShiftFactory,
    UserFactory,
)
from tests.fleet_support import grant_fleet_scope
from tests.shift_support import make_check_items, open_event
from tests.sync_support import event, make_phone, run_in_threads, second_device_of
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def make_member(make_member):
    return lambda *args, **kwargs: grant_fleet_scope(make_member(*args, **kwargs))


@pytest.fixture
def check_items(org_a: Organization) -> dict[str, CatalogItem]:
    return make_check_items(org_a)


def test_two_devices_of_one_courier_opening_at_once_leave_exactly_one_open_shift(
    org_a: Organization, make_member: MemberFactory, check_items: dict[str, CatalogItem]
) -> None:
    MotorcycleFactory(organization=org_a, code="M-03")
    first = make_phone(make_member, org_a)
    second = second_device_of(first)

    answers = run_in_threads(
        lambda: first.sync([open_event("M-03")]),
        lambda: second.sync([open_event("M-03")]),
    )

    assert all(not isinstance(answer, Exception) for answer in answers), answers
    statuses = sorted(answer.status_code for answer in answers)
    assert statuses in ([200, 200], [200, 429])
    accepted = [
        result
        for answer in answers
        if answer.status_code == 200
        for result in answer.data["results"]
        if result["status"] == "accepted"
    ]
    assert len(accepted) == 1
    assert Shift.objects.filter(courier=first.user, status=ShiftStatus.OPEN).count() == 1


def test_the_database_lets_only_one_of_two_racing_open_shifts_of_a_courier_in(
    org_a: Organization,
) -> None:
    """Defense in depth: a writer that skipped the handler's check still loses the race."""
    template = ShiftFactory(organization=org_a, is_closed=True)
    events = [
        FieldEventFactory(organization=org_a, created_by=template.courier, device=template.device)
        for _ in range(2)
    ]

    def insert_open_shift(opened_event: Any) -> Any:  # noqa: ANN401
        try:
            with transaction.atomic():
                return Shift.objects.create(
                    organization=org_a,
                    courier=template.courier,
                    device=template.device,
                    motorcycle=template.motorcycle,
                    opened_at_device=template.opened_at_device,
                    opened_event_id=opened_event.pk,
                    odometer_open_km=1,
                )
        finally:
            connection.close()

    outcomes = run_in_threads(
        lambda: insert_open_shift(events[0]), lambda: insert_open_shift(events[1])
    )

    created = [outcome for outcome in outcomes if isinstance(outcome, Shift)]
    refused = [outcome for outcome in outcomes if isinstance(outcome, IntegrityError)]
    assert (len(created), len(refused)) == (1, 1), outcomes
    assert Shift.objects.filter(courier=template.courier, status=ShiftStatus.OPEN).count() == 1


def test_two_couriers_opening_the_same_motorcycle_at_once_leave_exactly_one_open_shift(
    org_a: Organization, make_member: MemberFactory, check_items: dict[str, CatalogItem]
) -> None:
    moto = MotorcycleFactory(organization=org_a, code="M-03")
    first = make_phone(make_member, org_a)
    second = make_phone(make_member, org_a)

    answers = run_in_threads(
        lambda: first.sync([open_event("M-03")]),
        lambda: second.sync([open_event("M-03")]),
    )

    assert all(not isinstance(answer, Exception) for answer in answers), answers
    results = sorted(
        (result["status"], result["code"])
        for answer in answers
        if answer.status_code == 200
        for result in answer.data["results"]
    )
    assert results in (
        [("accepted", "accepted"), ("rejected", "motorcycle_in_use")],
        [("accepted", "accepted")],  # the other batch waited too long for the lock: 429
    )
    assert Shift.objects.filter(motorcycle=moto, status=ShiftStatus.OPEN).count() == 1


def test_the_database_lets_only_one_of_two_racing_open_shifts_of_a_motorcycle_in(
    org_a: Organization,
) -> None:
    template = ShiftFactory(organization=org_a, is_closed=True)
    couriers = [UserFactory(), UserFactory()]
    events = [
        FieldEventFactory(organization=org_a, created_by=courier, device=template.device)
        for courier in couriers
    ]

    def insert_open_shift(courier: Any, opened_event: Any) -> Any:  # noqa: ANN401
        try:
            with transaction.atomic():
                return Shift.objects.create(
                    organization=org_a,
                    courier=courier,
                    device=template.device,
                    motorcycle=template.motorcycle,
                    opened_at_device=template.opened_at_device,
                    opened_event_id=opened_event.pk,
                    odometer_open_km=1,
                )
        finally:
            connection.close()

    outcomes = run_in_threads(
        lambda: insert_open_shift(couriers[0], events[0]),
        lambda: insert_open_shift(couriers[1], events[1]),
    )

    created = [outcome for outcome in outcomes if isinstance(outcome, Shift)]
    refused = [outcome for outcome in outcomes if isinstance(outcome, IntegrityError)]
    assert (len(created), len(refused)) == (1, 1), outcomes


def test_a_severe_check_and_another_courier_opening_the_same_motorcycle_stay_consistent(
    org_a: Organization, make_member: MemberFactory, check_items: dict[str, CatalogItem]
) -> None:
    moto = MotorcycleFactory(organization=org_a, code="M-03")
    severe = make_phone(make_member, org_a)
    other = make_phone(make_member, org_a)

    answers = run_in_threads(
        lambda: severe.sync(
            [open_event("M-03", payload_checks=[{"item": "lights", "result": "severe"}])]
        ),
        lambda: other.sync([open_event("M-03")]),
    )

    assert all(not isinstance(answer, Exception) for answer in answers), answers
    assert all(answer.status_code in (200, 429) for answer in answers)
    moto.refresh_from_db()
    assert Shift.objects.filter(motorcycle=moto).exists()
    assert moto.is_blocked == Shift.objects.filter(courier=severe.user).exists()
    assert Shift.objects.filter(motorcycle=moto, status=ShiftStatus.OPEN).count() == 1


def test_a_client_shift_id_reused_concurrently_by_two_couriers_rejects_only_the_loser_event(
    org_a: Organization,
    make_member: MemberFactory,
    check_items: dict[str, CatalogItem],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The retained Org arbiter retries contention; the exact retry rejects only the reused ID."""
    from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
    from contextlib import contextmanager

    from field_sync.models import FieldEvent
    from reviews import boundaries

    MotorcycleFactory(organization=org_a, code="M-01")
    MotorcycleFactory(organization=org_a, code="M-02")
    meeting = threading.Barrier(2, timeout=10)
    retained, release = threading.Event(), threading.Event()
    original = boundaries.prepare_ingest

    @contextmanager
    def meet_before_org(*args, **kwargs):
        opening = args[1].type == "shift.open"
        if opening:
            meeting.wait()
        with original(*args, **kwargs) as preparation:
            if opening:
                retained.set()
                assert release.wait(timeout=10), "The test did not release the retained arbiter"
            yield preparation

    monkeypatch.setattr(boundaries, "prepare_ingest", meet_before_org)
    shared_id = uuid.uuid4()
    first = make_phone(make_member, org_a)
    second = make_phone(make_member, org_a)

    captures = [[open_event("M-01", shared_id), event()], [open_event("M-02", shared_id), event()]]
    phones = [first, second]

    def submit(index):
        try:
            return phones[index].sync(captures[index])
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {pool.submit(submit, index): index for index in range(2)}
        try:
            assert retained.wait(timeout=10)
            done, _pending = wait(jobs, timeout=10, return_when=FIRST_COMPLETED)
            assert len(done) == 1
            refused_job = next(iter(done))
            refused = refused_job.result(timeout=10)
            assert (refused.status_code, refused.data["code"]) == (429, "sync_in_progress")
        finally:
            release.set()
        answers = [job.result(timeout=10) for job in jobs]
    loser_index = jobs[refused_job]
    assert not FieldEvent.objects.filter(
        pk__in=[row["id"] for row in captures[loser_index]]
    ).exists()
    winner = next(answer for answer in answers if answer.status_code == 200)
    monkeypatch.setattr(boundaries, "prepare_ingest", original)
    retried = phones[loser_index].sync(captures[loser_index])
    assert retried.status_code == 200, retried.data
    answers = [winner, retried]
    statuses = sorted(
        tuple(result["status"] for result in answer.data["results"]) for answer in answers
    )
    assert statuses == [("accepted", "accepted"), ("rejected", "accepted")]
    loser = next(a for a in answers if a.data["results"][0]["status"] == "rejected")
    assert loser.data["results"][0]["code"] == "invalid_payload"
    assert loser.data["results"][0]["params"] == {"fields": {"shift_id": ["already_used"]}}
    assert Shift.objects.filter(pk=shared_id).count() == 1
    assert Widget.objects.count() == 2


def test_a_shift_cannot_be_edited_after_it_closed_except_by_its_close_fields(
    org_a: Organization,
) -> None:
    shift = ShiftFactory(organization=org_a, is_closed=True)
    shift.odometer_open_km = 1

    with pytest.raises(ImmutableRecordError):
        shift.save(update_fields=["odometer_open_km"])


def test_the_database_requires_the_close_fields_to_match_the_status(
    org_a: Organization,
) -> None:
    shift = ShiftFactory(organization=org_a)

    with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("UPDATE shifts_shift SET status = 'closed' WHERE id = %s", [shift.pk])


def test_a_motorcycle_code_is_unique_per_organization_only(
    org_a: Organization, org_b: Organization
) -> None:
    MotorcycleFactory(organization=org_a, code="M-03")
    MotorcycleFactory(organization=org_b, code="M-03")

    with pytest.raises(IntegrityError), transaction.atomic():
        MotorcycleFactory(organization=org_a, code="M-03")

    assert Motorcycle.objects.filter(code="M-03").count() == 2


def test_a_motorcycle_cannot_have_a_reason_when_it_is_not_blocked(org_a: Organization) -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        MotorcycleFactory(organization=org_a, is_blocked=False, blocked_reason="severe_check")


def test_a_shift_row_can_point_at_an_event_stored_later_in_the_same_transaction(
    org_a: Organization,
) -> None:
    """`check_deferred_constraints_now` must leave foreign keys deferred, as the pipeline needs."""
    template = ShiftFactory(organization=org_a, is_closed=True)
    event_id = uuid.uuid4()

    with transaction.atomic():
        check_deferred_constraints_now()
        Shift.objects.create(
            organization=org_a,
            courier=UserFactory(),
            device=template.device,
            motorcycle=MotorcycleFactory(organization=org_a),
            opened_at_device=template.opened_at_device,
            opened_event_id=event_id,
            odometer_open_km=1,
        )
        FieldEventFactory(
            id=event_id, organization=org_a, created_by=template.courier, device=template.device
        )
        check_deferred_constraints_now()

    assert Shift.objects.filter(opened_event_id=event_id).exists()


# --- immutability triggers (raw SQL cannot bypass the model layer) --------------------------


def run_sql(sql: str, *params: object) -> None:
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(sql, list(params))


def test_the_database_refuses_to_delete_a_shift(org_a: Organization) -> None:
    shift = ShiftFactory(organization=org_a)

    with pytest.raises(DatabaseError, match="never deleted"):
        run_sql("DELETE FROM shifts_shift WHERE id = %s", shift.pk)


def test_the_database_refuses_to_change_an_open_shift_outside_the_close_fields(
    org_a: Organization,
) -> None:
    shift = ShiftFactory(organization=org_a)

    with pytest.raises(DatabaseError, match="insert-only"):
        run_sql("UPDATE shifts_shift SET odometer_open_km = 1 WHERE id = %s", shift.pk)


def test_the_database_refuses_to_change_a_closed_shift(org_a: Organization) -> None:
    shift = ShiftFactory(organization=org_a, is_closed=True)

    with pytest.raises(DatabaseError, match="insert-only"):
        run_sql("UPDATE shifts_shift SET close_note = 'x' WHERE id = %s", shift.pk)


def test_the_database_lets_an_open_shift_be_closed(org_a: Organization) -> None:
    shift = ShiftFactory(organization=org_a)
    closing = FieldEventFactory(
        organization=org_a, created_by=shift.courier, device=shift.device, type="shift.close"
    )

    run_sql(
        "UPDATE shifts_shift SET status = 'closed', closed_at_device = now(), "
        "closed_event_id = %s, odometer_close_km = 5, close_note = 'ok' WHERE id = %s",
        closing.pk,
        shift.pk,
    )

    assert Shift.objects.get(pk=shift.pk).status == ShiftStatus.CLOSED


def test_the_database_refuses_to_update_or_delete_a_checklist_line(org_a: Organization) -> None:
    shift = ShiftFactory(organization=org_a)
    item = CatalogItemFactory(catalog__organization=org_a, organization=org_a)
    line = MotorcycleCheck.objects.create(
        organization=org_a, shift=shift, item=item, result=CheckResult.OK
    )

    with pytest.raises(DatabaseError, match="insert-only"):
        run_sql("UPDATE shifts_motorcyclecheck SET result = 'severe' WHERE id = %s", line.pk)
    with pytest.raises(DatabaseError, match="insert-only"):
        run_sql("DELETE FROM shifts_motorcyclecheck WHERE id = %s", line.pk)
