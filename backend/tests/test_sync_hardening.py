"""Edge paths of the sync endpoint: hostile input, unexpected failures and races on rejections."""

import json
import logging
from types import SimpleNamespace
from typing import Any

import pytest
from django.db import IntegrityError
from rest_framework.test import APIClient

from field_sync import registry
from field_sync.models import FieldEvent
from field_sync.permissions import declared_body_size
from field_sync.registry import HANDLERS, EventContext, EventHandler
from field_sync.throttling import FieldSyncDeviceThrottle
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.sync_support import SYNC, Phone, batch, event, make_phone, run_in_threads
from tests.testapp.handlers import NotePayload, write_widget
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


@pytest.mark.parametrize(("header", "expected"), [("123", 123), ("abc", 0), ("", 0), (None, 0)])
def test_the_declared_body_size_tolerates_a_missing_or_broken_header(
    header: str | None, expected: int
) -> None:
    request: Any = SimpleNamespace(META={} if header is None else {"CONTENT_LENGTH": header})

    assert declared_body_size(request) == expected


def test_the_throttle_ignores_requests_without_a_device_session() -> None:
    throttle = FieldSyncDeviceThrottle()
    request: Any = SimpleNamespace(auth=None)

    assert throttle.get_cache_key(request, None) is None  # type: ignore[arg-type]


def test_a_request_authenticated_some_other_way_is_still_refused(phone: Phone) -> None:
    client = APIClient()
    client.force_authenticate(phone.user)  # bypasses the bearer authenticator: no device session

    response = client.post(SYNC, batch(phone, [event()]), format="json")

    assert (response.status_code, response.data["code"]) == (401, "not_authenticated")
    assert not FieldEvent.objects.exists()


