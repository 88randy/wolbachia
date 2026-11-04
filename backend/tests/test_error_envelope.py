"""Every 4xx/5xx body is `{code, detail}` (+ `fields` on 400 validation errors only)."""

import logging

import pytest
from rest_framework.test import APIClient

from core.exception_handler import _flatten_codes
from organizations.models import Organization

pytestmark = pytest.mark.django_db

WIDGETS = "/api/v1/widgets/"


def test_validation_error_lists_field_codes_under_fields(client_a: APIClient) -> None:
    response = client_a.post(WIDGETS, {}, format="json")

    assert response.status_code == 400
    assert response.data == {
        "code": "validation_error",
        "detail": "Validation failed.",
        "fields": {"name": [{"code": "required", "params": {}}]},
    }


def test_unauthenticated_error_has_code_and_detail_only(api_client: APIClient) -> None:
    response = api_client.get("/api/v1/me/")

    assert response.status_code == 401
    assert set(response.data) == {"code", "detail"}
    assert response.data["code"] == "not_authenticated"


def test_permission_error_uses_permission_denied_code(
    client_a: APIClient,
) -> None:
    response = client_a.get("/api/v1/restricted-widgets/")

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_not_found_error_uses_not_found_code(client_a: APIClient) -> None:
    response = client_a.get(f"{WIDGETS}00000000-0000-0000-0000-000000000000/")

    assert response.status_code == 404
    assert response.data["code"] == "not_found"


def test_method_not_allowed_error_uses_its_code(client_a: APIClient) -> None:
    response = client_a.delete(WIDGETS)

    assert response.status_code == 405
    assert response.data["code"] == "method_not_allowed"


def test_throttled_error_uses_throttled_code_and_keeps_retry_after(
    api_client: APIClient,
) -> None:
    api_client.get("/api/v1/throttled/")

    response = api_client.get("/api/v1/throttled/")

    assert response.status_code == 429
    assert response.data["code"] == "throttled"
    assert "Retry-After" in response


def test_unhandled_error_returns_500_envelope_and_logs_context(
    client_a: APIClient, caplog: pytest.LogCaptureFixture, org_a: Organization
) -> None:
    with caplog.at_level(logging.ERROR, logger="core.exception_handler"):
        response = client_a.get("/api/v1/boom/")

    assert response.status_code == 500
    assert response.data == {"code": "server_error", "detail": "Internal server error."}
    assert "path=/api/v1/boom/" in caplog.text
    assert "RuntimeError" in caplog.text


def test_malformed_json_body_returns_parse_error(client_a: APIClient) -> None:
    response = client_a.post(WIDGETS, "{not json", content_type="application/json")

    assert response.status_code == 400
    assert response.data["code"] == "parse_error"
    assert "fields" not in response.data


def test_flatten_codes_handles_nested_and_non_field_errors() -> None:
    codes = {"items": [{}, {"qty": ["min_value"]}], "non_field_errors": ["invalid"]}

    flat = _flatten_codes(codes)

    assert flat == {
        "items.1.qty": [{"code": "min_value", "params": {}}],
        "non_field_errors": [{"code": "invalid", "params": {}}],
    }


def test_flatten_codes_wraps_a_top_level_list_as_non_field_errors() -> None:
    assert _flatten_codes(["invalid"]) == {"non_field_errors": [{"code": "invalid", "params": {}}]}
