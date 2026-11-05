"""Real PostgreSQL races and rollback of quota claims/alerts (#56). No timing sleeps."""

import logging
import threading
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from functools import partial

import pytest
from django.db import connection, transaction

from field_sync import registry, services
from field_sync.models import FieldEvent, RejectionQuotaCounter
from field_sync.registry import EventHandler
from reviews.models import ReviewItem
from tests.sync_support import event, make_phone, run_in_threads
from tests.testapp.handlers import NotePayload
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db(transaction=True)
RECEIVED_AT = datetime(2026, 11, 4, 18, tzinfo=UTC)


@pytest.fixture
def phones(org_a, make_member, settings, monkeypatch):
    settings.SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY = 5
    settings.SYNC_REJECTION_ALERT_PERCENTS = [80, 100]
    monkeypatch.setattr("field_sync.views.server_now", lambda: RECEIVED_AT)
    first = make_phone(make_member, org_a)
    second = make_phone(make_member, org_a, device_id=first.device_id)
    return first, second


def rejection(**overrides):
    return event(type="unknown.type", device_time=RECEIVED_AT.isoformat(), **overrides)


def quota_for(phone, count):
    return RejectionQuotaCounter.objects.create(
        organization=phone.organization,
        device_id=phone.device_id,
        local_date=RECEIVED_AT.date(),
        count=count,
    )


@pytest.mark.parametrize("initial_count", [None, 3])
def test_shared_device_concurrent_batches_never_exceed_remaining_slots(
    phones, monkeypatch, initial_count
):
    first, second = phones
    if initial_count is not None:
        quota_for(first, initial_count)
    barrier = threading.Barrier(2, timeout=10)
    local = threading.local()
    claim = services.claim_rejection_slot

    def meet_before_first_claim(batch, local_date):
        if not getattr(local, "has_met", False):
            local.has_met = True
            barrier.wait()
        return claim(batch, local_date)

    monkeypatch.setattr(services, "claim_rejection_slot", meet_before_first_claim)
    outcomes = run_in_threads(
        partial(first.sync, [rejection() for _ in range(3)]),
        partial(second.sync, [rejection() for _ in range(3)]),
    )

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    assert [outcome.status_code for outcome in outcomes] == [200, 200]
    codes = [result["code"] for outcome in outcomes for result in outcome.data["results"]]
    stored = 5 - (initial_count or 0)
    assert codes.count("unsupported_event_type") == stored
    assert codes.count("rejection_quota_exceeded") == 6 - stored
    assert FieldEvent.objects.count() == ReviewItem.objects.count() == stored
    assert RejectionQuotaCounter.objects.get(device_id=first.device_id).count == 5


@pytest.mark.parametrize("initial_count", [3, 4])
def test_shared_id_race_rolls_back_losing_claim_or_rechecks_replay_at_full_quota(
    phones, monkeypatch, caplog, initial_count
):
    first, second = phones
    quota = quota_for(first, initial_count)
    shared = rejection()
    barrier = threading.Barrier(2, timeout=10)
    local = threading.local()
    lookup = services.find_stored_event

    def meet_after_missing_lookup(event_id):
        stored = lookup(event_id)
        if str(event_id) == shared["id"] and not getattr(local, "has_met", False):
            assert stored is None
            local.has_met = True
            barrier.wait()
        return stored

    monkeypatch.setattr(services, "find_stored_event", meet_after_missing_lookup)
    with caplog.at_level(logging.WARNING, logger="field_sync.services"):
        outcomes = run_in_threads(partial(first.sync, [shared]), partial(second.sync, [shared]))

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    assert [outcome.status_code for outcome in outcomes] == [200, 200]
    assert sorted(outcome.data["results"][0]["code"] for outcome in outcomes) == [
        "event_id_conflict",
        "unsupported_event_type",
    ]
    assert FieldEvent.objects.filter(pk=shared["id"]).count() == 1
    assert ReviewItem.objects.filter(field_event_id=shared["id"]).count() == 1
    quota.refresh_from_db()
    assert quota.count == initial_count + 1
    alerts = [
        record for record in caplog.records if record.msg.startswith("Rejection quota threshold")
    ]
    assert [record.count for record in alerts] == [initial_count + 1]


@contextmanager
def locked_row(instance):
    holding, release = threading.Event(), threading.Event()

    def hold():
        try:
            with transaction.atomic():
                type(instance).objects.select_for_update().get(pk=instance.pk)
                holding.set()
                assert release.wait(20)
        finally:
            connection.close()

    thread = threading.Thread(target=hold)
    thread.start()
    try:
        assert holding.wait(10)
        yield
    finally:
        release.set()
        thread.join(20)
        assert not thread.is_alive()


def test_counter_row_wait_is_sync_in_progress_and_leaves_no_writes(phones, settings):
    first, second = phones
    quota = quota_for(first, 3)
    settings.SYNC_LOCK_TIMEOUT_MS = 100

    with locked_row(quota):
        response = second.sync([rejection()])

    assert (response.status_code, response.data["code"]) == (429, "sync_in_progress")
    assert int(response.headers["Retry-After"]) > 0
    quota.refresh_from_db()
    assert quota.count == 3
    assert not FieldEvent.objects.exists()
    assert not ReviewItem.objects.exists()


def test_later_batch_rollback_discards_claims_and_alerts_and_retry_alerts_once(
    phones, settings, caplog, monkeypatch
):
    first, _ = phones
    quota = quota_for(first, 3)
    settings.SYNC_LOCK_TIMEOUT_MS = 100
    widget = Widget.objects.create(organization=first.organization, name="locked")

    def lock_widget(ctx, data):
        Widget.objects.select_for_update().get(pk=widget.pk)

    handler = EventHandler("test.quota_lock", 1, NotePayload, lock_widget)
    monkeypatch.setattr(
        registry, "HANDLERS", {**registry.HANDLERS, (handler.event_type, 1): handler}
    )
    sent = [
        rejection(),
        rejection(),
        event(type="test.quota_lock", device_time=(RECEIVED_AT + timedelta(seconds=1)).isoformat()),
    ]
    with locked_row(widget), caplog.at_level(logging.WARNING, logger="field_sync.services"):
        failed = first.sync(sent)

    assert (failed.status_code, failed.data["code"]) == (429, "sync_in_progress")
    assert not [
        record for record in caplog.records if record.msg.startswith("Rejection quota threshold")
    ]
    quota.refresh_from_db()
    assert quota.count == 3
    assert not FieldEvent.objects.exists()
    assert not ReviewItem.objects.exists()

    with caplog.at_level(logging.WARNING, logger="field_sync.services"):
        retried = first.sync(sent)
    assert retried.status_code == 200
    quota.refresh_from_db()
    assert quota.count == 5
    assert [
        record.count
        for record in caplog.records
        if record.msg.startswith("Rejection quota threshold")
    ] == [4, 5]
