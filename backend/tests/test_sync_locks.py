"""Batch locks of `/field/sync/` with real transactions: one batch per courier (never waiting) and
ordered locks on shared event ids (never deadlocking)."""

import threading
import uuid
from datetime import timedelta
from functools import partial
from typing import Any

import pytest
from django.db import IntegrityError, OperationalError, connection, transaction
from django.utils import timezone

from accounts.models import Device, RevokeReason
from accounts.revocation import Revocation, revoke_session
from field_sync import registry
from field_sync.models import FieldEvent
from field_sync.registry import HANDLERS, EventContext, EventHandler
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.sync_support import Phone, event, make_phone, run_in_threads, second_device_of
from tests.testapp.handlers import (
    RENDEZVOUS,
    RENDEZVOUS_ACTIVE,
    SLOW_RELEASE,
    SLOW_STARTED,
    NotePayload,
)
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


def test_mixed_supply_final_upload_prepares_real_author_and_fresh_denial_beats_busy_user(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    from dataclasses import replace
    from decimal import Decimal

    from accounts.models import User
    from accounts.revocation import cancel_final_uploads
    from field_sync.views import FieldSyncViewSet
    from inventory.allocations.commands import AssignmentWrite, IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import OriginReleaseLine, SupplyReceipt
    from inventory.allocations.services import write_assignment
    from organizations.models import Membership
    from tests.factories import MotorcycleFactory
    from tests.inventory_support import AT, allow_all, inventory_context
    from tests.shift_support import make_check_items, open_event
    from tests.test_inventory_transfers_106 import verified_upload

    warehouse = inventory_context(org_a, make_member)
    warehouse.profile.permission_codes = [*warehouse.profile.permission_codes, "inventory.allocate"]
    warehouse.profile.save(update_fields=["permission_codes"])
    phone = make_phone(
        make_member, org_a, codes=("field_event.sync", "supply_assignment.receive", "field.upload")
    )
    allow_all(Membership.objects.get(organization=org_a, user=phone.user))
    make_check_items(org_a)
    motorcycle = MotorcycleFactory(organization=org_a, center=warehouse.center)
    opened = open_event(motorcycle.code)
    assert phone.sync([opened]).data["results"][0]["status"] == "accepted"
    written = write_assignment(
        AssignmentWrite(
            warehouse.actor,
            {
                "command_id": uuid.uuid4(),
                "courier_id": phone.user.pk,
                "origin_id": warehouse.location.pk,
                "date": AT.date(),
                "shift_id": uuid.UUID(opened["shift_id"]),
                "lines": [
                    {
                        "id": uuid.uuid4(),
                        "lot_id": warehouse.lot.pk,
                        "piece_id": None,
                        "unit_version_id": warehouse.supply_version.pk,
                        "quantity": Decimal(1),
                    }
                ],
            },
        )
    )
    assignment_id = uuid.UUID(written.body["assignment"]["id"])
    prepared = prepare_inventory_intent(
        warehouse.actor,
        {
            "command_id": uuid.uuid4(),
            "kind": "assignment_release",
            "assignment_id": assignment_id,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    execute_inventory_intent(
        warehouse.actor,
        IntentExecution(
            uuid.UUID(prepared.body["intent"]["id"]), "assignment_release", assignment_id
        ),
    )
    actor = replace(warehouse.actor, user=phone.user, device_id=phone.device_id)
    release_line = OriginReleaseLine.objects.get()
    capture = event(
        type="supplies.receive",
        shift_id=opened["shift_id"],
        payload={
            "command_id": str(uuid.uuid4()),
            "assignment_id": str(assignment_id),
            "expected_revision": 0,
            "plan_revision": 1,
            "release_id": str(release_line.release_id),
            "signature_upload_id": str(verified_upload(actor)),
            "actual_lines": [
                {"id": str(uuid.uuid4()), "release_line_id": str(release_line.pk), "quantity": "1"}
            ],
            "discrepancies": [],
        },
    )
    revoke_session(
        phone.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )
    real_prepare = FieldSyncViewSet.prepare_final_upload_participants
    withdrawn = False

    def prepare(view, request):
        participants = real_prepare(view, request)
        if withdrawn:
            cancel_final_uploads(request.user)
        return participants

    monkeypatch.setattr(FieldSyncViewSet, "prepare_final_upload_participants", prepare)
    ready, release = threading.Event(), threading.Event()

    def hold_author():
        try:
            with transaction.atomic():
                User.objects.select_for_update(no_key=True).get(pk=warehouse.actor.user.pk)
                ready.set()
                assert release.wait(10)
        finally:
            connection.close()

    thread = threading.Thread(target=hold_author)
    thread.start()
    try:
        assert ready.wait(10)
        note = event()
        busy = phone.sync([note, capture])
        assert (busy.status_code, busy.data["code"]) == (429, "sync_in_progress")
        phone.issued.session.refresh_from_db()
        assert phone.issued.session.final_upload_used_at is None
        withdrawn = True
        denied = phone.sync([note, capture])
        assert (denied.status_code, denied.data["code"]) == (401, "session_revoked")
        phone.issued.session.refresh_from_db()
        assert phone.issued.session.final_upload_used_at is None
        assert not FieldEvent.objects.filter(pk__in=(note["id"], capture["id"])).exists()
        assert not SupplyReceipt.objects.exists()
    finally:
        release.set()
        thread.join(20)
    assert not thread.is_alive()


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


def test_a_forced_deadlock_on_shared_ids_is_a_429_and_the_retry_ends_consistent(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    """A inserts X then waits at a barrier; B inserts Y then waits. Past the barrier A needs Y
    (held by B) and B needs X (held by A): a guaranteed circular wait. PostgreSQL aborts one side
    (40P01), which must be answered 429 sync_in_progress; the retry then resolves per event."""
    mine = make_phone(make_member, org_a)
    theirs = make_phone(make_member, org_b)
    x, y = str(uuid.uuid4()), str(uuid.uuid4())
    base = timezone.now()

    def at(seconds: int) -> str:
        return (base + timedelta(seconds=seconds)).isoformat()

    mine_events = [
        event(id=x, device_time=at(0)),
        event(id=y, device_time=at(1), type="test.rendezvous"),
    ]
    theirs_events = [
        event(id=y, device_time=at(0)),
        event(id=x, device_time=at(1), type="test.rendezvous"),
    ]
    RENDEZVOUS.reset()
    RENDEZVOUS_ACTIVE.set()
    try:
        outcomes = run_in_threads(
            partial(mine.sync, mine_events), partial(theirs.sync, theirs_events)
        )
    finally:
        RENDEZVOUS_ACTIVE.clear()

    assert all(not isinstance(o, Exception) for o in outcomes), outcomes
    assert sorted(o.status_code for o in outcomes) == [200, 429]
    victim_index = next(i for i, o in enumerate(outcomes) if o.status_code == 429)
    assert outcomes[victim_index].data["code"] == "sync_in_progress"
    assert int(outcomes[victim_index].headers["Retry-After"]) > 0
    victim, victim_events = [(mine, mine_events), (theirs, theirs_events)][victim_index]
    retried = victim.sync(victim_events)
    survivor = outcomes[1 - victim_index]
    assert retried.status_code == 200
    for event_id in (x, y):
        codes = sorted(
            result["code"]
            for answer in (survivor, retried)
            for result in answer.data["results"]
            if result["id"] == event_id
        )
        assert codes == ["accepted", "event_id_conflict"], event_id
    assert FieldEvent.objects.filter(pk__in=[x, y]).count() == 2


def test_a_final_upload_blocked_on_a_device_row_beyond_the_timeout_is_a_429_and_not_spent(
    org_a: Organization, make_member: MemberFactory, settings: Any
) -> None:
    """The foreign key to the `Device` row is checked inside the batch (not at the mixin's
    commit, where a lock timeout would be a 500): a login holding the row gets a 429."""
    settings.SYNC_LOCK_TIMEOUT_MS = 300
    phone = make_phone(make_member, org_a)
    revoke_session(
        phone.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )
    holding, release = threading.Event(), threading.Event()

    def hold_the_device_row() -> None:
        try:
            with transaction.atomic():
                Device.objects.select_for_update().get(pk=phone.device_id)
                holding.set()
                release.wait(20)
        finally:
            connection.close()

    thread = threading.Thread(target=hold_the_device_row)
    thread.start()
    assert holding.wait(10)

    refused = phone.sync([event()])
    release.set()
    thread.join(20)
    retried = phone.sync([event()])

    assert (refused.status_code, refused.data["code"]) == (429, "sync_in_progress")
    assert int(refused.headers["Retry-After"]) > 0
    assert (retried.status_code, retried.headers["X-Session-Revoked"]) == (200, "true")
    assert FieldEvent.objects.count() == 1
