"""Every 4xx/5xx body is `{code, detail}` (+ `fields` on 400 validation errors only)."""

import logging

import pytest
from django.db import connection
from rest_framework.test import APIClient

from core.validation import flatten_error_details, params_message
from organizations.models import Organization
from tests.testapp.models import Widget

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
    response = client_a.get("/api/v1/undeclared-widgets/")

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
    client_a: APIClient, caplog: pytest.LogCaptureFixture
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


def test_django_request_body_limit_is_a_413_envelope(api_client: APIClient) -> None:
    response = api_client.post("/api/v1/too-big/")

    assert response.status_code == 413
    assert response.data["code"] == "payload_too_large"


def leaf(code: str, message: str = "x") -> dict[str, str]:
    return {"message": message, "code": code}


def test_flatten_error_details_handles_nested_and_non_field_errors() -> None:
    details = {"items": [{}, {"qty": [leaf("min_value")]}], "non_field_errors": [leaf("invalid")]}

    flat = flatten_error_details(details)

    assert flat == {
        "items.1.qty": [{"code": "min_value", "params": {}}],
        "non_field_errors": [{"code": "invalid", "params": {}}],
    }


def test_flatten_error_details_wraps_a_top_level_list_as_non_field_errors() -> None:
    assert flatten_error_details([leaf("invalid")]) == {
        "non_field_errors": [{"code": "invalid", "params": {}}]
    }


def test_flatten_error_details_keeps_the_params_a_message_carries() -> None:
    details = {"reason": [leaf("too_short", params_message({"min_length": 10}))]}

    assert flatten_error_details(details) == {
        "reason": [{"code": "too_short", "params": {"min_length": 10}}]
    }


def test_flatten_error_details_ignores_a_params_marker_that_is_not_json() -> None:
    """A message that merely starts with the marker must not turn an error into a 500."""
    details = {"reason": [leaf("too_short", "params:{not json")]}

    assert flatten_error_details(details) == {"reason": [{"code": "too_short", "params": {}}]}


def test_domain_error_rolls_back_writes_made_during_an_atomic_request(
    api_client: APIClient, org_a: Organization, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(connection.settings_dict, "ATOMIC_REQUESTS", True)

    response = api_client.post("/api/v1/write-then-fail/")

    assert response.status_code == 409
    assert response.data["code"] == "already_voided"
    assert not Widget.objects.filter(name="leaked").exists()
