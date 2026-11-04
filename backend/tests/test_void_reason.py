"""Void reasons (#32): one validator for every void path, code + params, never user text."""

from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from core.exceptions import FieldValidationError
from core.services import void_record
from core.void_reason import VOID_REASON_MAX_LENGTH, validate_void_reason, void_reason_min_length
from field_sync.models import FieldEvent
from organizations.models import Organization
from rules import permissions as rule_codes
from tests.conftest import MemberFactory
from tests.factories import RuleParameterFactory, RuleParameterVersionFactory, WidgetFactory
from tests.sync_support import Phone, event, make_phone
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db

WIDGETS = "/api/v1/widgets/"
ME_URL = "/api/v1/me/"
TOO_SHORT = {"code": "void_reason_too_short", "params": {"min_length": 10}}
NINE = "a" * 9
TEN = "a" * 10


# --- the validator ------------------------------------------------------------------------


def test_the_default_minimum_is_ten_characters() -> None:
    assert void_reason_min_length() == 10


def test_the_validator_trims_and_returns_the_clean_text() -> None:
    assert validate_void_reason(f"  {TEN}  \n") == TEN


@pytest.mark.parametrize("reason", ["", "   ", NINE, f"  {NINE}  ", "\t\n"])
def test_the_validator_refuses_what_is_too_short_after_trimming(reason: str) -> None:
    with pytest.raises(FieldValidationError) as raised:
        validate_void_reason(reason)

    assert raised.value.fields == {"reason": [TOO_SHORT]}


def test_the_minimum_comes_from_the_setting(settings: Any) -> None:  # noqa: ANN401
    settings.VOID_REASON_MIN_LENGTH = 25

    with pytest.raises(FieldValidationError) as raised:
        validate_void_reason(TEN)

    assert raised.value.fields == {
        "reason": [{"code": "void_reason_too_short", "params": {"min_length": 25}}]
    }


@pytest.mark.parametrize(
    ("configured", "effective"), [(0, 1), (-5, 1), (10, 10), (5000, VOID_REASON_MAX_LENGTH)]
)
def test_a_silly_setting_is_clamped_so_a_void_stays_possible(
    settings: Any,  # noqa: ANN401
    configured: int,
    effective: int,
) -> None:
    settings.VOID_REASON_MIN_LENGTH = configured

    assert void_reason_min_length() == effective


# --- core: POST .../void/ and void_record --------------------------------------------------


