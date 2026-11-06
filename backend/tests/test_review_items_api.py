"""`GET /review-items/`: what supervisors see of rejected and in-review events."""

from typing import Any

import pytest
from rest_framework.test import APIClient

from core.pagination import StandardPagination
from organizations.models import Organization
from reviews.models import ReviewItem
from reviews.permissions import REVIEW_ITEM_READ
from tests.conftest import MemberFactory
from tests.factories import ReviewItemFactory
from tests.fleet_support import grant_fleet_scope
from tests.sync_support import event, make_phone

pytestmark = pytest.mark.django_db

REVIEW_ITEMS = "/api/v1/review-items/"


def supervisor_client(
    organization: Organization,
    make_member: MemberFactory,
    codes: tuple[str, ...] = (REVIEW_ITEM_READ,),
) -> APIClient:
    user, _ = grant_fleet_scope(make_member(organization, codes))
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


def test_queue_creation_and_mutation_remain_unavailable_but_detail_is_readable(
    org_a: Organization, make_member: MemberFactory
) -> None:
    item = items_in(org_a, 1)[0]
    client = supervisor_client(org_a, make_member)

    assert client.post(REVIEW_ITEMS, {}, format="json").status_code == 405
    assert client.get(f"{REVIEW_ITEMS}{item.pk}/").status_code == 200
    assert client.patch(f"{REVIEW_ITEMS}{item.pk}/", {}, format="json").status_code == 405
    assert client.delete(f"{REVIEW_ITEMS}{item.pk}/").status_code == 405


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


