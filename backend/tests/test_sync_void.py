"""`record.void`: the phone's correction events. Nothing is deleted; the original is voided."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from field_sync.models import FieldEvent
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.sync_support import Phone, event, make_phone, run_in_threads, second_device_of
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def void_event(
    target_id: str | uuid.UUID, reason: str = "typed in the wrong place"
) -> dict[str, Any]:
    return event(type="record.void", payload={"reason": reason}, voids_event_id=str(target_id))


def one_result(response: Any) -> dict[str, Any]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    return response.data["results"][0]  # type: ignore[no-any-return]


def test_a_void_event_voids_the_original_and_references_it(phone: Phone) -> None:
    original = event()
    phone.sync([original])
    voiding = void_event(original["id"], "typed in the wrong place")

    result = one_result(phone.sync([voiding]))

    assert (result["status"], result["code"]) == ("accepted", "accepted")
    target = FieldEvent.objects.get(pk=original["id"])
    assert (target.voided_by, target.void_reason) == (phone.user, "typed in the wrong place")
    assert target.voided_at is not None
    stored_void = FieldEvent.objects.get(pk=voiding["id"])
    assert (stored_void.voids_event_id, stored_void.type) == (target.pk, "record.void")
    assert FieldEvent.objects.not_voided().filter(pk=original["id"]).count() == 0
    assert FieldEvent.objects.count() == 2  # nothing was deleted


def test_a_void_that_arrives_before_its_original_in_the_array_still_works(phone: Phone) -> None:
    now = timezone.now()
    original = event(device_time=(now - timedelta(minutes=5)).isoformat())
    voiding = void_event(original["id"])
    voiding["device_time"] = now.isoformat()

    response = phone.sync([voiding, original])

    assert [r["status"] for r in response.data["results"]] == ["accepted", "accepted"]
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is not None


def test_voiding_another_users_event_is_refused_and_changes_nothing(
    phone: Phone, make_member: MemberFactory
) -> None:
    colleague = make_phone(make_member, phone.organization)
    theirs = event()
    colleague.sync([theirs])

    result = one_result(phone.sync([void_event(theirs["id"])]))

    assert (result["status"], result["code"]) == ("rejected", "void_target_not_owned")
    assert FieldEvent.objects.get(pk=theirs["id"]).voided_at is None


def test_voiding_an_event_of_another_organization_looks_exactly_like_a_missing_one(
    phone: Phone, org_b: Organization, make_member: MemberFactory
) -> None:
    foreign = make_phone(make_member, org_b)
    theirs = event()
    foreign.sync([theirs])

    foreign_result = one_result(phone.sync([void_event(theirs["id"])]))
    missing_result = one_result(phone.sync([void_event(uuid.uuid4())]))

    assert (foreign_result["status"], foreign_result["code"], foreign_result["params"]) == (
        "rejected",
        "void_target_not_found",
        {},
    )
    assert {k: v for k, v in foreign_result.items() if k != "id"} == {
        k: v for k, v in missing_result.items() if k != "id"
    }
    assert FieldEvent.objects.get(pk=theirs["id"]).voided_at is None


def test_a_rejected_void_does_not_link_to_the_unverified_target(phone: Phone) -> None:
    voiding = void_event(uuid.uuid4())

    phone.sync([voiding])

    assert FieldEvent.objects.get(pk=voiding["id"]).voids_event is None


def test_voiding_twice_is_refused_the_second_time(phone: Phone) -> None:
    original = event()
    phone.sync([original])
    phone.sync([void_event(original["id"], "first")])

    result = one_result(phone.sync([void_event(original["id"], "second")]))

    assert (result["status"], result["code"]) == ("rejected", "already_voided")
    assert FieldEvent.objects.get(pk=original["id"]).void_reason == "first"


@pytest.mark.parametrize(
    ("overrides", "fields"),
    [
        ({"voids_event_id": None}, {"voids_event_id": ["required"]}),
        ({"payload": {"reason": "   "}}, {"reason": ["blank"]}),
        ({"payload": {}}, {"reason": ["required"]}),
        ({"payload": {"reason": "x" * 1001}}, {"reason": ["max_length"]}),
    ],
)
def test_a_void_needs_a_target_and_a_reason(
    phone: Phone, overrides: dict[str, Any], fields: dict[str, list[str]]
) -> None:
    original = event()
    phone.sync([original])
    voiding = {**void_event(original["id"]), **overrides}

    result = one_result(phone.sync([voiding]))

    assert (result["code"], result["params"]) == ("invalid_payload", {"fields": fields})
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is None


def test_a_rejected_event_and_a_void_event_are_not_valid_targets(phone: Phone) -> None:
    rejected, ok = event(type="unknown.type"), event()
    phone.sync([rejected, ok])
    voiding = void_event(ok["id"])
    phone.sync([voiding])

    on_rejected = one_result(phone.sync([void_event(rejected["id"])]))
    on_void = one_result(phone.sync([void_event(voiding["id"])]))

    assert on_rejected["code"] == on_void["code"] == "void_target_not_found"


def test_the_on_void_hook_of_the_target_type_runs_in_the_same_savepoint(phone: Phone) -> None:
    original = event(type="test.with_void_hook", payload={"text": "fine"})
    phone.sync([original])

    result = one_result(phone.sync([void_event(original["id"])]))

    assert result["status"] == "accepted"
    assert Widget.objects.filter(name="void-hook-ran").count() == 1


def test_the_on_void_hook_can_refuse_and_then_the_void_leaves_no_trace(phone: Phone) -> None:
    original = event(type="test.with_void_hook", payload={"text": "locked"})
    phone.sync([original])

    result = one_result(phone.sync([void_event(original["id"])]))

    assert (result["status"], result["code"]) == ("rejected", "test_void_refused")
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is None
    assert not Widget.objects.filter(name="void-hook-ran").exists()


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_voids_of_one_event_leave_exactly_one_winner(
    org_a: Organization, make_member: MemberFactory
) -> None:
    first_phone = make_phone(make_member, org_a)
    second_phone = second_device_of(first_phone)
    original = event()
    first_phone.sync([original])

    outcomes = run_in_threads(
        lambda: first_phone.sync([void_event(original["id"], "from the first phone")]),
        lambda: second_phone.sync([void_event(original["id"], "from the second phone")]),
    )

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    codes = sorted(one_result(outcome)["code"] for outcome in outcomes)
    assert codes == ["accepted", "already_voided"]
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is not None