def test_void_endpoint_refuses_a_short_reason_with_code_and_params(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": NINE}, format="json")

    widget.refresh_from_db()
    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"] == {"reason": [TOO_SHORT]}
    assert widget.voided_at is None


def test_void_endpoint_accepts_exactly_the_minimum_and_stores_it_trimmed(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": f"  {TEN}  "}, format="json")

    widget.refresh_from_db()
    assert response.status_code == 200
    assert widget.void_reason == TEN


def test_void_endpoint_follows_the_setting(
    client_a: APIClient,
    org_a: Organization,
    settings: Any,  # noqa: ANN401
) -> None:
    settings.VOID_REASON_MIN_LENGTH = 3
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {"reason": "dup"}, format="json")

    assert response.status_code == 200


def test_void_endpoint_missing_reason_keeps_the_required_code(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {}, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["reason"][0]["code"] == "required"


def test_void_record_cannot_be_used_to_store_a_short_reason(
    org_a: Organization, member_a: User
) -> None:
    widget = WidgetFactory(organization=org_a)

    with pytest.raises(FieldValidationError):
        void_record(widget, member_a, NINE)

    assert Widget.objects.get(pk=widget.pk).voided_at is None


def test_void_record_stores_the_trimmed_reason(org_a: Organization, member_a: User) -> None:
    widget = WidgetFactory(organization=org_a)

    voided = void_record(widget, member_a, f"  {TEN}  ")

    assert voided.void_reason == TEN


# --- rules: voiding a scheduled parameter version ------------------------------------------


@pytest.fixture
def rule_admin(api_client: APIClient, org_a: Organization, make_member: MemberFactory) -> APIClient:
    user, _ = make_member(org_a, (rule_codes.RULE_PARAMETER_VERSION_VOID,))
    api_client.force_authenticate(user)
    return api_client


def scheduled_version(org_a: Organization) -> Any:  # noqa: ANN401
    parameter = RuleParameterFactory(
        organization=org_a, key="speed_lock_kmh", unit="km_h", min_value=0, max_value=100
    )
    moment = timezone.now() + timedelta(days=3)
    return RuleParameterVersionFactory(
        parameter=parameter, value=12, effective_from=moment, effective_date=moment.date()
    )


def rule_void_url(version: Any) -> str:  # noqa: ANN401
    return f"/api/v1/rule-parameters/speed_lock_kmh/versions/{version.id}/void/"


def test_rule_version_void_refuses_a_short_reason(
    rule_admin: APIClient, org_a: Organization
) -> None:
    version = scheduled_version(org_a)

    response = rule_admin.post(rule_void_url(version), {"reason": NINE}, format="json")

    version.refresh_from_db()
    assert response.status_code == 400
    assert response.data["fields"] == {"reason": [TOO_SHORT]}
    assert version.voided_at is None


def test_rule_version_void_accepts_the_minimum(rule_admin: APIClient, org_a: Organization) -> None:
    version = scheduled_version(org_a)

    response = rule_admin.post(rule_void_url(version), {"reason": TEN}, format="json")

    assert response.status_code == 200
    assert response.data["void_reason"] == TEN


def test_rule_version_void_checks_the_reason_before_the_state(
    rule_admin: APIClient, org_a: Organization
) -> None:
    """A bad body is a 400 even for a version that could not be voided anyway."""
    in_force = RuleParameterVersionFactory(
        parameter=RuleParameterFactory(organization=org_a, key="speed_lock_kmh"),
        effective_from=timezone.now() - timedelta(days=1),
    )

    response = rule_admin.post(rule_void_url(in_force), {"reason": NINE}, format="json")

    assert response.status_code == 400


# --- field sync: record.void ---------------------------------------------------------------


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def void_event(target_id: Any, reason: str) -> dict[str, Any]:  # noqa: ANN401
    return event(type="record.void", payload={"reason": reason}, voids_event_id=str(target_id))


def test_a_short_void_event_is_rejected_and_leaves_the_target_intact(phone: Phone) -> None:
    original = event()
    phone.sync([original])

    response = phone.sync([void_event(original["id"], NINE)])

    result = response.data["results"][0]
    assert (result["status"], result["code"]) == ("rejected", "invalid_payload")
    assert result["params"]["fields"] == {"reason": ["void_reason_too_short"]}
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is None


def test_a_void_event_with_the_minimum_reason_is_accepted(phone: Phone) -> None:
    original = event()
    phone.sync([original])

    response = phone.sync([void_event(original["id"], f"  {TEN}  ")])

    assert response.data["results"][0]["status"] == "accepted"
    assert FieldEvent.objects.get(pk=original["id"]).void_reason == TEN


# --- /me/ limits ---------------------------------------------------------------------------


def test_me_tells_the_web_the_void_reason_limits(client_a: APIClient) -> None:
    response = client_a.get(ME_URL)

    assert response.status_code == 200
    assert response.data["limits"] == {
        "void_reason_min_length": 10,
        "void_reason_max_length": VOID_REASON_MAX_LENGTH,
    }


def test_me_limits_follow_the_setting(
    client_a: APIClient,
    settings: Any,  # noqa: ANN401
) -> None:
    settings.VOID_REASON_MIN_LENGTH = 15

    response = client_a.get(ME_URL)

    assert response.data["limits"]["void_reason_min_length"] == 15
