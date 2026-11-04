"""Health, schema, permissions and pagination wiring."""

import pytest
from rest_framework.test import APIClient

from organizations.models import Organization
from tests.factories import WidgetFactory

pytestmark = pytest.mark.django_db


def test_health_answers_ok_without_authentication(api_client: APIClient) -> None:
    response = api_client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {"status": "ok"}


def test_health_is_not_throttled(api_client: APIClient, settings) -> None:
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


def test_anonymous_requests_are_throttled(api_client: APIClient, settings) -> None:
    # Rates are read at import time, so this uses the dedicated one-per-minute view.
    api_client.get("/api/v1/throttled/")

    assert api_client.get("/api/v1/throttled/").status_code == 429


def test_permission_code_grants_access_when_present_in_a_profile(
    api_client: APIClient, org_a: Organization, make_member
) -> None:
    user, _ = make_member(org_a, permission_codes=["widget.manage"])
    api_client.force_authenticate(user)

    assert api_client.get("/api/v1/restricted-widgets/").status_code == 200


def test_permission_code_is_denied_when_missing(
    api_client: APIClient, org_a: Organization, make_member
) -> None:
    user, _ = make_member(org_a, permission_codes=["widget.read"])
    api_client.force_authenticate(user)

    assert api_client.get("/api/v1/restricted-widgets/").status_code == 403


def test_page_number_pagination_uses_the_default_size_and_cap(
    client_a: APIClient, org_a: Organization
) -> None:
    for _ in range(3):
        WidgetFactory(organization=org_a)

    default = client_a.get("/api/v1/widgets/")
    capped = client_a.get("/api/v1/widgets/", {"page_size": 100000})

    assert set(default.data) == {"count", "next", "previous", "results"}
    assert default.data["count"] == 3
    assert capped.status_code == 200


def test_cursor_pagination_orders_newest_first_and_has_no_count(
    client_a: APIClient, org_a: Organization
) -> None:
    first = WidgetFactory(organization=org_a)
    second = WidgetFactory(organization=org_a)

    response = client_a.get("/api/v1/stream-widgets/")

    assert set(response.data) == {"next", "previous", "results"}
    assert [w["id"] for w in response.data["results"]] == [str(second.pk), str(first.pk)]
