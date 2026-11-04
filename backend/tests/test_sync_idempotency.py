"""Idempotency of `/field/sync/`: the event id is the primary key, so a retry never duplicates."""

import logging
from typing import Any

import pytest

from field_sync.models import FieldEvent
from organizations.models import Organization
from reviews.models import ReviewItem
from tests.conftest import MemberFactory
from tests.sync_support import Phone, event, make_phone, run_in_threads, second_device_of
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def results_of(response: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    return response.data["results"]  # type: ignore[no-any-return]


def test_sync_ignores_duplicate_event_id(phone: Phone) -> None:
    sent = event()

    first = results_of(phone.sync([sent]))
    second = results_of(phone.sync([sent]))

    assert (
        first
        == second
        == [{"id": sent["id"], "status": "accepted", "code": "accepted", "params": {}}]
    )
    assert FieldEvent.objects.filter(pk=sent["id"]).count() == 1
    assert Widget.objects.count() == 1  # the handler did not run twice


def test_the_same_event_twice_in_one_batch_gives_the_same_result_and_one_row(phone: Phone) -> None:
    sent = event()

    results = results_of(phone.sync([sent, sent]))

    assert results[0] == results[1]
    assert FieldEvent.objects.count() == 1
    assert Widget.objects.count() == 1


def test_the_same_id_with_other_content_returns_the_stored_result_and_logs_a_warning(
    phone: Phone, caplog: pytest.LogCaptureFixture
) -> None:
    original = event(payload={"text": "original"})
    phone.sync([original])
    changed = {**original, "payload": {"text": "changed"}}

    with caplog.at_level(logging.WARNING, logger="field_sync.services"):
        result = results_of(phone.sync([changed]))[0]

    assert result["status"] == "accepted"
    assert FieldEvent.objects.get(pk=original["id"]).payload == {"text": "original"}
    assert "other content" in caplog.text
    assert "changed" not in caplog.text  # payloads never go to the logs


def test_a_rejected_event_replays_as_the_same_rejection_with_one_review_item(phone: Phone) -> None:
    sent = event(type="unknown.type")

    first = results_of(phone.sync([sent]))
    second = results_of(phone.sync([sent]))

    assert first == second
    assert first[0]["code"] == "unsupported_event_type"
    assert FieldEvent.objects.count() == 1
    assert ReviewItem.objects.count() == 1


def test_an_id_stored_by_another_organization_is_a_conflict_that_stores_and_leaks_nothing(
    phone: Phone, org_b: Organization, make_member: MemberFactory
) -> None:
    other = make_phone(make_member, org_b)
    taken = event(payload={"text": "theirs"})
    other.sync([taken])

    result = results_of(phone.sync([taken]))[0]

    assert result == {
        "id": taken["id"],
        "status": "rejected",
        "code": "event_id_conflict",
        "params": {},
    }
    stored = FieldEvent.objects.get(pk=taken["id"])
    assert (stored.organization, stored.payload) == (org_b, {"text": "theirs"})
    assert FieldEvent.objects.count() == 1
    assert not ReviewItem.objects.exists()
    assert Widget.objects.filter(organization=phone.organization).count() == 0


def test_an_id_stored_by_another_device_of_the_same_user_is_a_conflict(phone: Phone) -> None:
    taken = event()
    phone.sync([taken])

    result = results_of(second_device_of(phone).sync([taken]))[0]

    assert result["code"] == "event_id_conflict"


def test_an_id_stored_by_another_user_of_the_same_device_is_a_conflict(
    phone: Phone, make_member: MemberFactory
) -> None:
    colleague = make_phone(make_member, phone.organization, device_id=phone.device_id)
    taken = event()
    phone.sync([taken])

    result = results_of(colleague.sync([taken]))[0]

    assert result["code"] == "event_id_conflict"


def test_a_conflict_does_not_stop_the_rest_of_the_batch(
    phone: Phone, org_b: Organization, make_member: MemberFactory
) -> None:
    other = make_phone(make_member, org_b)
    taken = event()
    other.sync([taken])

    results = results_of(phone.sync([taken, event()]))

    assert [r["status"] for r in results] == ["rejected", "accepted"]


# --- concurrency (real transactions and threads) -------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_concurrent_retries_of_one_event_from_one_phone_store_one_row(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """The courier lock lets one retry run and tells the others to come back (429); whichever
    ran stored the event once and the answers agree."""
    phone = make_phone(make_member, org_a)
    sent = event()

    outcomes = run_in_threads(*[lambda: phone.sync([sent]) for _ in range(4)])

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    answered = [results_of(o)[0] for o in outcomes if o.status_code == 200]
    assert answered
    assert all(o.status_code in (200, 429) for o in outcomes)
    assert answered == [answered[0]] * len(answered)
    assert answered[0]["status"] == "accepted"
    assert FieldEvent.objects.filter(pk=sent["id"]).count() == 1
    assert Widget.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicates_from_two_organizations_leave_exactly_one_winner(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    mine = make_phone(make_member, org_a)
    theirs = make_phone(make_member, org_b)
    contested = event()

    outcomes = run_in_threads(lambda: mine.sync([contested]), lambda: theirs.sync([contested]))

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    statuses = sorted(results_of(outcome)[0]["code"] for outcome in outcomes)
    assert statuses == ["accepted", "event_id_conflict"]
    assert FieldEvent.objects.filter(pk=contested["id"]).count() == 1
    assert Widget.objects.count() == 1  # the loser's domain writes were rolled back


@pytest.mark.django_db(transaction=True)
def test_concurrent_batches_of_one_courier_run_one_at_a_time_and_the_rest_are_told_to_retry(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """Nothing waits for the courier lock: a batch either runs whole or gets 429 at once."""
    phone = make_phone(make_member, org_a)
    batches = [[event() for _ in range(5)] for _ in range(4)]

    outcomes = run_in_threads(*[lambda b=b: phone.sync(b) for b in batches])

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    answered = [outcome for outcome in outcomes if outcome.status_code == 200]
    refused = [outcome for outcome in outcomes if outcome.status_code == 429]
    assert len(answered) + len(refused) == 4
    assert answered, "at least one batch must run"
    assert all(outcome.data["code"] == "sync_in_progress" for outcome in refused)
    assert all(int(outcome.headers["Retry-After"]) > 0 for outcome in refused)
    assert FieldEvent.objects.count() == 5 * len(answered)  # a refused batch stored nothing
