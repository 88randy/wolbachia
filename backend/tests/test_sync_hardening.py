"""Edge paths of the sync endpoint: hostile input, unexpected failures and races on rejections."""

from types import SimpleNamespace
from typing import Any

import pytest
from django.db import IntegrityError
from rest_framework.test import APIClient

from field_sync import registry
from field_sync.models import FieldEvent
from field_sync.registry import HANDLERS, EventContext, EventHandler
from field_sync.throttling import FieldSyncDeviceThrottle
from field_sync.views import declared_body_size
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
