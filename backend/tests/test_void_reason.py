"""Void reasons (#32): one validator for every void path, code + params, never user text."""

from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from core.services import void_record
from core.validation import flatten_error_details
from core.void_reason import VOID_REASON_MAX_LENGTH, validate_void_reason, void_reason_min_length
from field_sync.models import FieldEvent
from organizations.models import Organization
from rules import permissions as rule_codes
from tests.conftest import MemberFactory
from tests.factories import RuleParameterFactory, RuleParameterVersionFactory, WidgetFactory
from tests.sync_support import Phone, event, make_phone
from tests.testapp.models import Widget

WIDGETS = "/api/v1/widgets/"
ME_URL = "/api/v1/me/"
TOO_SHORT = {"code": "void_reason_too_short", "params": {"min_length": 10}}
NINE = "a" * 9
TEN = "a" * 10


# --- the validator: what counts, what is refused ------------------------------------------


def refused(reason: str) -> dict[str, Any]:
    with pytest.raises(ValidationError) as raised:
        validate_void_reason(reason, "reason")
    return flatten_error_details(raised.value.get_full_details())


def test_the_default_minimum_is_ten_characters() -> None:
    assert void_reason_min_length() == 10


@pytest.mark.parametrize(
    ("raw", "stored"),
    [
        (f"  {TEN}  \n", TEN),  # trimmed
        ("e\u0301" * 10, "\u00e9" * 10),  # decomposed accents are stored composed (NFC)
        ("\u00f1" * 5 + "\u00fc" * 5, "\u00f1" * 5 + "\u00fc" * 5),  # accented letters count
        ("\U0001f600" * 10, "\U0001f600" * 10),  # so do emoji
        ("l\u00ednea uno\nl\u00ednea dos", "l\u00ednea uno\nl\u00ednea dos"),  # LF is allowed
        ("l\u00ednea uno\r\nl\u00ednea dos", "l\u00ednea uno\nl\u00ednea dos"),  # CRLF becomes LF
    ],
)
def test_the_validator_returns_the_normalized_text_to_store(raw: str, stored: str) -> None:
    assert validate_void_reason(raw) == stored


INVISIBLE = [
    "\u200b",  # zero-width space (Cf)
    "\u200d",  # zero-width joiner (Cf)
    "\ufeff",  # BOM (Cf): JS trim() strips it, Python strip() does not
    "\u0301",  # combining acute accent (Mn)
    "\u00a0",  # no-break space (Zs)
    "\u2028",  # line separator (Zl)
    "\u3164",  # Hangul filler
    "\u2800",  # braille blank
    "\ue000",  # private use (Co)
    "\u0378",  # unassigned (Cn)
]


@pytest.mark.parametrize("invisible", INVISIBLE)
def test_text_that_shows_nothing_never_reaches_the_minimum(invisible: str) -> None:
    assert refused(invisible * 10) == {"reason": [TOO_SHORT]}
    assert refused(NINE + invisible * 5) == {"reason": [TOO_SHORT]}