def test_a_payload_the_serializer_cannot_walk_is_a_parse_error_not_a_500(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    def too_deep(events: list[dict[str, Any]]) -> list[Any]:
        raise RecursionError

    monkeypatch.setattr("field_sync.views.build_envelopes", too_deep)

    response = phone.sync([event()])

    assert (response.status_code, response.data["code"]) == (400, "parse_error")


def test_a_nul_payload_with_numbers_and_nulls_is_stored_without_losing_them(phone: Phone) -> None:
    sent = event(payload={"text": "a\u0000", "count": 3, "none": None, "flag": True})

    phone.sync([sent])

    assert FieldEvent.objects.get(pk=sent["id"]).payload == {
        "text": "a�",
        "count": 3,
        "none": None,
        "flag": True,
    }


def test_an_integrity_error_that_is_not_a_duplicate_id_is_a_server_error_and_stores_nothing(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    def breaks(ctx: EventContext, data: dict[str, Any]) -> None:
        write_widget(ctx, "before-the-failure")
        raise IntegrityError("a constraint of the handler's own tables")

    copy = dict(HANDLERS)
    copy[("test.breaks", 1)] = EventHandler("test.breaks", 1, NotePayload, breaks)
    monkeypatch.setattr(registry, "HANDLERS", copy)

    response = phone.sync([event(type="test.breaks")])

    assert (response.status_code, response.data["code"]) == (500, "server_error")
    assert not FieldEvent.objects.exists()
    assert not Widget.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_rejected_duplicates_from_two_organizations_leave_one_winner(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    mine = make_phone(make_member, org_a)
    theirs = make_phone(make_member, org_b)
    contested = event(type="unknown.type")

    outcomes = run_in_threads(lambda: mine.sync([contested]), lambda: theirs.sync([contested]))

    assert all(not isinstance(outcome, Exception) for outcome in outcomes), outcomes
    codes = sorted(outcome.data["results"][0]["code"] for outcome in outcomes)
    assert codes == ["event_id_conflict", "unsupported_event_type"]
    assert FieldEvent.objects.filter(pk=contested["id"]).count() == 1


# --- values the database cannot hold, and implausible times -------------------------------


def post_raw(
    phone: Phone,
    body: dict[str, Any],
    replacements: dict[str, str] | None = None,
) -> Any:  # noqa: ANN401
    """Send JSON text exactly as written: `ensure_ascii` keeps a lone surrogate as an escape, and
    placeholders stand in for numbers (`1e400`) that Python would not serialize."""
    text = json.dumps(body)
    for placeholder, literal in (replacements or {}).items():
        text = text.replace(f'"{placeholder}"', literal)
    return phone.client.post(SYNC, text, content_type="application/json")


def test_a_lone_surrogate_rejects_that_event_only_and_stores_a_marker(phone: Phone) -> None:
    bad, good = event(payload={"text": "a\ud800b"}), event()

    response = post_raw(phone, batch(phone, [bad, good]))

    first, second = response.data["results"]
    assert response.status_code == 200
    assert (first["code"], first["params"]) == (
        "invalid_payload",
        {"fields": {"payload": ["not_storable"]}},
    )
    assert second["status"] == "accepted"
    assert FieldEvent.objects.get(pk=bad["id"]).payload == {
        "_not_stored": "invalid_payload",
        "size_bytes": None,
    }


@pytest.mark.parametrize("literal", ["1e400", "-1e400"])
def test_a_non_finite_number_rejects_that_event_only(phone: Phone, literal: str) -> None:
    bad = event(payload={"n": "NUMBER"})

    response = post_raw(phone, batch(phone, [bad, event()]), {"NUMBER": literal})

    assert response.status_code == 200
    assert response.data["results"][0]["params"] == {"fields": {"payload": ["not_storable"]}}
    assert response.data["results"][1]["status"] == "accepted"
    assert FieldEvent.objects.get(pk=bad["id"]).payload["_not_stored"] == "invalid_payload"


def test_a_lone_surrogate_in_a_version_token_is_a_validation_error_not_a_500(phone: Phone) -> None:
    response = post_raw(phone, batch(phone, [event(rules_version="x\ud800")]))

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
    assert "events.0.rules_version" in response.data["fields"]


def test_a_lone_surrogate_in_the_cursor_is_a_validation_error_not_a_500(phone: Phone) -> None:
    response = post_raw(phone, batch(phone, [], cursor="x\ud800"))

    assert (response.status_code, response.data["code"]) == (400, "validation_error")


@pytest.mark.parametrize(
    "sent_at", ["2019-12-31T23:59:59Z", "2100-01-01T00:00:00Z", "0001-01-01T00:00:00Z"]
)
def test_a_send_time_outside_the_plausible_range_is_a_validation_error(
    phone: Phone, sent_at: str
) -> None:
    response = phone.sync([event()], sent_at=sent_at)

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
    assert response.data["fields"]["sent_at"][0]["code"] == "out_of_range"
    assert not FieldEvent.objects.exists()


@pytest.mark.parametrize("device_time", ["2019-12-31T23:59:59Z", "2100-01-01T00:00:00Z"])
def test_an_event_time_outside_the_plausible_range_rejects_that_event_only(
    phone: Phone, device_time: str
) -> None:
    response = phone.sync([event(device_time=device_time), event()])

    first, second = response.data["results"]
    assert (first["code"], first["params"]) == (
        "invalid_payload",
        {"fields": {"device_time": ["out_of_range"]}},
    )
    assert second["status"] == "accepted"


@pytest.mark.parametrize(
    "extreme", ["0001-01-01T00:00:00+14:00", "9999-12-31T23:59:59-14:00", "9999-12-31T23:59:59Z"]
)
def test_extreme_timestamps_are_never_a_server_error(phone: Phone, extreme: str) -> None:
    answers = (phone.sync([event(device_time=extreme)]), phone.sync([event()], sent_at=extreme))

    assert answers[0].status_code in (200, 400)  # rejected event, or an overflow refused
    assert answers[1].status_code == 400


def test_the_largest_plausible_skew_fits_the_column(
    org_a: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_a)
    sent = event()

    response = phone.sync([sent], sent_at="2099-12-31T00:00:00Z")

    assert response.status_code == 200
    assert FieldEvent.objects.get(pk=sent["id"]).clock_skew_seconds > 2**31


def test_the_no_threshold_warning_is_logged_once_per_organization(
    phone: Phone, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="field_sync.clock"):
        for _ in range(3):
            phone.sync([])

    assert caplog.text.count("threshold not configured") == 1
