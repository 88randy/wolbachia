"""`record.void`: the phone's correction events. Nothing is deleted; the original is voided."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from accounts.models import RevokeReason
from accounts.revocation import Revocation, revoke_session
from field_sync.models import FieldEvent
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.sync_support import (
    Phone,
    configure_clock_skew,
    event,
    make_phone,
    run_in_threads,
    second_device_of,
)
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

    assert (foreign_result["status"], foreign_result["code"]) == (
        "rejected",
        "void_target_not_found",
    )
    assert foreign_result["params"] == {"voids_event_id": theirs["id"]}  # only what the phone sent

    def shape(result: dict[str, Any]) -> tuple[Any, Any, Any]:
        return result["status"], result["code"], sorted(result["params"])

    assert shape(foreign_result) == shape(missing_result)  # nothing tells them apart
    assert FieldEvent.objects.get(pk=theirs["id"]).voided_at is None


def test_a_rejected_void_does_not_link_to_the_unverified_target(phone: Phone) -> None:
    voiding = void_event(uuid.uuid4())

    phone.sync([voiding])

    assert FieldEvent.objects.get(pk=voiding["id"]).voids_event is None


def test_voiding_twice_is_refused_the_second_time(phone: Phone) -> None:
    original = event()
    phone.sync([original])
    phone.sync([void_event(original["id"], "first void, with reason")])

    result = one_result(phone.sync([void_event(original["id"], "second void, with reason")]))

    assert (result["status"], result["code"]) == ("rejected", "already_voided")
    assert FieldEvent.objects.get(pk=original["id"]).void_reason == "first void, with reason"


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

    assert (result["code"], result["params"]["fields"]) == ("invalid_payload", fields)
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


def test_a_rejected_void_keeps_the_submitted_target_id_in_its_params(phone: Phone) -> None:
    missing = uuid.uuid4()
    voiding = void_event(missing)

    phone.sync([voiding])

    stored = FieldEvent.objects.get(pk=voiding["id"])
    assert stored.status_params == {"voids_event_id": str(missing)}


def test_a_void_that_will_be_reviewed_leaves_the_target_intact(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """A final upload (a revoked phone) must not change records: a supervisor decides (#22)."""
    phone = make_phone(make_member, org_a)
    original = event()
    phone.sync([original])
    revoke_session(
        phone.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )
    voiding = void_event(original["id"])

    response = phone.sync([voiding])

    result = response.data["results"][0]
    assert (result["status"], result["code"]) == ("in_review", "final_upload_after_revoke")
    target = FieldEvent.objects.get(pk=original["id"])
    assert (target.voided_at, target.void_reason) == (None, "")
    stored = FieldEvent.objects.get(pk=voiding["id"])
    assert (stored.status, stored.voids_event_id) == ("in_review", target.pk)


def test_a_void_in_a_skewed_batch_also_waits_for_review(
    org_a: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_a)
    configure_clock_skew(org_a, 300)
    original = event()
    phone.sync([original])
    far_future = (timezone.now() + timedelta(hours=3)).isoformat()

    response = phone.sync([void_event(original["id"])], sent_at=far_future)

    assert response.data["results"][0]["code"] == "clock_skew"
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is None


def test_a_void_in_review_still_validates_its_target(
    org_a: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_a)
    original = event()
    phone.sync([original, void_event(original["id"])])
    revoke_session(
        phone.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )

    response = phone.sync(
        [void_event(original["id"], "again, with a reason"), void_event(uuid.uuid4())]
    )

    assert [r["code"] for r in response.data["results"]] == [
        "already_voided",
        "void_target_not_found",
    ]


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_voids_of_one_event_from_two_phones_void_it_once(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """One courier's batches are serialized: the loser of the race is told to retry (429) or,
    if it ran second, sees the event already voided. Never two voids."""
    first_phone = make_phone(make_member, org_a)
    second_phone = second_device_of(first_phone)
    original = event()
    first_phone.sync([original])

    outcomes = run_in_threads(
        lambda: first_phone.sync([void_event(original["id"], "from the first phone")]),
        lambda: second_phone.sync([void_event(original["id"], "from the second phone")]),
    )

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    answers = [o.data["results"][0]["code"] for o in outcomes if o.status_code == 200]
    assert answers.count("accepted") == 1
    assert set(answers) <= {"accepted", "already_voided"}
    assert all(o.status_code in (200, 429) for o in outcomes)
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is not None
