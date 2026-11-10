"""B-27: home summary, universal code search and unified record history."""

import base64
import json
from uuid import uuid4

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.throttling import SimpleRateThrottle

from geography.models import Block, Quadrant, SamplingPoint
from lab.shipments.models import ShipmentSource, ShipmentVoid, UiebShipment
from organizations.models import Center, all_scope
from shifts.models import Motorcycle, MotorcycleBlockEvent
from tests.factories import MotorcycleFactory, UserFactory
from tests.inventory_support import inventory_context

HOME = "/api/v1/home/summary/"
SEARCH = "/api/v1/search/"
BASE = ("home.read", "motorcycle.read", "quadrant.read")


def history_url(record_type, code):
    return f"/api/v1/records/{record_type}/{code}/history/"


def selected(centers=(), quadrants=()):
    def dimension(ids):
        return (
            {"mode": "selected", "ids": [str(item) for item in ids]}
            if ids
            else {"mode": "none", "ids": []}
        )

    return {"centers": dimension(centers), "quadrants": dimension(quadrants)}


def member_with(make_member, organization, codes, scope=None):
    user, membership = make_member(organization, codes)
    scope = all_scope() if scope is None else scope
    membership.scope = scope
    membership.save(update_fields=["scope"])
    for profile in membership.profiles.all():
        profile.scope = scope
        profile.save(update_fields=["scope"])
    return user


def make_center(organization, code):
    return Center.objects.create(organization=organization, code=code, name=code)


def make_point(organization, center, code):
    quadrant = Quadrant.objects.create(organization=organization, code=f"Q-{code}", center=center)
    block = Block.objects.create(organization=organization, code=f"B-{code}", quadrant=quadrant)
    point = SamplingPoint.objects.create(organization=organization, code=code, block=block)
    return quadrant, point


def void_motorcycle(motorcycle, user, reason="Registered twice by mistake"):
    motorcycle.voided_at = timezone.now()
    motorcycle.voided_by = user
    motorcycle.void_reason_code = "other"
    motorcycle.void_reason = reason
    motorcycle.save(update_fields=["voided_at", "voided_by", "void_reason_code", "void_reason"])


def groups_by_type(response):
    return {group["type"]: group for group in response.json()["groups"]}


@pytest.mark.django_db
def test_unknown_and_foreign_code_return_identical_empty_results(
    api_client, org_a, org_b, make_member
):
    user = member_with(make_member, org_a, BASE)
    MotorcycleFactory(organization=org_b, code="FOREIGN-1")
    api_client.force_authenticate(user)

    foreign = api_client.get(SEARCH, {"q": "FOREIGN-1"})
    unknown = api_client.get(SEARCH, {"q": "UNKNOWN-1"})

    assert foreign.status_code == unknown.status_code == 200
    assert {g["type"]: (g["count"], g["hits"]) for g in foreign.json()["groups"]} == {
        g["type"]: (g["count"], g["hits"]) for g in unknown.json()["groups"]
    }
    assert all(group["count"] == 0 for group in foreign.json()["groups"])
    assert api_client.get(history_url("motorcycle", "FOREIGN-1")).status_code == 404
    assert api_client.get(history_url("motorcycle", "UNKNOWN-1")).status_code == 404


@pytest.mark.django_db
def test_types_without_the_read_permission_are_absent_and_their_history_is_404(
    api_client, org_a, make_member
):
    user = member_with(make_member, org_a, ("home.read", "motorcycle.read"))
    MotorcycleFactory(organization=org_a, code="SEC-1")
    _quadrant, point = make_point(org_a, make_center(org_a, "C-SEC"), "SEC-P")
    api_client.force_authenticate(user)

    body = api_client.get(SEARCH, {"q": "SEC"}).json()

    assert [group["type"] for group in body["groups"]] == ["motorcycle"]
    assert api_client.get(history_url("sampling_point", point.code)).status_code == 404


@pytest.mark.django_db
def test_center_and_quadrant_scope_hide_records_from_counts_hits_and_history(
    api_client, org_a, make_member
):
    center, other_center = make_center(org_a, "C-1"), make_center(org_a, "C-2")
    quadrant, point = make_point(org_a, center, "PT-1")
    _other_quadrant, other_point = make_point(org_a, other_center, "PT-2")
    MotorcycleFactory(organization=org_a, code="MC-IN", center=center)
    MotorcycleFactory(organization=org_a, code="MC-OUT", center=other_center)
    user = member_with(
        make_member, org_a, BASE, selected(centers=[center.pk], quadrants=[quadrant.pk])
    )
    api_client.force_authenticate(user)

    groups = groups_by_type(api_client.get(SEARCH, {"q": "MC-"}))
    points = groups_by_type(api_client.get(SEARCH, {"q": "PT-"}))["sampling_point"]

    assert [hit["code"] for hit in groups["motorcycle"]["hits"]] == ["MC-IN"]
    assert groups["motorcycle"]["count"] == 1
    assert [hit["code"] for hit in points["hits"]] == [point.code]
    assert points["count"] == 1
    assert api_client.get(history_url("sampling_point", other_point.code)).status_code == 404


