"""The one-open-shift-per-courier rule under real concurrency, and the database rules behind it."""

from typing import Any

import pytest
from django.db import IntegrityError, connection, transaction

from catalogs.models import CatalogItem
from core.exceptions import ImmutableRecordError
from organizations.models import Organization
from shifts.models import Motorcycle, Shift, ShiftStatus
from tests.conftest import MemberFactory
from tests.factories import FieldEventFactory, MotorcycleFactory, ShiftFactory
from tests.shift_support import make_check_items, open_event
from tests.sync_support import make_phone, run_in_threads, second_device_of

pytestmark = pytest.mark.django_db(transaction=True)


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
    assert moto.is_blocked
    severe_shift = Shift.objects.filter(courier=severe.user)
    if answers[0].status_code == 200:
        assert severe_shift.count() == 1
    assert Shift.objects.filter(courier=other.user).count() <= 1


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
