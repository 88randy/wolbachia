"""`GET /review-items/`: what supervisors see of rejected and in-review events."""

from typing import Any

import pytest
from rest_framework.test import APIClient

from organizations.models import Organization
from reviews.models import ReviewItem
from reviews.permissions import REVIEW_ITEM_READ
from reviews.views import ReviewItemPagination
from tests.conftest import MemberFactory
from tests.factories import ReviewItemFactory
from tests.sync_support import event, make_phone

pytestmark = pytest.mark.django_db

REVIEW_ITEMS = "/api/v1/review-items/"


def supervisor_client(
    organization: Organization,
    make_member: MemberFactory,
    codes: tuple[str, ...] = (REVIEW_ITEM_READ,),
) -> APIClient:
    user, _ = make_member(organization, codes)
    client = APIClient()
    client.force_authenticate(user)
    return client


def items_in(organization: Organization, count: int, **fields: Any) -> list[ReviewItem]:  # noqa: ANN401
    return [
        ReviewItemFactory(field_event__organization=organization, **fields) for _ in range(count)
    ]


def test_a_rejection_from_a_phone_is_visible_to_a_supervisor(
    org_a: Organization, make_member: MemberFactory
) -> None:
    phone = make_phone(make_member, org_a)
    sent = event(type="unknown.type")
    phone.sync([sent])
    supervisor = supervisor_client(org_a, make_member)

    response = supervisor.get(REVIEW_ITEMS)

    assert response.status_code == 200
    (item,) = response.data["results"]
    assert item["event_id"] == sent["id"]
    assert (item["kind"], item["code"], item["event_type"]) == (
        "rejected",
        "unsupported_event_type",
        "unknown.type",
    )
    assert (item["courier"], item["device"]) == (phone.user.pk, phone.device_id)
    assert item["params"] == {"type": "unknown.type", "schema_version": 1}
    assert set(item) == {
        "id",
        "event_id",
        "event_type",
        "kind",
        "code",
        "params",
        "courier",
        "device",
        "created_at",
    }


def test_an_in_review_event_is_listed_too(org_a: Organization, make_member: MemberFactory) -> None:
    phone = make_phone(make_member, org_a)
    phone.sync([event(type="test.needs_review", payload={"text": "x"})])

    response = supervisor_client(org_a, make_member).get(REVIEW_ITEMS)

    assert [(i["kind"], i["code"]) for i in response.data["results"]] == [
        ("in_review", "test_review")
    ]


def test_items_of_another_organization_are_never_listed(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    mine = items_in(org_a, 2)
    items_in(org_b, 3)

    response = supervisor_client(org_a, make_member).get(REVIEW_ITEMS)

    assert {item["id"] for item in response.data["results"]} == {str(m.pk) for m in mine}


def test_a_courier_without_the_review_code_gets_403(
    org_a: Organization, make_member: MemberFactory
) -> None:
    items_in(org_a, 1)

    response = supervisor_client(org_a, make_member, codes=("field_event.sync",)).get(REVIEW_ITEMS)

    assert (response.status_code, response.data["code"]) == (403, "permission_denied")


def test_an_anonymous_request_gets_401() -> None:
    response = APIClient().get(REVIEW_ITEMS)

    assert response.status_code == 401


def test_the_list_is_read_only(org_a: Organization, make_member: MemberFactory) -> None:
    item = items_in(org_a, 1)[0]
    client = supervisor_client(org_a, make_member)

    assert client.post(REVIEW_ITEMS, {}, format="json").status_code == 405
    assert client.get(f"{REVIEW_ITEMS}{item.pk}/").status_code == 404
    assert client.patch(f"{REVIEW_ITEMS}{item.pk}/", {}, format="json").status_code == 404
    assert client.delete(f"{REVIEW_ITEMS}{item.pk}/").status_code == 404


def test_filters_by_kind_and_by_code(org_a: Organization, make_member: MemberFactory) -> None:
    rejected = items_in(org_a, 2, kind="rejected", code="invalid_payload")
    skewed = items_in(org_a, 1, kind="in_review", code="clock_skew")
    client = supervisor_client(org_a, make_member)

    by_kind = client.get(REVIEW_ITEMS, {"kind": "in_review"})
    by_code = client.get(REVIEW_ITEMS, {"code": "invalid_payload"})
    both = client.get(REVIEW_ITEMS, {"kind": "in_review", "code": "invalid_payload"})

    assert [i["id"] for i in by_kind.data["results"]] == [str(skewed[0].pk)]
    assert {i["id"] for i in by_code.data["results"]} == {str(r.pk) for r in rejected}
    assert both.data["results"] == []


def test_an_unknown_kind_is_a_validation_error(
    org_a: Organization, make_member: MemberFactory
) -> None:
    response = supervisor_client(org_a, make_member).get(REVIEW_ITEMS, {"kind": "bogus"})

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
    assert "kind" in response.data["fields"]


def test_the_list_pages_with_a_cursor_newest_first(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    created = items_in(org_a, 5)
    client = supervisor_client(org_a, make_member)
    monkeypatch.setattr(ReviewItemPagination, "page_size", 2)

    first = client.get(REVIEW_ITEMS)
    second = client.get(first.data["next"])
    third = client.get(second.data["next"])

    seen = [i["id"] for page in (first, second, third) for i in page.data["results"]]
    newest_first = sorted(created, key=lambda item: (item.created_at, item.pk), reverse=True)
    assert [len(p.data["results"]) for p in (first, second, third)] == [2, 2, 1]
    assert third.data["next"] is None
    assert seen == [str(item.pk) for item in newest_first]
    assert "count" not in first.data