@pytest.mark.parametrize(
    "reason",
    [
        "\u200b" + "\n" * 10 + "\u200b",  # a multiline reason that shows nothing
        "ab" + "\n" * 8 + "cd",  # four letters padded with line feeds
        "\n".join("a" * 5),  # five letters, one per line
    ],
)
def test_line_feeds_are_allowed_but_never_count_toward_the_minimum(reason: str) -> None:
    assert refused(reason) == {"reason": [TOO_SHORT]}


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_void_endpoint_requires_text_for_other(client_a: APIClient, org_a: Organization) -> None:
    """Blank text reaches the validator (`allow_blank=True`) instead of DRF's own `blank`."""
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(
        f"{WIDGETS}{widget.pk}/void/", {"reason_code": "other", "reason": "   "}, format="json"
    )

    assert response.data["fields"] == {
        "reason": [{"code": "void_reason_required_for_other", "params": {}}]
    }


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_void_endpoint_requires_a_reason_code(client_a: APIClient, org_a: Organization) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(f"{WIDGETS}{widget.pk}/void/", {}, format="json")

    assert response.data["fields"]["reason_code"][0]["code"] == "required"


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_void_endpoint_stores_the_normalized_reason(
    client_a: APIClient, org_a: Organization
) -> None:
    widget = WidgetFactory(organization=org_a)

    response = client_a.post(
        f"{WIDGETS}{widget.pk}/void/",
        {"reason_code": "other", "reason": f"  {TEN}  "},
        format="json",
    )

    widget.refresh_from_db()
    assert response.status_code == 200
    assert widget.void_reason == TEN


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_void_record_validates_for_callers_that_skip_the_serializer(
    org_a: Organization, member_a: User
) -> None:
    widget = WidgetFactory(organization=org_a)

    with pytest.raises(ValidationError) as raised:
        void_record(widget, member_a, "\u200b" * 10, "other")

    assert flatten_error_details(raised.value.get_full_details()) == {"reason": [TOO_SHORT]}
    assert Widget.objects.get(pk=widget.pk).voided_at is None


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


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_rule_version_void_refuses_a_short_reason(
    rule_admin: APIClient, org_a: Organization
) -> None:
    version = scheduled_version(org_a)

    response = rule_admin.post(
        rule_void_url(version), {"reason_code": "other", "reason": NINE}, format="json"
    )

    version.refresh_from_db()
    assert response.status_code == 400
    assert response.data["fields"] == {"reason": [TOO_SHORT]}
    assert version.voided_at is None


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_rule_version_void_checks_the_reason_before_the_state(
    rule_admin: APIClient, org_a: Organization
) -> None:
    """A bad body is a 400 even for a version that could not be voided anyway."""
    in_force = RuleParameterVersionFactory(
        parameter=RuleParameterFactory(organization=org_a, key="speed_lock_kmh"),
        effective_from=timezone.now() - timedelta(days=1),
    )

    response = rule_admin.post(
        rule_void_url(in_force), {"reason_code": "other", "reason": NINE}, format="json"
    )

    assert response.status_code == 400


# --- field sync: record.void ---------------------------------------------------------------


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


def void_event(target_id: Any, reason: str) -> dict[str, Any]:  # noqa: ANN401
    return event(
        type="record.void",
        payload={"reason_code": "other", "reason": reason},
        voids_event_id=str(target_id),
    )


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_a_short_void_event_is_rejected_and_leaves_the_target_intact(phone: Phone) -> None:
    original = event()
    phone.sync([original])

    response = phone.sync([void_event(original["id"], NINE)])

    result = response.data["results"][0]
    assert (result["status"], result["code"]) == ("rejected", "invalid_payload")
    assert result["params"]["fields"] == {"reason": ["void_reason_too_short"]}
    assert result["params"]["field_params"] == {
        "reason": {"void_reason_too_short": {"min_length": 10}}
    }
    assert FieldEvent.objects.get(pk=original["id"]).voided_at is None


@pytest.mark.django_db
@pytest.mark.usefixtures("void_catalog")
def test_a_void_event_with_other_requires_text(phone: Phone) -> None:
    original = event()
    phone.sync([original])

    voiding = void_event(original["id"], "")
    del voiding["payload"]["reason"]
    response = phone.sync([voiding])

    assert response.data["results"][0]["params"]["fields"] == {
        "reason": ["void_reason_required_for_other"]
    }


# --- /me/ limits ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_me_tells_the_web_the_void_reason_limits(client_a: APIClient) -> None:
    response = client_a.get(ME_URL)

    assert response.status_code == 200
    assert response.data["limits"] == {
        "void_reason_min_length": 10,
        "void_reason_max_length": VOID_REASON_MAX_LENGTH,
    }


@pytest.mark.django_db
def test_me_limits_follow_the_setting(
    client_a: APIClient,
    settings: Any,  # noqa: ANN401
) -> None:
    settings.VOID_REASON_MIN_LENGTH = 15

    response = client_a.get(ME_URL)

    assert response.data["limits"]["void_reason_min_length"] == 15