@pytest.mark.django_db
def test_voided_records_are_hidden_by_default_and_marked_when_included(
    api_client, org_a, make_member
):
    user = member_with(make_member, org_a, BASE)
    void_motorcycle(MotorcycleFactory(organization=org_a, code="V-OLD"), user)
    MotorcycleFactory(organization=org_a, code="V-NEW")
    api_client.force_authenticate(user)

    default = groups_by_type(api_client.get(SEARCH, {"q": "V-"}))["motorcycle"]
    included = groups_by_type(api_client.get(SEARCH, {"q": "V-", "include_voided": "true"}))
    hits = {hit["code"]: hit["is_voided"] for hit in included["motorcycle"]["hits"]}

    assert [hit["code"] for hit in default["hits"]] == ["V-NEW"]
    assert hits == {"V-NEW": False, "V-OLD": True}


@pytest.mark.django_db
def test_search_rejects_nul_blank_and_oversized_queries(api_client, org_a, make_member):
    api_client.force_authenticate(member_with(make_member, org_a, BASE))

    for value in ("a\x00b", "", "x" * 51):
        response = api_client.get(SEARCH, {"q": value})
        assert response.status_code == 400
        assert "q" in response.json()["fields"]


@pytest.mark.django_db
def test_history_orders_void_provenance_and_pages_with_a_stable_cursor(
    api_client, org_a, make_member
):
    user = member_with(make_member, org_a, BASE)
    motorcycle = MotorcycleFactory(organization=org_a, code="H-1")
    for action in ("block", "unblock", "block"):
        MotorcycleBlockEvent.objects.create(
            organization=org_a,
            created_by=user,
            motorcycle=motorcycle,
            action=action,
            blocked_reason="",
            reason=f"{action} reason with enough text",
        )
    void_motorcycle(motorcycle, user)
    api_client.force_authenticate(user)

    first = api_client.get(history_url("motorcycle", "H-1"), {"page_size": 2}).json()
    second = api_client.get(
        history_url("motorcycle", "H-1"), {"page_size": 2, "cursor": first["next_cursor"]}
    ).json()

    entries = [*first["results"], *second["results"]]
    assert first["record"]["code"] == "H-1"
    assert first["record"]["is_voided"] is True
    assert len(entries) == len({entry["source_id"] for entry in entries}) == 4
    assert second["next_cursor"] is None
    assert [entry["occurred_at"] for entry in entries] == sorted(
        (entry["occurred_at"] for entry in entries), reverse=True
    )
    void = next(entry for entry in entries if entry["kind"] == "record.void")
    assert void["reason"] == "Registered twice by mistake"
    assert void["author"] == {"username": user.username}


@pytest.mark.django_db
def test_history_rejects_a_malformed_cursor(api_client, org_a, make_member):
    api_client.force_authenticate(member_with(make_member, org_a, BASE))
    MotorcycleFactory(organization=org_a, code="H-2")

    response = api_client.get(history_url("motorcycle", "H-2"), {"cursor": "not-a-cursor"})

    assert response.status_code == 400
    assert response.json()["fields"]["cursor"][0]["code"] == "invalid_cursor"


@pytest.mark.django_db
def test_history_query_count_does_not_grow_with_the_number_of_entries(
    api_client, org_a, make_member
):
    user = member_with(make_member, org_a, BASE)
    motorcycle = MotorcycleFactory(organization=org_a, code="H-3")
    api_client.force_authenticate(user)

    def add_events(count):
        for _ in range(count):
            MotorcycleBlockEvent.objects.create(
                organization=org_a,
                created_by=UserFactory(),
                motorcycle=motorcycle,
                action="block",
                blocked_reason="",
                reason="a reason with enough text",
            )

    def queries():
        with CaptureQueriesContext(connection) as captured:
            assert api_client.get(history_url("motorcycle", "H-3")).status_code == 200
        return len(captured)

    add_events(1)
    few = queries()
    add_events(8)

    assert queries() == few


@pytest.mark.django_db
def test_search_query_count_is_bounded_by_the_number_of_types(api_client, org_a, make_member):
    api_client.force_authenticate(member_with(make_member, org_a, BASE))

    def queries():
        with CaptureQueriesContext(connection) as captured:
            assert api_client.get(SEARCH, {"q": "Q-"}).status_code == 200
        return len(captured)

    few = queries()
    center = make_center(org_a, "C-Q")
    for index in range(6):
        make_point(org_a, center, f"Q-{index}")
        MotorcycleFactory(organization=org_a, code=f"Q-M{index}", center=center)

    assert queries() == few


@pytest.mark.django_db
def test_home_without_work_grants_only_offers_business_support(api_client, org_a, make_member):
    org_a.support_contact = "support@example.test"
    org_a.save(update_fields=["support_contact"])
    api_client.force_authenticate(member_with(make_member, org_a, ("home.read",)))

    body = api_client.get(HOME).json()

    assert body["support"] == {"contact": "support@example.test"}
    assert body["cards"] == body["critical"] == body["attention"] == []
    assert body["link_filters"] == {}


