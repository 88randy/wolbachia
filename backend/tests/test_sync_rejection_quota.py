"""Stored rejection budgets: partial ingestion, replay, local days and committed alerts (#56)."""

import logging
from datetime import UTC, datetime, timedelta

import pytest

from field_sync.models import FieldEvent, RejectionQuotaCounter
from reviews.models import ReviewItem
from tests.sync_support import event, make_phone, second_device_of
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db
RECEIVED_AT = datetime(2026, 11, 4, 18, tzinfo=UTC)  # noon in Mexico City


@pytest.fixture
def phone(org_a, make_member, settings, monkeypatch):
    settings.SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY = 2
    monkeypatch.setattr("field_sync.views.server_now", lambda: RECEIVED_AT)
    return make_phone(make_member, org_a)


def rejected(**overrides):
    return event(type="unknown.type", device_time=RECEIVED_AT.isoformat(), **overrides)


@pytest.mark.parametrize("split_batches", [False, True])
def test_nth_rejection_is_stored_but_next_has_no_event_or_review(phone, split_batches):
    sent = [rejected() for _ in range(3)]
    for index, envelope in enumerate(sent):
        envelope["device_time"] = (RECEIVED_AT + timedelta(seconds=index)).isoformat()

    if split_batches:
        first = phone.sync(sent[:2])
        response = phone.sync(sent[2:])
        results = first.data["results"] + response.data["results"]
    else:
        response = phone.sync(sent)
        results = response.data["results"]

    assert response.status_code == 200
    assert [result["code"] for result in results] == [
        "unsupported_event_type",
        "unsupported_event_type",
        "rejection_quota_exceeded",
    ]
    assert results[-1] == {
        "id": sent[-1]["id"],
        "status": "rejected",
        "code": "rejection_quota_exceeded",
        "params": {"retry_after_seconds": 43200},
    }
    assert response.headers["Retry-After"] == "43200"
    assert set(map(str, FieldEvent.objects.values_list("id", flat=True))) == {
        sent[0]["id"],
        sent[1]["id"],
    }
    assert set(map(str, ReviewItem.objects.values_list("field_event_id", flat=True))) == {
        sent[0]["id"],
        sent[1]["id"],
    }
    assert RejectionQuotaCounter.objects.get(device_id=phone.device_id).count == 2


def test_exhausted_quota_keeps_accepted_and_in_review_events_and_header_is_conditional(phone):
    first = phone.sync([rejected(), rejected()])
    assert "Retry-After" not in first.headers
    accepted = event(device_time=(RECEIVED_AT + timedelta(seconds=1)).isoformat())
    review = event(
        type="test.needs_review", device_time=(RECEIVED_AT + timedelta(seconds=2)).isoformat()
    )

    blocked = event(type="test.reject_after_write", device_time=RECEIVED_AT.isoformat())
    response = phone.sync([blocked, accepted, review])

    assert response.status_code == 200
    assert [result["code"] for result in response.data["results"]] == [
        "rejection_quota_exceeded",
        "accepted",
        "test_review",
    ]
    assert response.headers["Retry-After"] == "43200"
    assert not Widget.objects.filter(name="written-before-rejection").exists()
    assert not FieldEvent.objects.filter(pk=blocked["id"]).exists()
    assert FieldEvent.objects.get(pk=accepted["id"]).status == "accepted"
    assert ReviewItem.objects.get(field_event_id=review["id"]).kind == "in_review"
    assert RejectionQuotaCounter.objects.get(device_id=phone.device_id).count == 2
    assert "Retry-After" not in phone.sync([accepted, review]).headers


def test_stored_rejection_replays_without_spending_slots_even_at_limit(phone):
    sent = rejected()
    original = phone.sync([sent]).data["results"][0]

    response = phone.sync([sent, sent, rejected()])
    replay = phone.sync([sent])

    assert response.data["results"][:2] == [original, original]
    assert response.data["results"][2]["code"] == "unsupported_event_type"
    assert replay.data["results"] == [original]
    assert "Retry-After" not in replay.headers
    assert RejectionQuotaCounter.objects.get(device_id=phone.device_id).count == 2
    assert ReviewItem.objects.count() == 2


def test_blocked_event_retries_after_local_midnight_and_other_device_is_free(phone, monkeypatch):
    phone.sync([rejected(), rejected()])
    blocked = rejected()
    monkeypatch.setattr("field_sync.views.server_now", lambda: datetime(2026, 11, 5, tzinfo=UTC))
    utc_midnight = phone.sync([blocked])
    assert utc_midnight.data["results"][0]["params"] == {"retry_after_seconds": 21600}
    assert (
        second_device_of(phone).sync([rejected()]).data["results"][0]["code"]
        == "unsupported_event_type"
    )

    monkeypatch.setattr(
        "field_sync.views.server_now", lambda: datetime(2026, 11, 5, 5, 59, 59, 500000, tzinfo=UTC)
    )
    near_midnight = phone.sync([blocked])
    assert near_midnight.headers["Retry-After"] == "1"
    assert near_midnight.data["results"][0]["params"] == {"retry_after_seconds": 1}

    monkeypatch.setattr("field_sync.views.server_now", lambda: datetime(2026, 11, 5, 6, tzinfo=UTC))
    response = phone.sync([blocked])

    assert response.data["results"][0]["code"] == "unsupported_event_type"
    assert "Retry-After" not in response.headers
    assert FieldEvent.objects.filter(pk=blocked["id"]).exists()
    assert list(
        RejectionQuotaCounter.objects.filter(device_id=phone.device_id)
        .order_by("local_date")
        .values_list("local_date", "count")
    ) == [(RECEIVED_AT.date(), 2), ((RECEIVED_AT + timedelta(days=1)).date(), 1)]


@pytest.mark.parametrize(
    ("percents", "expected_counts"), [([80, 100], [4, 5]), ([25, 60, 100], [2, 3, 5])]
)
def test_alerts_fire_once_at_rounded_up_thresholds_after_commit_not_on_replays(
    phone, settings, django_capture_on_commit_callbacks, caplog, percents, expected_counts
):
    settings.SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY = 5
    settings.SYNC_REJECTION_ALERT_PERCENTS = percents
    sent = [rejected() for _ in range(6)]

    with caplog.at_level(logging.WARNING, logger="field_sync.services"):
        with django_capture_on_commit_callbacks(execute=True):
            phone.sync(sent)
        with django_capture_on_commit_callbacks(execute=True):
            phone.sync(sent)

    alerts = [
        record for record in caplog.records if record.msg.startswith("Rejection quota threshold")
    ]
    assert [record.count for record in alerts] == expected_counts
    assert [record.threshold_percent for record in alerts] == percents
    assert all(
        (record.organization, record.device, record.local_date, record.limit)
        == (str(phone.organization.pk), str(phone.device_id), "2026-11-04", 5)
        for record in alerts
    )
