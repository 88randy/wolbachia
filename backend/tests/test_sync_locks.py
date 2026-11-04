"""Batch locks of `/field/sync/` with real transactions: one batch per courier (never waiting) and
ordered locks on shared event ids (never deadlocking)."""

import threading
import time
import uuid
from datetime import timedelta
from functools import partial
from typing import Any

import pytest
from django.db import IntegrityError, OperationalError, connection
from django.utils import timezone

from accounts.models import RevokeReason
from accounts.revocation import Revocation, revoke_session
from field_sync import registry
from field_sync.models import FieldEvent
from field_sync.registry import HANDLERS, EventContext, EventHandler
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.sync_support import Phone, event, make_phone, run_in_threads, second_device_of
from tests.testapp.handlers import SLOW_RELEASE, SLOW_STARTED, NotePayload
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _slow_handler_gate() -> Any:  # noqa: ANN401
    SLOW_STARTED.clear()
    SLOW_RELEASE.clear()
    yield
    SLOW_RELEASE.set()  # never leave a handler hanging


def run_long_batch(
    phone: Phone, events: list[dict[str, Any]], answers: dict[str, Any]
) -> threading.Thread:
    def job() -> None:
        try:
            answers["long"] = phone.sync(events)
        finally:
            connection.close()

    thread = threading.Thread(target=job)
    thread.start()
    return thread


def test_a_second_device_of_the_same_courier_is_told_to_retry_while_a_batch_runs(
    org_a: Organization, make_member: MemberFactory
) -> None:
    first = make_phone(make_member, org_a)
    second = second_device_of(first)
    answers: dict[str, Any] = {}
    slow = event(type="test.slow", payload={"text": "slow"})
    thread = run_long_batch(first, [slow], answers)
    assert SLOW_STARTED.wait(10), "the long batch never started"

    refused = second.sync([event()])
    SLOW_RELEASE.set()
    thread.join(20)

    assert (refused.status_code, refused.data["code"]) == (429, "sync_in_progress")
    assert int(refused.headers["Retry-After"]) > 0
    assert answers["long"].status_code == 200
    assert FieldEvent.objects.count() == 1  # the refused batch stored nothing


def test_another_courier_is_not_blocked_by_a_running_batch(
    org_a: Organization, make_member: MemberFactory
) -> None:
    busy = make_phone(make_member, org_a)
    colleague = make_phone(make_member, org_a)
    answers: dict[str, Any] = {}
    thread = run_long_batch(busy, [event(type="test.slow", payload={"text": "slow"})], answers)
    assert SLOW_STARTED.wait(10)

    response = colleague.sync([event()])
    SLOW_RELEASE.set()
    thread.join(20)

    assert response.status_code == 200


