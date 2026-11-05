"""`shift.open` and `shift.close` through `POST /field/sync/`: every result code, idempotency,
ordering and the effects on the records."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from catalogs.models import CatalogItem
from catalogs.seeds import seed_default_catalogs
from field_sync.models import FieldEvent
from organizations.models import Organization
from shifts.models import CheckResult, Motorcycle, MotorcycleCheck, Shift, ShiftStatus
from tests.conftest import MemberFactory
from tests.factories import MotorcycleFactory, ShiftFactory
from tests.shift_support import all_ok_checks, close_event, make_check_items, open_event
from tests.sync_support import Phone, configure_clock_skew, event, make_phone

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


@pytest.fixture
def motorcycle(org_a: Organization) -> Motorcycle:
    return MotorcycleFactory(organization=org_a, code="M-03")


@pytest.fixture
def check_items(org_a: Organization) -> dict[str, CatalogItem]:
    return make_check_items(org_a)


def only_result(response: Any) -> dict[str, Any]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    (result,) = response.data["results"]
    return dict(result)


def status_and_code(result: dict[str, Any]) -> tuple[str, str]:
    return result["status"], result["code"]


# --- shift.open -----------------------------------------------------------------------------


def test_open_creates_the_shift_and_its_checklist_with_the_phone_ids(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    shift_id = uuid.uuid4()
    sent = open_event(
        "M-03",
        shift_id,
        payload_odometer_km=12_380,
        payload_note="  new dashboard ",
        payload_checks=[
            {"item": "tires", "result": "ok"},
            {"item": "brakes", "result": "minor", "note": "squeaks"},
        ],
    )

    result = only_result(phone.sync([sent]))

    shift = Shift.objects.get(pk=shift_id)
    assert status_and_code(result) == ("accepted", "accepted")
    assert (shift.courier, shift.motorcycle, shift.status) == (
        phone.user,
        motorcycle,
        ShiftStatus.OPEN,
    )
    assert (shift.odometer_open_km, shift.open_note) == (12_380, "new dashboard")
    assert shift.opened_event_id == uuid.UUID(sent["id"])
    assert (
        shift.opened_at_device.isoformat()
        == FieldEvent.objects.get(pk=sent["id"]).device_time.isoformat()
    )
    assert sorted(shift.checks.values_list("item__code", "result", "note")) == [
        ("brakes", "minor", "squeaks"),
        ("tires", "ok", ""),
    ]


def test_replaying_the_same_open_event_returns_the_same_result_and_creates_nothing(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    sent = open_event("M-03")
    first = only_result(phone.sync([sent]))

    second = only_result(phone.sync([sent]))

    assert second == first
    assert (Shift.objects.count(), MotorcycleCheck.objects.count()) == (1, 3)


def test_opening_while_a_shift_is_open_is_rejected_and_names_the_open_shift(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    open_shift = ShiftFactory(organization=phone.organization, courier=phone.user)

    result = only_result(phone.sync([open_event("M-03")]))

    assert status_and_code(result) == ("rejected", "shift_already_open")
    assert result["params"] == {"shift_id": str(open_shift.pk)}
    assert Shift.objects.count() == 1


def test_a_closed_shift_does_not_stop_the_next_open(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    first_id = uuid.uuid4()
    start = timezone.now() - timedelta(hours=2)
    batch = [
        open_event("M-03", first_id, device_time=start.isoformat()),
        close_event(first_id, device_time=(start + timedelta(hours=1)).isoformat()),
        open_event(
            "M-03",
            payload_odometer_km=12_050,
            device_time=(start + timedelta(hours=1, minutes=5)).isoformat(),
        ),
    ]

    response = phone.sync(batch)

    assert [r["status"] for r in response.data["results"]] == ["accepted"] * 3
    assert Shift.objects.filter(status=ShiftStatus.OPEN).count() == 1


def test_an_unknown_motorcycle_is_rejected(
    phone: Phone, check_items: dict[str, CatalogItem]
) -> None:
    result = only_result(phone.sync([open_event("M-99")]))

    assert status_and_code(result) == ("rejected", "motorcycle_unknown")
    assert not Shift.objects.exists()


def test_a_motorcycle_of_another_organization_is_unknown(
    phone: Phone, org_b: Organization, check_items: dict[str, CatalogItem]
) -> None:
    MotorcycleFactory(organization=org_b, code="M-77")

    result = only_result(phone.sync([open_event("M-77")]))

    assert status_and_code(result) == ("rejected", "motorcycle_unknown")


def test_a_blocked_motorcycle_is_rejected_with_the_reason(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    Motorcycle.objects.filter(pk=motorcycle.pk).update(
        is_blocked=True, blocked_reason="service_overdue"
    )

    result = only_result(phone.sync([open_event("M-03")]))

    assert status_and_code(result) == ("rejected", "motorcycle_blocked")
    assert result["params"] == {"reason": "service_overdue"}
    assert not Shift.objects.exists()


def test_an_open_with_an_absurd_odometer_is_rejected(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    result = only_result(phone.sync([open_event("M-03", payload_odometer_km=1_000_000)]))

    assert status_and_code(result) == ("rejected", "odometer_out_of_range")
    assert result["params"] == {"odometer_km": 1_000_000, "max_km": 999_999}
    assert not Shift.objects.exists()


def test_a_close_with_an_absurd_odometer_is_rejected_and_the_shift_stays_open(
    phone: Phone,
) -> None:
    shift = ShiftFactory(organization=phone.organization, courier=phone.user)

    result = only_result(phone.sync([close_event(shift.pk, 1_000_000)]))

    assert status_and_code(result) == ("rejected", "odometer_out_of_range")
    assert Shift.objects.get(pk=shift.pk).status == ShiftStatus.OPEN


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"payload_odometer_km": -1}, "odometer_km"),
        ({"payload_motorcycle_code": ""}, "motorcycle_code"),
        ({"payload_checks": [{"item": "tires", "result": "broken"}]}, "checks"),
        ({"payload_checks": "none"}, "checks"),
    ],
)
def test_a_malformed_open_payload_is_invalid_payload(
    phone: Phone,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
    override: dict[str, Any],
    field: str,
) -> None:
    result = only_result(phone.sync([open_event("M-03", **override)]))

    assert status_and_code(result) == ("rejected", "invalid_payload")
    assert any(name.split(".")[0] == field for name in result["params"]["fields"])


@pytest.mark.parametrize(
    ("checks", "code"),
    [
        ([{"item": "wheels", "result": "ok"}], "unknown_item"),
        (
            [{"item": "tires", "result": "ok"}, {"item": "tires", "result": "minor"}],
            "duplicate_item",
        ),
    ],
)
def test_the_checklist_must_use_distinct_items_of_the_catalog(
    phone: Phone,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
    checks: list[dict[str, str]],
    code: str,
) -> None:
    result = only_result(phone.sync([open_event("M-03", payload_checks=checks)]))

    assert status_and_code(result) == ("rejected", "invalid_payload")
    assert result["params"]["fields"] == {"checks": [code]}


def test_an_inactive_checklist_item_is_unknown(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    CatalogItem.objects.filter(pk=check_items["tires"].pk).update(is_active=False)

    result = only_result(phone.sync([open_event("M-03")]))

    assert result["params"]["fields"] == {"checks": ["unknown_item"]}


def test_open_without_a_shift_id_is_invalid(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    sent = open_event("M-03")
    sent["shift_id"] = None

    result = only_result(phone.sync([sent]))

    assert status_and_code(result) == ("rejected", "invalid_payload")
    assert result["params"]["fields"] == {"shift_id": ["required"]}


def test_a_shift_id_that_already_exists_cannot_be_reused(
    phone: Phone, org_b: Organization, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    taken = ShiftFactory(organization=org_b)

    result = only_result(phone.sync([open_event("M-03", taken.pk)]))

    assert status_and_code(result) == ("rejected", "invalid_payload")
    assert result["params"]["fields"] == {"shift_id": ["already_used"]}


def test_a_severe_check_opens_the_shift_blocks_the_motorcycle_and_goes_to_review(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    checks = [*all_ok_checks()[:2], {"item": "lights", "result": "severe"}]

    result = only_result(phone.sync([open_event("M-03", payload_checks=checks)]))

    motorcycle.refresh_from_db()
    assert status_and_code(result) == ("in_review", "severe_check")
    assert result["params"] == {"motorcycle_code": "M-03"}
    assert (motorcycle.is_blocked, motorcycle.blocked_reason) == (True, "severe_check")
    assert MotorcycleCheck.objects.filter(result=CheckResult.SEVERE).count() == 1
    assert Shift.objects.count() == 1


def test_later_opens_with_a_motorcycle_blocked_by_a_severe_check_are_rejected(
    org_a: Organization,
    make_member: MemberFactory,
    phone: Phone,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    severe = [{"item": "lights", "result": "severe"}]
    phone.sync([open_event("M-03", payload_checks=severe)])
    other = make_phone(make_member, org_a)

    result = only_result(other.sync([open_event("M-03")]))

    assert status_and_code(result) == ("rejected", "motorcycle_blocked")
    assert result["params"] == {"reason": "severe_check"}


def test_an_open_below_the_last_odometer_of_the_motorcycle_goes_to_review_but_opens(
    org_a: Organization,
    make_member: MemberFactory,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    ShiftFactory(
        organization=org_a,
        motorcycle=motorcycle,
        is_closed=True,
        odometer_open_km=12_000,
        odometer_close_km=12_480,
        opened_at_device=timezone.now() - timedelta(days=1),
    )
    courier = make_phone(make_member, org_a)

    result = only_result(courier.sync([open_event("M-03", payload_odometer_km=12_380)]))

    assert status_and_code(result) == ("in_review", "odometer_decreased")
    assert result["params"] == {"previous_km": 12_480, "odometer_km": 12_380}
    assert Shift.objects.filter(courier=courier.user, status=ShiftStatus.OPEN).count() == 1


def test_an_open_event_with_a_skewed_clock_is_in_review_but_applied(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    configure_clock_skew(phone.organization)
    sent_at = (timezone.now() + timedelta(hours=3)).isoformat()

    response = phone.sync([open_event("M-03")], sent_at=sent_at)

    assert status_and_code(response.data["results"][0]) == ("in_review", "clock_skew")
    assert Shift.objects.count() == 1


# --- shift.close ----------------------------------------------------------------------------


def test_close_stores_the_reading_and_the_event(phone: Phone) -> None:
    shift = ShiftFactory(organization=phone.organization, courier=phone.user)
    sent = close_event(shift.pk, 12_090, payload_note="fuel stop")

    result = only_result(phone.sync([sent]))

    shift.refresh_from_db()
    assert status_and_code(result) == ("accepted", "accepted")
    assert (shift.status, shift.odometer_close_km, shift.close_note) == (
        ShiftStatus.CLOSED,
        12_090,
        "fuel stop",
    )
    assert shift.closed_event_id == uuid.UUID(sent["id"])
    assert shift.closed_at_device is not None


def test_replaying_a_close_returns_the_same_result(phone: Phone) -> None:
    shift = ShiftFactory(organization=phone.organization, courier=phone.user)
    sent = close_event(shift.pk)
    first = only_result(phone.sync([sent]))

    second = only_result(phone.sync([sent]))

    assert second == first


def test_a_close_below_the_open_odometer_closes_the_shift_and_goes_to_review(
    phone: Phone,
) -> None:
    shift = ShiftFactory(
        organization=phone.organization, courier=phone.user, odometer_open_km=12_000
    )

    result = only_result(phone.sync([close_event(shift.pk, 11_900)]))

    shift.refresh_from_db()
    assert status_and_code(result) == ("in_review", "odometer_decreased")
    assert result["params"] == {"previous_km": 12_000, "odometer_km": 11_900}
    assert (shift.status, shift.odometer_close_km) == (ShiftStatus.CLOSED, 11_900)


def test_closing_twice_with_different_events_is_rejected_the_second_time(phone: Phone) -> None:
    shift = ShiftFactory(organization=phone.organization, courier=phone.user)
    phone.sync([close_event(shift.pk)])

    result = only_result(phone.sync([close_event(shift.pk, 12_100)]))

    assert status_and_code(result) == ("rejected", "shift_not_open")
    assert Shift.objects.get(pk=shift.pk).odometer_close_km == 12_050


def test_closing_a_shift_that_does_not_exist_is_rejected(phone: Phone) -> None:
    result = only_result(phone.sync([close_event(uuid.uuid4())]))

    assert status_and_code(result) == ("rejected", "shift_not_open")


def test_closing_another_couriers_shift_is_rejected_and_leaves_it_open(
    phone: Phone, org_a: Organization, make_member: MemberFactory
) -> None:
    other = make_phone(make_member, org_a)
    shift = ShiftFactory(organization=org_a, courier=other.user)

    result = only_result(phone.sync([close_event(shift.pk)]))

    assert status_and_code(result) == ("rejected", "shift_not_open")
    assert Shift.objects.get(pk=shift.pk).status == ShiftStatus.OPEN


def test_closing_a_shift_of_another_organization_looks_like_a_missing_one(
    phone: Phone, org_b: Organization
) -> None:
    shift = ShiftFactory(organization=org_b)

    result = only_result(phone.sync([close_event(shift.pk)]))

    assert status_and_code(result) == ("rejected", "shift_not_open")
    assert Shift.objects.get(pk=shift.pk).status == ShiftStatus.OPEN


def test_close_without_a_shift_id_is_invalid(phone: Phone) -> None:
    sent = close_event(uuid.uuid4())
    sent["shift_id"] = None

    result = only_result(phone.sync([sent]))

    assert status_and_code(result) == ("rejected", "invalid_payload")


# --- ordering -------------------------------------------------------------------------------


def test_open_and_close_in_one_batch_work_in_any_array_order(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    shift_id = uuid.uuid4()
    start = timezone.now() - timedelta(hours=3)
    opening = open_event("M-03", shift_id, device_time=start.isoformat())
    closing = close_event(shift_id, device_time=(start + timedelta(hours=2)).isoformat())

    response = phone.sync([closing, opening])

    assert [r["status"] for r in response.data["results"]] == ["accepted", "accepted"]
    assert Shift.objects.get(pk=shift_id).status == ShiftStatus.CLOSED


def test_a_close_that_reaches_the_server_before_its_open_is_rejected_and_not_retried_later(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    shift_id = uuid.uuid4()
    first = only_result(phone.sync([close_event(shift_id)]))

    phone.sync([open_event("M-03", shift_id)])

    assert status_and_code(first) == ("rejected", "shift_not_open")
    assert Shift.objects.get(pk=shift_id).status == ShiftStatus.OPEN


# --- voiding --------------------------------------------------------------------------------


@pytest.mark.parametrize("kind", ["open", "close"])
def test_a_shift_event_cannot_be_voided_by_its_author(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem], kind: str
) -> None:
    shift_id = uuid.uuid4()
    target = open_event("M-03", shift_id) if kind == "open" else close_event(shift_id)
    if kind == "close":
        phone.sync([open_event("M-03", shift_id)])
    phone.sync([target])
    seed_default_catalogs(phone.organization)
    void = event(
        type="record.void",
        payload={"reason_code": "other", "reason": "mistake in the shift"},
        voids_event_id=target["id"],
    )

    result = only_result(phone.sync([void]))

    assert status_and_code(result) == ("rejected", "shift_event_not_voidable")
    assert FieldEvent.objects.get(pk=target["id"]).voided_at is None


def test_a_motorcycle_already_in_an_open_shift_is_rejected_for_another_courier(
    org_a: Organization,
    make_member: MemberFactory,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    ShiftFactory(organization=org_a, motorcycle=motorcycle)
    courier = make_phone(make_member, org_a)

    result = only_result(courier.sync([open_event("M-03")]))

    assert status_and_code(result) == ("rejected", "motorcycle_in_use")
    assert result["params"] == {}
    assert not Shift.objects.filter(courier=courier.user).exists()


def test_a_motorcycle_is_free_again_once_its_shift_closed(
    org_a: Organization,
    make_member: MemberFactory,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    ShiftFactory(
        organization=org_a, motorcycle=motorcycle, is_closed=True, odometer_close_km=12_000
    )
    courier = make_phone(make_member, org_a)

    result = only_result(courier.sync([open_event("M-03")]))

    assert status_and_code(result) == ("accepted", "accepted")


def test_a_blocked_motorcycle_is_reported_blocked_before_in_use(
    org_a: Organization,
    make_member: MemberFactory,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    ShiftFactory(organization=org_a, motorcycle=motorcycle)
    Motorcycle.objects.filter(pk=motorcycle.pk).update(
        is_blocked=True, blocked_reason="out_of_service"
    )
    courier = make_phone(make_member, org_a)

    result = only_result(courier.sync([open_event("M-03")]))

    assert status_and_code(result) == ("rejected", "motorcycle_blocked")


def test_a_severe_check_wins_over_a_decreased_odometer(
    org_a: Organization,
    make_member: MemberFactory,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    ShiftFactory(
        organization=org_a,
        motorcycle=motorcycle,
        is_closed=True,
        odometer_close_km=13_000,
    )
    courier = make_phone(make_member, org_a)
    severe = [{"item": "lights", "result": "severe"}]

    result = only_result(
        courier.sync([open_event("M-03", payload_odometer_km=12_000, payload_checks=severe)])
    )

    assert status_and_code(result) == ("in_review", "severe_check")


def test_the_odometer_reference_is_the_highest_reading_whatever_the_clocks_say(
    org_a: Organization,
    make_member: MemberFactory,
    motorcycle: Motorcycle,
    check_items: dict[str, CatalogItem],
) -> None:
    now = timezone.now()
    ShiftFactory(
        organization=org_a,
        motorcycle=motorcycle,
        is_closed=True,
        odometer_close_km=15_000,
        opened_at_device=now + timedelta(days=30),  # a wrong phone clock, far in the future
    )
    ShiftFactory(
        organization=org_a,
        motorcycle=motorcycle,
        is_closed=True,
        odometer_close_km=12_500,
        opened_at_device=now - timedelta(days=2),
    )
    courier = make_phone(make_member, org_a)

    below = only_result(courier.sync([open_event("M-03", payload_odometer_km=14_999)]))

    assert status_and_code(below) == ("in_review", "odometer_decreased")
    assert below["params"] == {"previous_km": 15_000, "odometer_km": 14_999}


def test_two_shifts_of_one_batch_with_inverted_ids_still_set_the_highest_reference(
    phone: Phone, motorcycle: Motorcycle, check_items: dict[str, CatalogItem]
) -> None:
    """The events of a batch share one receipt time, so no tiebreak by id may pick the reference."""
    larger_id, smaller_id = sorted([uuid.uuid4(), uuid.uuid4()], reverse=True)
    start = timezone.now() - timedelta(hours=6)

    def at(minutes: int) -> str:
        return (start + timedelta(minutes=minutes)).isoformat()

    batch = [
        open_event("M-03", larger_id, payload_odometer_km=100, device_time=at(0)),
        close_event(larger_id, 200, device_time=at(10)),
        open_event("M-03", smaller_id, payload_odometer_km=300, device_time=at(20)),
        close_event(smaller_id, 400, device_time=at(30)),
    ]
    assert [r["status"] for r in phone.sync(batch).data["results"]] == ["accepted"] * 4

    later = only_result(phone.sync([open_event("M-03", payload_odometer_km=350)]))

    assert status_and_code(later) == ("in_review", "odometer_decreased")
    assert later["params"] == {"previous_km": 400, "odometer_km": 350}
