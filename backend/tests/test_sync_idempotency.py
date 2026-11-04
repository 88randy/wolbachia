"""Idempotency of `/field/sync/`: the event id is the primary key, so a retry never duplicates."""

import logging
import time
from typing import Any

import pytest
from django.db import connection, transaction

from field_sync.models import FieldEvent
from field_sync.services import lock_device_batches
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
def test_concurrent_duplicates_from_one_device_store_one_row_and_return_equal_results(
    org_a: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_a)
    sent = event()

    outcomes = run_in_threads(*[lambda: phone.sync([sent]) for _ in range(4)])

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    results = [results_of(outcome)[0] for outcome in outcomes]
    assert results == [results[0]] * 4
    assert results[0]["status"] == "accepted"
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
def test_concurrent_batches_of_one_device_never_deadlock_and_lose_nothing(
    org_a: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_a)
    batches = [[event() for _ in range(5)] for _ in range(4)]

    outcomes = run_in_threads(*[lambda b=b: phone.sync(b) for b in batches])

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    assert all(
        result["status"] == "accepted" for outcome in outcomes for result in results_of(outcome)
    )
    assert FieldEvent.objects.count() == 20


@pytest.mark.django_db(transaction=True)
def test_a_device_batch_waits_for_the_advisory_lock_of_the_same_device(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """While one batch holds the device lock, another batch of that device must not run."""
    phone = make_phone(make_member, org_a)
    device = phone.issued.session.device
    started: list[str] = []

    def hold_the_lock() -> str:
        with transaction.atomic():
            lock_device_batches(device)
            started.append("holder")
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_sleep(0.6)")
            started.append("holder-done")
        return "holder"

    def sync_meanwhile() -> str:
        while "holder" not in started:
            time.sleep(0.01)
        phone.sync([event()])
        started.append("sync-done")
        return "sync"

    run_in_threads(hold_the_lock, sync_meanwhile)

    assert started == ["holder", "holder-done", "sync-done"]