@pytest.mark.django_db
def test_home_requires_home_read_and_never_accepts_an_organization_selector(
    api_client, org_a, org_b, make_member
):
    api_client.force_authenticate(member_with(make_member, org_a, ("motorcycle.read",)))
    assert api_client.get(HOME).status_code == 403

    api_client.force_authenticate(member_with(make_member, org_b, ("home.read",)))
    body = api_client.get(HOME, {"organization": str(org_a.pk)}).json()
    assert body["support"] is not None


@pytest.mark.django_db
def test_home_cards_match_the_linked_incident_list_filters(api_client, org_a, make_member):
    user = member_with(make_member, org_a, ("home.read", "incident.read"))
    api_client.force_authenticate(user)

    body = api_client.get(HOME).json()

    assert body["support"] is None
    assert {card["key"] for card in body["cards"]} == {
        "incidents_open",
        "incidents_critical",
        "incidents_overdue",
        "incidents_escalated",
    }
    for card in body["cards"]:
        listed = api_client.get("/api/v1/incidents/", card["filters"])
        assert listed.status_code == 200
        assert listed.json()["count"] == card["value"]


@pytest.mark.django_db
def test_shipment_history_links_revisions_and_void_only_when_visible(
    api_client, org_a, make_member
):
    context = inventory_context(org_a, make_member)
    codes = [*context.profile.permission_codes, "home.read", "shipment.read"]
    context.profile.permission_codes = codes
    context.profile.save(update_fields=["permission_codes"])
    base = timezone.now()

    def shipment(code, supersedes=None):
        created = UiebShipment.objects.create(
            organization=org_a,
            created_by=context.actor.user,
            code=code,
            cutoff=base,
            recipient_institution="Synthetic institution",
            source_snapshot=[{"kind": "lot", "id": str(context.lot.pk)}],
            content_hash=uuid4().hex,
            supersedes=supersedes,
            reason="Corrected source selection" if supersedes else "",
        )
        ShipmentSource.objects.create(
            organization=org_a,
            created_by=context.actor.user,
            shipment=created,
            lot=context.lot,
            center=context.center,
        )
        return created

    first = shipment("UIEB-1")
    second = shipment("UIEB-2", supersedes=first)
    ShipmentVoid.objects.create(
        organization=org_a,
        created_by=context.actor.user,
        shipment=second,
        reason="Superseded by a corrected shipment",
    )
    api_client.force_authenticate(context.actor.user)

    body = api_client.get(history_url("shipment", first.code)).json()
    revised = next(entry for entry in body["results"] if entry["kind"] == "export.revised")
    latest = api_client.get(history_url("shipment", second.code)).json()
    created = next(entry for entry in latest["results"] if entry["kind"] == "export.created")

    assert revised["refs"] == [{"type": "shipment", "code": "UIEB-2"}]
    assert created["refs"] == [{"type": "shipment", "code": "UIEB-1"}]
    assert any(entry["kind"] == "record.void" for entry in latest["results"])
    assert latest["record"]["is_voided"] is True
    assert body["record"]["is_voided"] is False
    hidden = member_with(make_member, org_a, ("home.read", "shipment.read"), selected())
    api_client.force_authenticate(hidden)
    assert api_client.get(history_url("shipment", first.code)).status_code == 404


@pytest.mark.django_db
def test_every_history_entry_stays_inside_the_requested_record_organization(
    api_client, org_a, org_b, make_member
):
    user = member_with(make_member, org_a, BASE)
    foreign = MotorcycleFactory(organization=org_b, code="SAME-1")
    own = MotorcycleFactory(organization=org_a, code="SAME-1")
    MotorcycleBlockEvent.objects.create(
        organization=org_b,
        created_by=UserFactory(),
        motorcycle=foreign,
        action="block",
        blocked_reason="",
        reason="foreign reason text",
    )
    api_client.force_authenticate(user)

    body = api_client.get(history_url("motorcycle", "SAME-1")).json()

    assert body["record"]["id"] == str(own.pk)
    assert body["results"] == []
    assert Motorcycle.objects.filter(code="SAME-1").count() == 2


@pytest.mark.django_db
def test_history_rejects_a_cursor_with_a_naive_datetime(api_client, org_a, make_member):
    api_client.force_authenticate(member_with(make_member, org_a, BASE))
    MotorcycleFactory(organization=org_a, code="H-4")
    raw = json.dumps(["2026-01-01T00:00:00", "motorcycle_block", str(uuid4())])
    cursor = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")

    response = api_client.get(history_url("motorcycle", "H-4"), {"cursor": cursor})

    assert response.status_code == 400
    assert response.json()["fields"]["cursor"][0]["code"] == "invalid_cursor"


@pytest.mark.django_db
def test_search_is_rate_limited_per_user_with_its_own_scope(
    api_client, org_a, make_member, monkeypatch
):
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "search", "2/min")
    api_client.force_authenticate(member_with(make_member, org_a, BASE))

    statuses = [api_client.get(SEARCH, {"q": "A"}).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]
    assert api_client.get(HOME).status_code == 200
