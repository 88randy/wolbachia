"""`changes` of the sync answer: the courier's review items behind a signed cursor, snapshot versions."""

import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from django.core import signing
from django.test import override_settings
from django.utils import timezone

from catalogs.selectors import build_catalog_snapshot
from field_sync.cursor import ChangesCursor, decode_cursor, encode_cursor
from field_sync.exceptions import InvalidCursorError
from field_sync.models import FieldEvent
from organizations.models import Organization
from rules.selectors import build_rules_snapshot
from tests.conftest import MemberFactory
from tests.factories import CatalogFactory, CatalogItemFactory
from tests.sync_support import SYNC, Phone, batch, event, make_phone

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 4, 12, 0, tzinfo=UTC)


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def rejected_events(count: int) -> list[dict[str, Any]]:
    return [event(type="unknown.type") for _ in range(count)]


def review_ids(response: Any) -> list[str]:  # noqa: ANN401
    assert response.status_code == 200, response.data
    return [item["id"] for item in response.data["changes"]["reviews"]]


def test_the_couriers_rejected_event_comes_back_as_a_review_in_the_same_answer(
    phone: Phone,
) -> None:
    sent = event(type="unknown.type")

    changes = phone.sync([sent]).data["changes"]

    assert len(changes["reviews"]) == 1
    review = changes["reviews"][0]
    assert set(review) == {"id", "event_id", "kind", "code", "params", "created_at"}
    assert (review["event_id"], review["kind"], review["code"]) == (
        sent["id"],
        "rejected",
        "unsupported_event_type",
    )
    assert review["params"] == {"type": "unknown.type", "schema_version": 1}
    assert changes["has_more"] is False


def test_changes_only_hold_the_requesting_couriers_items_of_their_organization(
    phone: Phone, org_b: Organization, make_member: MemberFactory
) -> None:
    colleague = make_phone(make_member, phone.organization)
    foreign = make_phone(make_member, org_b)
    colleague.sync(rejected_events(2))
    foreign.sync(rejected_events(2))
    mine = event(type="unknown.type")

    response = phone.sync([mine])

    assert [r["event_id"] for r in response.data["changes"]["reviews"]] == [mine["id"]]


def test_a_fresh_courier_with_nothing_to_pull_still_gets_a_cursor(phone: Phone) -> None:
    changes = phone.sync([]).data["changes"]

    assert changes["reviews"] == []
    assert isinstance(changes["cursor"], str)
    assert changes["has_more"] is False


def test_a_long_backlog_is_paged_with_no_repeats_and_ends(phone: Phone) -> None:
    sent = rejected_events(5)
    phone.sync(sent)  # five review items created in the same instant

    with override_settings(API_CURSOR_PAGE_SIZE=2):
        pages, cursor = [], None
        for _ in range(10):
            body: dict[str, Any] = {} if cursor is None else {"cursor": cursor}
            response = phone.sync([], **body)
            pages.append(review_ids(response))
            cursor = response.data["changes"]["cursor"]
            if not response.data["changes"]["has_more"]:
                break

    assert [len(page) for page in pages] == [2, 2, 1]
    flat = [item for page in pages for item in page]
    assert len(set(flat)) == 5


def test_a_caught_up_pull_returns_nothing_twice_and_the_cursor_never_moves_back(
    phone: Phone,
) -> None:
    first = phone.sync(rejected_events(1))
    item = review_ids(first)

    second = phone.sync([], cursor=first.data["changes"]["cursor"])
    third = phone.sync([], cursor=second.data["changes"]["cursor"])

    assert len(item) == 1
    assert (review_ids(second), review_ids(third)) == ([], [])  # strict: no overlap, no repeats


def test_a_cursor_older_than_its_maximum_age_is_refused(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    cursor = phone.sync([]).data["changes"]["cursor"]
    real_time = signing.time.time
    monkeypatch.setattr(signing.time, "time", lambda: real_time() + 8 * 24 * 3600)

    refused = phone.client.post(SYNC, batch(phone, [], cursor=cursor), format="json")

    assert (refused.status_code, refused.data["code"]) == (400, "invalid_cursor")


def test_a_cursor_within_its_maximum_age_is_accepted(
    phone: Phone, monkeypatch: pytest.MonkeyPatch
) -> None:
    cursor = phone.sync([]).data["changes"]["cursor"]
    real_time = signing.time.time
    monkeypatch.setattr(signing.time, "time", lambda: real_time() + 6 * 24 * 3600)

    accepted = phone.client.post(SYNC, batch(phone, [], cursor=cursor), format="json")

    assert accepted.status_code == 200


@pytest.mark.parametrize("token", ["garbage", "a.b.c", "x" * 300])
def test_a_cursor_that_was_not_issued_by_the_server_is_refused_and_nothing_is_ingested(
    phone: Phone, token: str
) -> None:
    response = phone.sync([event()], cursor=token)

    assert (response.status_code, response.data["code"]) == (400, "invalid_cursor")
    assert not FieldEvent.objects.exists()


def test_a_tampered_cursor_is_refused(phone: Phone) -> None:
    good = phone.sync([]).data["changes"]["cursor"]
    tampered = good[:-3] + ("AAA" if not good.endswith("AAA") else "BBB")

    response = phone.sync([event()], cursor=tampered)

    assert (response.status_code, response.data["code"]) == (400, "invalid_cursor")


def test_a_cursor_is_bound_to_its_user_and_its_organization(
    phone: Phone, org_b: Organization, make_member: MemberFactory
) -> None:
    other_user = make_phone(make_member, phone.organization)
    other_org = make_phone(make_member, org_b)
    cursor = phone.sync([]).data["changes"]["cursor"]

    for stranger in (other_user, other_org):
        response = stranger.sync([], cursor=cursor)
        assert (response.status_code, response.data["code"]) == (400, "invalid_cursor")


def test_the_versions_are_the_hashes_of_the_snapshots_and_move_when_the_content_does(
    phone: Phone,
) -> None:
    organization = phone.organization
    catalog = CatalogFactory(organization=organization)

    before = phone.sync([]).data["changes"]
    CatalogItemFactory(catalog=catalog)
    after = phone.sync([]).data["changes"]

    assert after["catalog_version"] == build_catalog_snapshot(organization)["version"]
    assert after["rules_version"] == build_rules_snapshot(organization, timezone.now())["version"]
    assert before["catalog_version"] != after["catalog_version"]


# --- the cursor itself ---------------------------------------------------------------------


def test_cursor_roundtrip_keeps_position_and_mode() -> None:
    organization_id, user_id, item_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    position = ChangesCursor(NOW, item_id)

    token = encode_cursor(organization_id, user_id, position)

    assert decode_cursor(token, organization_id, user_id) == position
    assert decode_cursor(None, organization_id, user_id) == ChangesCursor()


def test_cursor_for_another_user_or_organization_does_not_decode() -> None:
    organization_id, user_id = uuid.uuid4(), uuid.uuid4()
    token = encode_cursor(organization_id, user_id, ChangesCursor())

    with pytest.raises(InvalidCursorError):
        decode_cursor(token, organization_id, uuid.uuid4())
    with pytest.raises(InvalidCursorError):
        decode_cursor(token, uuid.uuid4(), user_id)
