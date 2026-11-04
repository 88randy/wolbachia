"""Clock skew in `/field/sync/`: `sent_at` against the server clock, review instead of rejection."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from django.utils import timezone

from field_sync.models import FieldEvent
from organizations.models import Organization
from reviews.models import ReviewItem
from tests.conftest import MemberFactory
from tests.factories import RuleParameterFactory, RuleParameterVersionFactory
from tests.sync_support import SKEW_KEY, Phone, configure_clock_skew, event, make_phone

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 4, 12, 0, tzinfo=UTC)
THRESHOLD = 300


@pytest.fixture(autouse=True)
def frozen_now(monkeypatch: pytest.MonkeyPatch) -> datetime:
    """The server clock is fixed, so skew is exact (tokens are issued with the same clock)."""
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    return NOW


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    configure_clock_skew(org_a, THRESHOLD)
    return make_phone(make_member, org_a)


def sync_at(phone: Phone, sent_at: datetime, *events: dict[str, Any]) -> list[dict[str, Any]]:
    response = phone.sync(list(events), sent_at=sent_at.isoformat())
    assert response.status_code == 200, response.data
    return response.data["results"]  # type: ignore[no-any-return]


@pytest.mark.parametrize("skew", [THRESHOLD + 1, -(THRESHOLD + 1), 6 * 3600])
def test_a_skewed_batch_sends_every_event_to_review_and_none_is_rejected(
    phone: Phone, skew: int
) -> None:
    first, second = event(), event()

    results = sync_at(phone, NOW + timedelta(seconds=skew), first, second)

    assert [(r["status"], r["code"]) for r in results] == [("in_review", "clock_skew")] * 2
    assert results[0]["params"] == {"skew_seconds": skew, "threshold_seconds": THRESHOLD}
    stored = FieldEvent.objects.get(pk=first["id"])
    assert (stored.status, stored.clock_skew_seconds) == ("in_review", skew)
    assert ReviewItem.objects.filter(kind="in_review", code="clock_skew").count() == 2


@pytest.mark.parametrize("skew", [0, 60, THRESHOLD, -THRESHOLD])
def test_a_batch_within_the_threshold_is_accepted_and_keeps_its_skew(
    phone: Phone, skew: int
) -> None:
    sent = event()

    results = sync_at(phone, NOW + timedelta(seconds=skew), sent)

    assert results[0]["status"] == "accepted"
    assert FieldEvent.objects.get(pk=sent["id"]).clock_skew_seconds == skew
    assert not ReviewItem.objects.exists()


def test_an_old_event_sent_late_is_not_flagged_for_being_old(phone: Phone) -> None:
    offline_for_two_days = event(device_time=(NOW - timedelta(days=2)).isoformat())

    results = sync_at(phone, NOW, offline_for_two_days)

    assert results[0]["status"] == "accepted"


def test_an_event_dated_in_the_future_goes_to_review_even_when_the_batch_clock_is_fine(
    phone: Phone,
) -> None:
    fine = event(device_time=(NOW + timedelta(seconds=THRESHOLD)).isoformat())
    from_the_future = event(device_time=(NOW + timedelta(seconds=THRESHOLD + 1)).isoformat())

    results = sync_at(phone, NOW, fine, from_the_future)

    assert [(r["status"], r["code"]) for r in results] == [
        ("accepted", "accepted"),
        ("in_review", "clock_skew"),
    ]


def test_without_a_configured_threshold_nothing_is_flagged_but_the_skew_is_stored(
    org_b: Organization, make_member: MemberFactory, caplog: pytest.LogCaptureFixture
) -> None:
    RuleParameterFactory(organization=org_b, key=SKEW_KEY)  # exists, but has no value
    phone = make_phone(make_member, org_b)
    sent = event(device_time=(NOW + timedelta(days=1)).isoformat())

    with caplog.at_level(logging.WARNING, logger="field_sync.clock"):
        results = sync_at(phone, NOW + timedelta(days=1), sent)

    assert results[0]["status"] == "accepted"
    assert FieldEvent.objects.get(pk=sent["id"]).clock_skew_seconds == 86400
    assert "threshold not configured" in caplog.text


def test_an_organization_with_no_such_parameter_at_all_behaves_the_same(
    org_b: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_b)

    results = sync_at(phone, NOW + timedelta(days=1), event())

    assert results[0]["status"] == "accepted"


def test_the_threshold_is_the_value_in_force_when_the_server_received_the_batch(
    org_b: Organization, make_member: MemberFactory
) -> None:
    parameter = RuleParameterFactory(organization=org_b, key=SKEW_KEY)
    RuleParameterVersionFactory(
        parameter=parameter, value=30, effective_from=NOW - timedelta(days=10)
    )
    RuleParameterVersionFactory(
        parameter=parameter, value=10, effective_from=NOW - timedelta(hours=1)
    )
    RuleParameterVersionFactory(
        parameter=parameter, value=100_000, effective_from=NOW + timedelta(days=1)
    )
    phone = make_phone(make_member, org_b)

    results = sync_at(phone, NOW + timedelta(seconds=20), event())

    assert results[0]["status"] == "in_review"
    assert results[0]["params"]["threshold_seconds"] == 10  # not 30, not the scheduled 100000


def test_the_threshold_of_another_organization_is_never_used(
    phone: Phone, org_b: Organization, make_member: MemberFactory
) -> None:
    other = make_phone(make_member, org_b)
    configure_clock_skew(org_b, 100_000)

    mine = sync_at(phone, NOW + timedelta(seconds=600), event())
    theirs = sync_at(other, NOW + timedelta(seconds=600), event())

    assert (mine[0]["status"], theirs[0]["status"]) == ("in_review", "accepted")


def test_rejected_beats_in_review_when_the_batch_is_skewed(phone: Phone) -> None:
    invalid = event(payload={})

    results = sync_at(phone, NOW + timedelta(hours=1), invalid, event())

    assert [(r["status"], r["code"]) for r in results] == [
        ("rejected", "invalid_payload"),
        ("in_review", "clock_skew"),
    ]