def test_the_admin_queue_uses_page_numbers_and_count_newest_first(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    created = items_in(org_a, 5)
    client = supervisor_client(org_a, make_member)
    monkeypatch.setattr(StandardPagination, "page_size", 2)

    first = client.get(REVIEW_ITEMS)
    second = client.get(first.data["next"])
    third = client.get(second.data["next"])

    seen = [i["id"] for page in (first, second, third) for i in page.data["results"]]
    newest_first = sorted(created, key=lambda item: (item.created_at, item.pk), reverse=True)
    assert [len(p.data["results"]) for p in (first, second, third)] == [2, 2, 1]
    assert third.data["next"] is None
    assert seen == [str(item.pk) for item in newest_first]
    assert first.data["count"] == 5
    assert "page=2" in first.data["next"]


@pytest.mark.parametrize(
    ("case", "status"),
    [
        ("missing_permission", 403),
        ("foreign_org", 404),
        ("foreign_center", 404),
        ("foreign_quadrant", 404),
        ("unrelated_all", 404),
        ("paired", 409),
    ],
)
def test_review_action_checks_current_permission_and_both_paired_dimensions(
    make_member, org_b, case, status
):
    from geography.models import Quadrant
    from organizations.models import Center, all_scope
    from tests.factories import ProfileFactory
    from tests.ovitrap_support import envelope, ingest, setup_field

    field = setup_field()
    sent = envelope(field, gps=None)
    assert ingest(field, sent).status == "in_review"
    item = ReviewItem.objects.get(field_event_id=sent.id)
    organization = org_b if case == "foreign_org" else field.batch.organization
    codes = (
        ("review_item.read",)
        if case == "missing_permission"
        else ("review_item.read", "review_item.decide")
    )
    actor, member = grant_fleet_scope(make_member(organization, codes))
    if case != "foreign_org":
        center_id, quadrant_id = field.point.center_id, field.point.quadrant_id
        if case in {"foreign_center", "unrelated_all"}:
            center_id = Center.objects.create(
                organization=organization, code="B17-DENY", name="Other center"
            ).pk
        if case == "foreign_quadrant":
            quadrant_id = Quadrant.objects.create(
                organization=organization, center_id=center_id, code="B17-DENY-Q"
            ).pk
        profile = member.profiles.get()
        profile.scope = {
            "centers": {"mode": "selected", "ids": [str(center_id)]},
            "quadrants": {"mode": "selected", "ids": [str(quadrant_id)]},
        }
        profile.save(update_fields=["scope"])
        if case == "unrelated_all":
            member.profiles.add(
                ProfileFactory(
                    organization=organization, permission_codes=["field.upload"], scope=all_scope()
                )
            )
    client = APIClient()
    client.force_authenticate(actor)
    response = client.post(
        f"{REVIEW_ITEMS}{item.pk}/accept/",
        {"reason": "Current paired scope must be checked", "expected_revision": 0},
        format="json",
    )
    assert response.status_code == status, response.data
    assert not item.decisions.exists()


@pytest.mark.parametrize("scope_case", ["all", "selected", "none", "split_all"])
def test_unresolved_source_audit_requires_one_explicit_all_all_grant_and_remains_pending(
    org_a, make_member, scope_case
):
    from field_sync.models import FieldEvent
    from organizations.models import Center, default_scope
    from reviews.models import ReviewEffectReceipt
    from tests.factories import ProfileFactory

    phone = make_phone(make_member, org_a)
    sent = event(
        type="release.unimplemented", payload={"foreign_reference": "untrusted original text"}
    )
    assert phone.sync([sent]).data["results"][0]["status"] == "rejected"
    item = ReviewItem.objects.get(field_event_id=sent["id"])
    actor, member = grant_fleet_scope(
        make_member(org_a, ("review_item.read", "review_item.decide"))
    )
    center = Center.objects.create(organization=org_a, code="B17-AUDIT", name="Audit scope")
    profile = member.profiles.get()
    if scope_case == "none":
        profile.scope = default_scope()
    elif scope_case in {"selected", "split_all"}:
        profile.scope = {
            "centers": {"mode": "selected", "ids": [str(center.pk)]},
            "quadrants": {"mode": "all", "ids": []},
        }
    profile.save(update_fields=["scope"])
    if scope_case == "split_all":
        member.profiles.add(
            ProfileFactory(
                organization=org_a,
                permission_codes=["review_item.read", "review_item.decide"],
                scope={
                    "centers": {"mode": "all", "ids": []},
                    "quadrants": {"mode": "none", "ids": []},
                },
            )
        )
    client = APIClient()
    client.force_authenticate(actor)
    detail = client.get(f"{REVIEW_ITEMS}{item.pk}/")
    body = {"reason": "Retain this unsupported source as an audit", "expected_revision": 0}
    accepted = client.post(f"{REVIEW_ITEMS}{item.pk}/accept/", body, format="json")
    discarded = client.post(f"{REVIEW_ITEMS}{item.pk}/void/", body, format="json")
    if scope_case != "all":
        assert detail.status_code == 404
        assert accepted.status_code == 404
        assert discarded.status_code == 404
        assert not item.decisions.exists()
        return
    assert detail.status_code == 200
    assert accepted.status_code == 409
    assert discarded.status_code == 201, discarded.data
    assert discarded.data["is_terminal"] is False
    assert discarded.data["audit_only"] is True
    assert discarded.data["decision_state"] == "pending"
    state = client.get(f"{REVIEW_ITEMS}{item.pk}/").data["decision_state"]
    assert state["kind"] == "pending"
    assert state["terminal"] is False
    assert FieldEvent.objects.get(pk=item.field_event_id).status == "rejected"
    assert not ReviewEffectReceipt.objects.filter(source_event_id=item.field_event_id).exists()


def test_review_action_keeps_cookie_csrf_pinned_bearer_and_server_terminal_state(
    org_a, org_b, make_member
):
    phone = make_phone(make_member, org_a)
    sent = event(type="release.unimplemented")
    assert phone.sync([sent]).data["results"][0]["status"] == "rejected"
    item = ReviewItem.objects.get(field_event_id=sent["id"])

    def scoped_member(*args, **kwargs):
        return grant_fleet_scope(make_member(*args, **kwargs))

    actor = make_phone(scoped_member, org_a, codes=("review_item.read", "review_item.decide"))
    from organizations.models import Membership

    profile = Membership.objects.get(organization=org_a, user=actor.user).profiles.get()
    profile.permission_codes.append("shift.validate")
    profile.save(update_fields=["permission_codes"])
    for path in (
        "/api/v1/review-items/not-a-uuid/accept/",
        "/api/v1/shifts/not-a-uuid/approve/",
    ):
        malformed = actor.client.post(
            path,
            {
                "expected_revision": 0,
                "reason": "Malformed path must stay a bounded missing resource",
            },
            format="json",
        )
        assert malformed.status_code == 404, malformed.data
    scoped_member(org_b, ("review_item.read", "review_item.decide"), user=actor.user)
    url = f"{REVIEW_ITEMS}{item.pk}/void/"
    body = {"expected_revision": 0, "reason": "Retain unsupported original capture as audit only"}
    cookie = APIClient(enforce_csrf_checks=True)
    cookie.force_login(actor.user)
    denied = cookie.post(url, body, format="json", headers={"X-Organization": org_a.slug})
    assert denied.status_code == 403
    assert not item.decisions.exists()
    assert cookie.get("/api/v1/auth/csrf/").status_code == 204
    headers = {"X-Organization": org_a.slug, "X-CSRFToken": cookie.cookies["csrftoken"].value}
    injected = cookie.post(url, body | {"is_terminal": True}, format="json", headers=headers)
    assert injected.status_code == 400
    assert not item.decisions.exists()
    actual = cookie.post(url, body, format="json", headers=headers)
    assert actual.status_code == 201, actual.data
    assert actual.data["decision_state"] == "pending"
    assert actual.data["is_terminal"] is False
    switched = actor.client.post(
        url, body | {"expected_revision": 1}, format="json", headers={"X-Organization": org_b.slug}
    )
    assert switched.status_code == 403
    assert item.decisions.count() == 1
    pinned = actor.client.post(url, body | {"expected_revision": 1}, format="json")
    assert pinned.status_code == 201, pinned.data
    assert pinned.data["audit_only"] is True
    assert item.decisions.count() == 2
