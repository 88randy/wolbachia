"""The OpenAPI schema is the contract packages/api-client is generated from (issue #12)."""

from typing import Any

import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIClient

from core.filters import CODE_MAX_LENGTH
from core.schema import HTTP_METHODS, add_error_envelope

pytestmark = pytest.mark.django_db


@pytest.fixture
def schema(client_a: APIClient) -> dict[str, Any]:
    response = client_a.get("/api/v1/schema/", {"format": "json"})
    assert response.status_code == 200
    return response.json()  # type: ignore[no-any-return]


def operations(schema: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    return [
        (path, method, item[method])
        for path, item in schema["paths"].items()
        for method in HTTP_METHODS
        if method in item
    ]


def query_parameters(operation: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {p["name"]: p for p in operation.get("parameters", []) if p["in"] == "query"}


def test_error_envelope_component_matches_the_documented_shape(schema: dict[str, Any]) -> None:
    envelope = schema["components"]["schemas"]["ErrorEnvelope"]

    assert set(envelope["properties"]) == {"code", "detail", "fields", "blocked_by"}
    assert sorted(envelope["required"]) == ["code", "detail"]
    fields = envelope["properties"]["fields"]["additionalProperties"]
    assert fields["items"] == {"$ref": "#/components/schemas/FieldError"}
    assert sorted(schema["components"]["schemas"]["FieldError"]["required"]) == ["code", "params"]
    blocked = schema["components"]["schemas"]["BlockedBy"]
    assert sorted(blocked["required"]) == ["link", "reason", "unblocked_by_role"]


def test_every_operation_documents_the_default_error_response(schema: dict[str, Any]) -> None:
    all_operations = operations(schema)

    # Compared with the URL conf, so a view that drops out of the schema fails here.
    assert {path for path, _, _ in all_operations} >= {
        "/api/v1/health/",
        "/api/v1/me/",
        "/api/v1/widgets/",
        "/api/v1/widgets/{id}/void/",
    }
    for path, method, operation in all_operations:
        default = operation["responses"]["default"]
        ref = default["content"]["application/json"]["schema"]["$ref"]
        assert ref == "#/components/schemas/ErrorEnvelope", f"{method} {path}"


def test_page_number_lists_expose_count_and_page_links(schema: dict[str, Any]) -> None:
    page = schema["components"]["schemas"]["PaginatedWidgetList"]

    assert set(page["properties"]) == {"count", "next", "previous", "results"}
    assert sorted(page["required"]) == ["count", "results"]
    assert schema["paths"]["/api/v1/widgets/"]["get"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"] == {"$ref": "#/components/schemas/PaginatedWidgetList"}
    assert set(query_parameters(schema["paths"]["/api/v1/widgets/"]["get"])) >= {
        "page",
        "page_size",
    }


def test_cursor_lists_expose_next_and_previous_without_count(schema: dict[str, Any]) -> None:
    page = schema["components"]["schemas"]["PaginatedStreamWidgetList"]
    operation = schema["paths"]["/api/v1/stream-widgets/"]["get"]

    assert set(page["properties"]) == {"next", "previous", "results"}
    assert "cursor" in query_parameters(operation)
    assert "page" not in query_parameters(operation)


def test_code_parameter_is_documented_on_opted_in_lists_only(schema: dict[str, Any]) -> None:
    paths = schema["paths"]

    code = query_parameters(paths["/api/v1/widgets/"]["get"])["code"]
    assert code["required"] is False
    assert code["schema"]["maxLength"] == CODE_MAX_LENGTH
    assert "code" in query_parameters(paths["/api/v1/stream-widgets/"]["get"])
    assert "code" not in query_parameters(paths["/api/v1/undeclared-widgets/"]["get"])
    assert "code" not in query_parameters(paths["/api/v1/widgets/{id}/"]["get"])


def test_organization_header_is_documented_on_scoped_operations(schema: dict[str, Any]) -> None:
    operation = schema["paths"]["/api/v1/widgets/"]["get"]

    headers = [p["name"] for p in operation["parameters"] if p["in"] == "header"]
    assert headers == ["X-Organization"]
    assert not schema["paths"]["/api/v1/health/"]["get"].get("security")


def test_session_cookie_is_the_declared_security_scheme(schema: dict[str, Any]) -> None:
    assert schema["components"]["securitySchemes"]["cookieAuth"]["in"] == "cookie"


def test_an_operation_keeps_its_own_default_response() -> None:
    own = {"description": "custom"}
    result = {"paths": {"/x/": {"get": {"responses": {"default": own}}, "post": {}}}}

    add_error_envelope(result)

    assert result["paths"]["/x/"]["get"]["responses"]["default"] is own
    assert result["paths"]["/x/"]["post"]["responses"]["default"]["content"]


def test_default_responses_are_independent_copies() -> None:
    result = {"paths": {"/x/": {"get": {}, "post": {}}}}

    add_error_envelope(result)

    operations_ = result["paths"]["/x/"]
    assert (
        operations_["get"]["responses"]["default"]
        is not operations_["post"]["responses"]["default"]
    )


def test_the_hook_refuses_to_overwrite_existing_error_components() -> None:
    result = {"paths": {}, "components": {"schemas": {"FieldError": {}}}}

    with pytest.raises(ImproperlyConfigured, match="FieldError"):
        add_error_envelope(result)


def test_void_contract_requires_code_and_exposes_stored_code_read_only(schema):
    components = schema["components"]["schemas"]
    action = schema["paths"]["/api/v1/widgets/{id}/void/"]["post"]
    reference = action["requestBody"]["content"]["application/json"]["schema"]["$ref"]
    body = components[reference.rsplit("/", 1)[-1]]

    assert body["required"] == ["reason_code"]
    assert body["properties"]["reason_code"]["maxLength"] == 64
    assert body["properties"]["reason"]["maxLength"] == 1000
    for component in ("Widget", "RuleParameterVersion"):
        assert components[component]["properties"]["void_reason_code"]["readOnly"] is True
