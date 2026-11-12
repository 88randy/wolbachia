"""Query counts of the slow web lists must not grow with the number of rows (perf audit C1-C4)."""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from lab.models import LabNumericDisclosure
from notifications.services import NotificationDraft, publish_notification
from organizations.selectors import resolve_active_membership
from organizations.services import effective_scope
from tests.lab_support import (
    capture_bag,
    command,
    lab_context,
    receive,
    synthetic_method,
)

pytestmark = pytest.mark.django_db


def count_queries(client: APIClient, url: str) -> tuple[list[str], dict]:
    with CaptureQueriesContext(connection) as captured:
        response = client.get(url)
    assert response.status_code == 200, response.content
    return [query["sql"] for query in captured.captured_queries], response.json()


def grow(context, method, start, stop):
    """Add counted bags (each on its own ovitrap and sampling point)."""
    for index in range(start, stop):
        bag = capture_bag(context, f"PERF-{index:03d}", new_source=True, has_eggs=True)
        receive(context, bag)
        result = command(
            context,
            "count",
            bag_target(bag),
            {
                "expected_revision": 0,
                "value": index,
                "confirmed_implausible": False,
                "viable_eggs": 0,
                "total_examined": 0,
                "method_version": method.pk,
            },
        )
        assert result.status == 201, result.body


def bag_target(bag):
    from lab.access import LabTarget

    return LabTarget("bag", bag.pk)


@pytest.fixture
def lab_web(monkeypatch):
    context = lab_context(monkeypatch)
    method = synthetic_method(context)
    client = APIClient()
    client.force_authenticate(context.actor.user)
    return context, method, client


@pytest.mark.parametrize(
    "url",
    [
        "/api/v1/bags/?page_size=100",
        "/api/v1/egg-counts/?page_size=100",
        "/api/v1/readings/?page_size=100",
        "/api/v1/ovitraps/?page_size=100",
    ],
)
def test_lab_and_ovitrap_lists_use_constant_queries(lab_web, url):
    context, method, client = lab_web
    grow(context, method, 0, 2)
    few_sql, few = count_queries(client, url)
    grow(context, method, 2, 5)
    many_sql, many = count_queries(client, url)

    assert len(many["results"]) > len(few["results"]) >= 2
    assert len(many_sql) == len(few_sql), "query count grew with the number of rows"


def test_bag_list_takes_one_organization_lock_and_publishes_each_count_once(lab_web):
    context, method, client = lab_web
    grow(context, method, 0, 5)
    sql, body = count_queries(client, "/api/v1/bags/?page_size=100")

    # One lock per request: the batch publication re-enters the read transaction of the view.
    organization_locks = [
        q for q in sql if "FOR NO KEY UPDATE" in q and "organizations_organization" in q
    ]
    assert len(organization_locks) == 1, organization_locks
    counted = [row for row in body["results"] if row["lab"] and row["lab"]["count_id"]]
    assert len(counted) == 5
    assert LabNumericDisclosure.objects.filter(created_by=context.actor.user).count() == 5


def test_blind_qa_bags_stay_hidden_and_unpublished(lab_web, make_member):
    """A count the actor may not read yet never reaches the page nor the disclosure log."""
    from lab.permissions import BAG_RECEIVE, COUNT_READ, RECOUNT_CREATE
    from tests.lab_support import actor_with_codes

    context, method, _client = lab_web
    grow(context, method, 0, 3)
    blind = actor_with_codes(
        context, make_member, [BAG_RECEIVE, COUNT_READ, RECOUNT_CREATE, "reading.read"]
    )
    client = APIClient()
    client.force_authenticate(blind.user)

    bags = client.get("/api/v1/bags/?page_size=100").json()["results"]
    counts = client.get("/api/v1/egg-counts/?page_size=100").json()["results"]

    assert counts == []
    assert all(row["lab"] is None or row["lab"]["count_id"] is None for row in bags)
    assert not LabNumericDisclosure.objects.filter(created_by=blind.user).exists()


def test_notification_list_has_no_row_lock_and_constant_queries(lab_web):
    context, _method, client = lab_web
    member = context.member
    from organizations.models import all_scope

    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.permission_codes = [*profile.permission_codes, "notification.read"]
    profile.scope = all_scope()
    profile.save(update_fields=["permission_codes", "scope"])
    for _ in range(2):
        publish_notification(NotificationDraft(recipient=member))
    first_page, few = count_queries(client, "/api/v1/notifications/")
    for _ in range(6):
        publish_notification(NotificationDraft(recipient=member))
    sql, many = count_queries(client, "/api/v1/notifications/")

    assert len(many["results"]) > len(few["results"])
    assert len(sql) == len(first_page)
    assert not [q for q in sql if "FOR UPDATE" in q or "FOR NO KEY UPDATE" in q]
    next_url = client.get("/api/v1/notifications/?page_size=1").json()["next"]
    cursor_sql, _body = count_queries(client, next_url)
    assert not [q for q in cursor_sql if "FOR " in q and "SHARE" in q or "UPDATE" in q]


def test_effective_scope_is_computed_once_per_request_membership(org_a, make_member):
    user, _member = make_member(org_a)
    membership = resolve_active_membership(user, None)

    with CaptureQueriesContext(connection) as first:
        effective_scope(membership)
    with CaptureQueriesContext(connection) as repeated:
        for _ in range(5):
            effective_scope(membership)

    assert len(first) > 0
    assert len(repeated) == 0


def test_effective_scope_of_a_membership_loaded_by_a_service_is_never_cached(org_a, make_member):
    user, member = make_member(org_a)
    fresh = type(member).objects.select_related("user", "organization").get(pk=member.pk)

    with CaptureQueriesContext(connection) as repeated:
        effective_scope(fresh)
        effective_scope(fresh)

    assert len(repeated) >= 2


def test_me_and_centers_use_few_queries(org_a, make_member):
    user, _member = make_member(org_a, ["center.read"])
    client = APIClient()
    client.force_authenticate(user)

    me, _body = count_queries(client, "/api/v1/me/")
    centers, _body = count_queries(client, "/api/v1/centers/")

    assert len(me) <= 5
    assert len(centers) <= 4
