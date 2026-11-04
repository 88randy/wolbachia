"""`?code=` lookup on list endpoints (docs/api-conventions.md, "Objects by code")."""

from typing import Any

import pytest
from rest_framework.test import APIClient

from core.filters import CODE_MAX_LENGTH
from organizations.models import Organization
from tests.factories import WidgetFactory

pytestmark = pytest.mark.django_db

WIDGETS = "/api/v1/widgets/"
STREAM_WIDGETS = "/api/v1/stream-widgets/"


def result_codes(response: Any) -> list[str]:
    return [item["code"] for item in response.data["results"]]


def test_code_returns_the_exact_match_only(client_a: APIClient, org_a: Organization) -> None:
    WidgetFactory(organization=org_a, code="OV-010")
    WidgetFactory(organization=org_a, code="OV-0100")
    WidgetFactory(organization=org_a, code="ov-010")

    response = client_a.get(WIDGETS, {"code": "OV-010"})

    assert response.status_code == 200
    assert result_codes(response) == ["OV-010"]


def test_code_without_match_returns_an_empty_page(client_a: APIClient) -> None:
    response = client_a.get(WIDGETS, {"code": "OV-999"})

    assert response.status_code == 200
    assert response.data["results"] == []


def test_code_never_crosses_organizations(
    client_a: APIClient, org_a: Organization, org_b: Organization
) -> None:
    WidgetFactory(organization=org_b, code="OV-010")

    response = client_a.get(WIDGETS, {"code": "OV-010"})

    assert response.data["results"] == []


def test_blank_code_is_a_validation_error(client_a: APIClient) -> None:
    response = client_a.get(WIDGETS, {"code": "  "})

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"] == {"code": [{"code": "blank", "params": {}}]}


def test_empty_code_is_a_validation_error(client_a: APIClient) -> None:
    response = client_a.get(f"{WIDGETS}?code=")

    assert response.status_code == 400
    assert response.data["fields"]["code"][0]["code"] == "blank"


def test_too_long_code_is_a_validation_error(client_a: APIClient) -> None:
    response = client_a.get(WIDGETS, {"code": "X" * (CODE_MAX_LENGTH + 1)})

    assert response.status_code == 400
    assert response.data["fields"] == {"code": [{"code": "max_length", "params": {}}]}


def test_code_at_the_maximum_length_is_accepted(client_a: APIClient) -> None:
    response = client_a.get(WIDGETS, {"code": "X" * CODE_MAX_LENGTH})

    assert response.status_code == 200


def test_repeated_code_uses_the_last_value(client_a: APIClient, org_a: Organization) -> None:
    WidgetFactory(organization=org_a, code="OV-001")
    WidgetFactory(organization=org_a, code="OV-002")

    response = client_a.get(f"{WIDGETS}?code=OV-001&code=OV-002")

    assert result_codes(response) == ["OV-002"]


def test_code_is_ignored_outside_the_list_action(client_a: APIClient, org_a: Organization) -> None:
    widget = WidgetFactory(organization=org_a, code="OV-010")

    response = client_a.get(f"{WIDGETS}{widget.pk}/", {"code": ""})

    assert response.status_code == 200


def test_code_works_with_cursor_pagination(client_a: APIClient, org_a: Organization) -> None:
    WidgetFactory(organization=org_a, code="OV-010")
    WidgetFactory(organization=org_a, code="OV-011")

    response = client_a.get(STREAM_WIDGETS, {"code": "OV-011"})

    assert result_codes(response) == ["OV-011"]


def test_views_without_code_lookup_field_ignore_the_parameter(client_a: APIClient) -> None:
    # No permissions declared: the request is denied before any filtering would happen.
    response = client_a.get("/api/v1/undeclared-widgets/", {"code": "OV-999"})

    assert response.status_code == 403
