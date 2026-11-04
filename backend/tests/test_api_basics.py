"""Health, schema, throttling and pagination wiring."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from organizations.models import Organization
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


def make_widgets(organization: Organization, count: int) -> list[Widget]:
    now = timezone.now()
    widgets = [
        Widget(
            organization=organization, name=f"w{index}", created_at=now + timedelta(seconds=index)
        )
        for index in range(count)
    ]
    created = Widget.objects.bulk_create(widgets)
    # auto_now_add overrides created_at on insert; set the distinct values explicitly.
    for widget, original in zip(created, widgets, strict=True):
        Widget.objects.filter(pk=widget.pk).update(created_at=original.created_at)
    return created


def test_named_routes_resolve_under_the_api_prefix() -> None:
    assert reverse("health") == "/api/v1/health/"
    assert reverse("me") == "/api/v1/me/"
    assert reverse("schema") == "/api/v1/schema/"


def test_health_answers_ok_without_authentication(api_client: APIClient) -> None:
    response = api_client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {"status": "ok"}


def test_health_is_not_throttled(api_client: APIClient) -> None:
    responses = [api_client.get("/api/v1/health/").status_code for _ in range(70)]

    assert set(responses) == {200}


def test_schema_requires_authentication_outside_dev(api_client: APIClient) -> None:
    assert api_client.get("/api/v1/schema/").status_code == 401


def test_schema_is_served_to_authenticated_users(client_a: APIClient) -> None:
    response = client_a.get("/api/v1/schema/")

    assert response.status_code == 200
    assert b"openapi" in response.content


def test_schema_documents_the_organization_header(client_a: APIClient) -> None:
    response = client_a.get("/api/v1/schema/", {"format": "json"})

    me_parameters = response.json()["paths"]["/api/v1/me/"]["get"]["parameters"]
    assert any(p["name"] == "X-Organization" and p["in"] == "header" for p in me_parameters)


def test_anonymous_requests_are_throttled(api_client: APIClient) -> None:
    # Rates are read at import time, so this uses the dedicated one-per-minute view.
    api_client.get("/api/v1/throttled/")

    assert api_client.get("/api/v1/throttled/").status_code == 429


def test_rotating_x_forwarded_for_does_not_evade_the_throttle(api_client: APIClient) -> None:
    api_client.get("/api/v1/throttled/", headers={"X-Forwarded-For": "203.0.113.1"})

    response = api_client.get("/api/v1/throttled/", headers={"X-Forwarded-For": "203.0.113.2"})

    assert response.status_code == 429


def test_page_number_pagination_defaults_to_50_results(
    client_a: APIClient, org_a: Organization
) -> None:
    make_widgets(org_a, 51)

    response = client_a.get("/api/v1/widgets/")

    assert set(response.data) == {"count", "next", "previous", "results"}
    assert response.data["count"] == 51
    assert len(response.data["results"]) == 50


def test_page_number_pagination_caps_page_size_at_200(
    client_a: APIClient, org_a: Organization
) -> None:
    make_widgets(org_a, 201)

    response = client_a.get("/api/v1/widgets/", {"page_size": 1000})

    assert len(response.data["results"]) == 200


def test_cursor_pagination_orders_newest_first_and_has_no_count(
    client_a: APIClient, org_a: Organization
) -> None:
    first, second = make_widgets(org_a, 2)

    response = client_a.get("/api/v1/stream-widgets/")

    assert set(response.data) == {"next", "previous", "results"}
    assert [w["id"] for w in response.data["results"]] == [str(second.pk), str(first.pk)]