def test_a_review_created_by_a_long_batch_is_never_skipped_by_the_next_pull(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """The review item gets its `created_at` early in a long batch. A pull that ran in the middle
    would move the cursor past it and lose it; the lock makes that pull wait (429), so the pull
    after the commit sees it."""
    first = make_phone(make_member, org_a)
    second = second_device_of(first)
    before = first.sync([]).data["changes"]["cursor"]
    flagged = event(
        type="unknown.type", device_time=(timezone.now() - timedelta(seconds=30)).isoformat()
    )
    slow = event(type="test.slow", payload={"text": "slow"})
    answers: dict[str, Any] = {}
    thread = run_long_batch(first, [flagged, slow], answers)
    assert SLOW_STARTED.wait(10)

    during = second.sync([], cursor=before)
    SLOW_RELEASE.set()
    thread.join(20)
    after = second.sync([], cursor=before)

    assert during.status_code == 429
    assert [r["event_id"] for r in after.data["changes"]["reviews"]] == [flagged["id"]]
    assert Widget.objects.filter(name="slow").count() == 1


def test_the_try_lock_is_released_when_a_batch_fails_inside_sync_batch(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The failure happens inside the locked transaction (a handler error: 500), so the lock
    and the transaction both end and the very next batch runs."""

    def breaks(ctx: EventContext, data: dict[str, Any]) -> None:
        raise IntegrityError("a constraint of the handler's own tables")

    copy = dict(HANDLERS)
    copy[("test.breaks", 1)] = EventHandler("test.breaks", 1, NotePayload, breaks)
    monkeypatch.setattr(registry, "HANDLERS", copy)
    phone = make_phone(make_member, org_a)

    failed = phone.sync([event(type="test.breaks")])
    again = phone.sync([event()])

    assert failed.status_code == 500
    assert again.status_code == 200


def test_a_final_upload_refused_with_sync_in_progress_is_not_spent(
    org_a: Organization, make_member: MemberFactory
) -> None:
    revoked = make_phone(make_member, org_a)
    live = second_device_of(revoked)
    revoke_session(
        revoked.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )
    answers: dict[str, Any] = {}
    thread = run_long_batch(live, [event(type="test.slow", payload={"text": "slow"})], answers)
    assert SLOW_STARTED.wait(10)

    refused = revoked.sync([event()])
    SLOW_RELEASE.set()
    thread.join(20)
    retried = revoked.sync([event()])

    assert (refused.status_code, refused.data["code"]) == (429, "sync_in_progress")
    assert (retried.status_code, retried.headers["X-Session-Revoked"]) == (200, "true")


def test_a_primary_key_insert_blocked_beyond_the_timeout_is_told_to_retry(
    org_a: Organization, org_b: Organization, make_member: MemberFactory, settings: Any
) -> None:
    """Another courier's open batch has already inserted the same event id (uncommitted): our
    insert waits on the unique index, and past the timeout the batch is 429, not a hang."""
    settings.SYNC_LOCK_TIMEOUT_MS = 300
    holder = make_phone(make_member, org_a)
    waiter = make_phone(make_member, org_b)
    shared = event(device_time=(timezone.now() - timedelta(seconds=30)).isoformat())
    answers: dict[str, Any] = {}
    thread = run_long_batch(
        holder, [shared, event(type="test.slow", payload={"text": "slow"})], answers
    )
    assert SLOW_STARTED.wait(10)

    refused = waiter.sync([shared])
    SLOW_RELEASE.set()
    thread.join(20)
    retried = waiter.sync([shared])

    assert (refused.status_code, refused.data["code"]) == (429, "sync_in_progress")
    assert int(refused.headers["Retry-After"]) > 0
    assert retried.data["results"][0]["code"] == "event_id_conflict"
    assert FieldEvent.objects.filter(pk=shared["id"]).count() == 1


def test_a_final_upload_blocked_beyond_the_timeout_is_not_spent(
    org_a: Organization, org_b: Organization, make_member: MemberFactory, settings: Any
) -> None:
    settings.SYNC_LOCK_TIMEOUT_MS = 300
    holder = make_phone(make_member, org_a)
    revoked = make_phone(make_member, org_b)
    revoke_session(
        revoked.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )
    shared = event(device_time=(timezone.now() - timedelta(seconds=30)).isoformat())
    answers: dict[str, Any] = {}
    thread = run_long_batch(
        holder, [shared, event(type="test.slow", payload={"text": "slow"})], answers
    )
    assert SLOW_STARTED.wait(10)

    refused = revoked.sync([shared])
    SLOW_RELEASE.set()
    thread.join(20)
    retried = revoked.sync([event()])

    assert (refused.status_code, refused.data["code"]) == (429, "sync_in_progress")
    assert (retried.status_code, retried.headers["X-Session-Revoked"]) == (200, "true")


def test_any_other_database_error_is_not_hidden_as_a_retry(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fails(batch: Any, envelopes: Any) -> Any:  # noqa: ANN401
        raise OperationalError("connection lost")

    monkeypatch.setattr("field_sync.services.ingest_batch", fails)
    phone = make_phone(make_member, org_a)

    response = phone.sync([event()])

    assert (response.status_code, response.data["code"]) == (500, "server_error")


def sync_until_answered(phone: Phone, events: list[dict[str, Any]]) -> Any:  # noqa: ANN401
    """What the app does on `sync_in_progress`: wait `Retry-After` and send the same batch."""
    for _ in range(20):
        response = phone.sync(events)
        if response.status_code != 429:
            return response
        time.sleep(0.2)
    return response


def test_batches_sharing_event_ids_in_opposite_orders_end_consistent(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    """Without per-id locks the two batches can deadlock on the primary key: PostgreSQL aborts
    one (40P01), the server answers 429, and the retry resolves per event."""
    mine = make_phone(make_member, org_a)
    theirs = make_phone(make_member, org_b)
    base = timezone.now()
    for _ in range(4):
        ids = [str(uuid.uuid4()) for _ in range(8)]
        forwards = [
            event(id=i, device_time=(base + timedelta(seconds=n)).isoformat())
            for n, i in enumerate(ids)
        ]
        backwards = [
            event(id=i, device_time=(base - timedelta(seconds=n)).isoformat())
            for n, i in enumerate(ids)
        ]

        outcomes = run_in_threads(
            partial(sync_until_answered, mine, forwards),
            partial(sync_until_answered, theirs, backwards),
        )

        assert all(not isinstance(o, Exception) for o in outcomes), outcomes
        assert [o.status_code for o in outcomes] == [200, 200]
        for event_id in ids:
            codes = sorted(
                result["code"]
                for outcome in outcomes
                for result in outcome.data["results"]
                if result["id"] == event_id
            )
            assert codes == ["accepted", "event_id_conflict"], event_id
        assert FieldEvent.objects.filter(pk__in=ids).count() == 8
