"""`?code=` lookup on list endpoints (docs/api-conventions.md, "Objects by code")."""

from types import SimpleNamespace
from typing import Any

import pytest
from rest_framework.request import Request
from rest_framework.settings import api_settings
from rest_framework.test import APIClient, APIRequestFactory

from core.filters import CODE_MAX_LENGTH, CodeLookupFilter
from organizations.models import Organization
from tests.factories import WidgetFactory
from tests.testapp.models import Widget

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


def test_nul_character_is_a_validation_error_not_a_server_error(client_a: APIClient) -> None:
    response = client_a.get(f"{WIDGETS}?code=OV%00010")

    assert response.status_code == 400
    assert response.data["fields"] == {
        "code": [{"code": "null_characters_not_allowed", "params": {}}]
    }


def test_surrounding_whitespace_is_trimmed(client_a: APIClient, org_a: Organization) -> None:
    WidgetFactory(organization=org_a, code="OV-010")

    response = client_a.get(WIDGETS, {"code": "  OV-010 "})

    assert result_codes(response) == ["OV-010"]


@pytest.mark.parametrize(
    "view", [SimpleNamespace(action="list"), SimpleNamespace(action="list", code_lookup_field=None)]
)
def test_filter_leaves_views_without_code_lookup_field_untouched(view: SimpleNamespace) -> None:
    queryset = Widget.objects.all()
    request = Request(APIRequestFactory().get("/", {"code": ""}))

    result = CodeLookupFilter().filter_queryset(request, queryset, view)  # type: ignore[arg-type]

    assert result is queryset


def test_schema_parameter_is_omitted_without_code_lookup_field() -> None:
    assert CodeLookupFilter().get_schema_operation_parameters(SimpleNamespace()) == []  # type: ignore[arg-type]


def test_filter_is_registered_for_every_viewset_by_default() -> None:
    assert [CodeLookupFilter] == api_settings.DEFAULT_FILTER_BACKENDS
