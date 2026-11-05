from datetime import timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from rules import permissions as rule_codes
from rules.models import RuleParameterVersion, ValueType
from tests.factories import RuleParameterFactory, RuleParameterVersionFactory, UserFactory

pytestmark = pytest.mark.django_db

ADMIN_CODES = (
    rule_codes.RULE_PARAMETER_READ,
    rule_codes.RULE_PARAMETER_VERSION_READ,
    rule_codes.RULE_PARAMETER_VERSION_CREATE,
    rule_codes.RULE_PARAMETER_VERSION_VOID,
)
PARAMETERS_URL = "/api/v1/rule-parameters/"


def versions_url(key: str, suffix: str = "") -> str:
    return f"{PARAMETERS_URL}{key}/versions/{suffix}"


def future_date(days: int = 5) -> str:
    return (timezone.now() + timedelta(days=days)).date().isoformat()


@pytest.fixture
def admin(api_client, org_a, make_member):
    user, _ = make_member(org_a, ADMIN_CODES)
    api_client.force_authenticate(user)
    return api_client


@pytest.fixture
def speed(org_a):
    parameter = RuleParameterFactory(
        organization=org_a, key="speed_lock_kmh", unit="km_h", min_value=0, max_value=100
    )
    RuleParameterVersionFactory(parameter=parameter, value=10)
    return parameter


def test_list_parameters_returns_current_value_as_a_number(admin, speed) -> None:
    response = admin.get(PARAMETERS_URL)

    [row] = response.data["results"]
    assert response.status_code == 200
    assert (row["key"], row["value"], row["unit"], row["value_type"]) == (
        "speed_lock_kmh",
        10,
        "km_h",
        "integer",
    )
    assert isinstance(row["value"], int)
    assert (row["min_value"], row["max_value"], row["next_change_at"]) == (0, 100, None)


def test_list_parameters_shows_the_value_in_force_and_the_next_change(admin, speed) -> None:
    RuleParameterVersionFactory(
        parameter=speed,
        value=12,
        effective_from=timezone.now() + timedelta(days=3),
        effective_date=(timezone.now() + timedelta(days=3)).date(),
    )

    [row] = admin.get(PARAMETERS_URL).data["results"]

    assert row["value"] == 10
    assert row["next_change_at"] is not None


def test_list_parameters_hides_other_organizations(admin, speed, org_b) -> None:
    RuleParameterFactory(organization=org_b, key="foreign")

    keys = [row["key"] for row in admin.get(PARAMETERS_URL).data["results"]]

    assert keys == ["speed_lock_kmh"]


def test_parameter_without_version_has_null_value(admin, org_a) -> None:
    RuleParameterFactory(organization=org_a, key="session_idle_minutes")

    [row] = admin.get(PARAMETERS_URL).data["results"]

    assert (row["value"], row["effective_from"], row["version_id"]) == (None, None, None)


def test_retrieve_parameter_by_key(admin, speed) -> None:
    response = admin.get(f"{PARAMETERS_URL}speed_lock_kmh/")

    assert response.status_code == 200
    assert response.data["value"] == 10


def test_decimal_parameter_value_is_a_float(admin, org_a) -> None:
    parameter = RuleParameterFactory(
        organization=org_a, key="fuel_efficiency_min_km_l", value_type=ValueType.DECIMAL
    )
    RuleParameterVersionFactory(parameter=parameter, value="7.250")

    assert admin.get(f"{PARAMETERS_URL}fuel_efficiency_min_km_l/").data["value"] == 7.25


def test_another_organizations_parameter_is_404(admin, org_b) -> None:
    RuleParameterFactory(organization=org_b, key="foreign")

    assert admin.get(f"{PARAMETERS_URL}foreign/").status_code == 404
    assert admin.get(versions_url("foreign")).status_code == 404
    response = admin.post(
        versions_url("foreign"),
        {"value": 1, "effective_from": future_date(), "reason": "x"},
        format="json",
    )
    assert response.status_code == 404


def test_there_is_no_post_on_parameters(admin) -> None:
    assert admin.post(PARAMETERS_URL, {"key": "x"}, format="json").status_code == 405


def test_history_lists_superseded_in_force_and_scheduled(admin, speed) -> None:
    RuleParameterVersionFactory(
        parameter=speed,
        value=5,
        effective_from=timezone.now() - timedelta(days=90),
        effective_date=(timezone.now() - timedelta(days=90)).date(),
    )
    RuleParameterVersionFactory(
        parameter=speed,
        value=12,
        effective_from=timezone.now() + timedelta(days=3),
        effective_date=(timezone.now() + timedelta(days=3)).date(),
    )

    response = admin.get(versions_url("speed_lock_kmh"))

    rows = response.data["results"]
    assert [(row["value"], row["status"]) for row in rows] == [
        (12, "scheduled"),
        (10, "in_force"),
        (5, "superseded"),
    ]
    assert {"id", "effective_from", "effective_date", "reason", "created_by", "created_at"} <= set(
        rows[0]
    )


def test_create_version_returns_201_and_keeps_the_old_one(admin, speed) -> None:
    payload = {"value": 15, "effective_from": future_date(), "reason": "Journey R9"}

    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    assert response.status_code == 201
    assert (response.data["value"], response.data["status"], response.data["reason"]) == (
        15,
        "scheduled",
        "Journey R9",
    )
    assert response.data["created_by"] is not None
    assert speed.versions.count() == 2
    assert speed.versions.filter(value=10).exists()


def test_create_version_for_today_takes_effect_immediately(admin, speed, org_a) -> None:
    today = timezone.now().astimezone(ZoneInfo(org_a.timezone)).date().isoformat()

    response = admin.post(
        versions_url("speed_lock_kmh"),
        {"value": 15, "effective_from": today, "reason": "now"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["status"] == "in_force"


def test_create_version_in_the_past_is_400_effective_from_in_past(admin, speed) -> None:
    payload = {"value": 15, "effective_from": future_date(-3), "reason": "late"}

    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["effective_from"] == [
        {"code": "effective_from_in_past", "params": {}}
    ]


def test_create_version_on_a_taken_date_is_400_duplicate_effective_date(admin, speed) -> None:
    payload = {"value": 15, "effective_from": future_date(), "reason": "first"}
    admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    response = admin.post(versions_url("speed_lock_kmh"), {**payload, "value": 16}, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["effective_from"][0]["code"] == "duplicate_effective_date"
    assert speed.versions.count() == 2


def test_create_version_out_of_range_reports_the_bounds(admin, speed) -> None:
    payload = {"value": 101, "effective_from": future_date(), "reason": "too fast"}

    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["value"] == [
        {"code": "out_of_range", "params": {"min": 0, "max": 100}}
    ]


def test_create_version_with_a_fraction_for_an_integer_parameter_is_400(admin, speed) -> None:
    payload = {"value": 10.5, "effective_from": future_date(), "reason": "x"}

    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    assert response.data["fields"]["value"][0]["code"] == "not_an_integer"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"effective_from": "2099-01-01", "reason": "x"}, "value"),
        ({"value": 1, "reason": "x"}, "effective_from"),
        ({"value": 1, "effective_from": "2099-01-01"}, "reason"),
        ({"value": 1, "effective_from": "2099-01-01", "reason": "  "}, "reason"),
        ({"value": "abc", "effective_from": "2099-01-01", "reason": "x"}, "value"),
        ({"value": 1, "effective_from": "next week", "reason": "x"}, "effective_from"),
        ({"value": 1.2345, "effective_from": "2099-01-01", "reason": "x"}, "value"),
    ],
)
def test_create_version_validates_the_payload(admin, speed, payload, field) -> None:
    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    assert response.status_code == 400
    assert field in response.data["fields"]


def test_create_version_ignores_organization_and_author_in_the_payload(admin, speed, org_b) -> None:
    payload = {
        "value": 15,
        "effective_from": future_date(),
        "reason": "x",
        "organization": str(org_b.id),
        "created_by": "00000000-0000-0000-0000-000000000000",
    }

    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    version = RuleParameterVersion.objects.get(value=15)
    assert response.status_code == 201
    assert version.organization_id == speed.organization_id


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_put_patch_and_delete_on_a_version_return_405(admin, speed, method) -> None:
    version = speed.versions.get()
    detail = versions_url("speed_lock_kmh", f"{version.id}/")

    response = getattr(admin, method)(detail, {"value": 99}, format="json")

    assert response.status_code == 405
    version.refresh_from_db()
    assert version.value == 10


def test_put_on_the_versions_list_is_405(admin, speed) -> None:
    assert admin.put(versions_url("speed_lock_kmh"), {}, format="json").status_code == 405


def test_retrieve_a_version(admin, speed) -> None:
    version = speed.versions.get()

    response = admin.get(versions_url("speed_lock_kmh", f"{version.id}/"))

    assert (response.status_code, response.data["status"]) == (200, "in_force")


def test_another_organizations_version_id_under_an_own_key_is_404(admin, speed, org_b) -> None:
    foreign = RuleParameterVersionFactory(parameter=RuleParameterFactory(organization=org_b))

    assert admin.get(versions_url("speed_lock_kmh", f"{foreign.id}/")).status_code == 404
    response = admin.post(
        versions_url("speed_lock_kmh", f"{foreign.id}/void/"), {"reason": "x"}, format="json"
    )
    assert response.status_code == 404


def scheduled(speed, days: int = 3, created_by=None):
    moment = timezone.now() + timedelta(days=days)
    return RuleParameterVersionFactory(
        parameter=speed,
        value=12,
        effective_from=moment,
        effective_date=moment.date(),
        created_by=created_by,
    )


def test_void_a_scheduled_version_returns_it_voided(admin, speed) -> None:
    version = scheduled(speed)

    response = admin.post(
        versions_url("speed_lock_kmh", f"{version.id}/void/"),
        {"reason": "a typo in the value"},
        format="json",
    )

    assert response.status_code == 200
    assert (response.data["status"], response.data["void_reason"]) == (
        "voided",
        "a typo in the value",
    )
    assert response.data["voided_by"] is not None
    assert response.data["voided_at"] is not None


def test_voided_version_stays_in_the_history(admin, speed) -> None:
    version = scheduled(speed)
    admin.post(
        versions_url("speed_lock_kmh", f"{version.id}/void/"),
        {"reason": "a typo in the value"},
        format="json",
    )

    url = versions_url("speed_lock_kmh")
    statuses = [row["status"] for row in admin.get(url, {"include_voided": "true"}).data["results"]]

    assert statuses == ["voided", "in_force"]


def test_versions_list_leaves_voided_out_unless_asked(admin, speed) -> None:
    version = scheduled(speed)
    admin.post(
        versions_url("speed_lock_kmh", f"{version.id}/void/"),
        {"reason": "a typo in the value"},
        format="json",
    )
    url = versions_url("speed_lock_kmh")

    default = admin.get(url).data
    explicit_false = admin.get(url, {"include_voided": "false"}).data
    included = admin.get(url, {"include_voided": "true"}).data

    assert [row["status"] for row in default["results"]] == ["in_force"]
    assert default["count"] == explicit_false["count"] == 1
    assert included["count"] == 2


def test_voided_version_can_still_be_retrieved(admin, speed) -> None:
    version = scheduled(speed)
    url = versions_url("speed_lock_kmh", f"{version.id}/")
    admin.post(url + "void/", {"reason": "a typo in the value"}, format="json")

    response = admin.get(url)

    assert (response.status_code, response.data["status"]) == (200, "voided")


@pytest.mark.parametrize("value", ["yes", "1", "True", ""])
def test_include_voided_with_another_value_is_400(admin, speed, value) -> None:
    response = admin.get(versions_url("speed_lock_kmh"), {"include_voided": value})

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
    assert "include_voided" in response.data["fields"]


def test_versions_carry_the_usernames_even_of_users_without_a_membership(
    api_client, org_a, make_member, speed
) -> None:
    author = UserFactory(username="ana")  # no membership: someone who left the organization
    voider, _ = make_member(org_a, ADMIN_CODES, user=UserFactory(username="beto"))
    api_client.force_authenticate(voider)
    version = scheduled(speed, created_by=author)
    api_client.post(
        versions_url("speed_lock_kmh", f"{version.id}/void/"),
        {"reason": "a typo in the value"},
        format="json",
    )

    row = api_client.get(versions_url("speed_lock_kmh", f"{version.id}/")).data

    assert (row["created_by_username"], row["voided_by_username"]) == ("ana", "beto")
    assert row["created_by"] == author.id


def test_a_seed_version_has_no_usernames(admin, speed) -> None:
    [row] = admin.get(versions_url("speed_lock_kmh")).data["results"]

    assert (row["created_by_username"], row["voided_by_username"]) == (None, None)


def test_versions_list_does_not_query_per_author(
    admin, speed, django_assert_max_num_queries
) -> None:
    author = UserFactory()
    for days in range(1, 6):
        scheduled(speed, days, created_by=author)
    url = versions_url("speed_lock_kmh")
    admin.get(url)

    with django_assert_max_num_queries(12):
        assert admin.get(url).data["count"] == 6


def test_void_a_version_in_force_is_409_version_not_scheduled(admin, speed) -> None:
    version = speed.versions.get()

    response = admin.post(
        versions_url("speed_lock_kmh", f"{version.id}/void/"),
        {"reason": "a typo in the value"},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["code"] == "version_not_scheduled"


def test_void_twice_is_409_already_voided(admin, speed) -> None:
    url = versions_url("speed_lock_kmh", f"{scheduled(speed).id}/void/")
    admin.post(url, {"reason": "first void, with reason"}, format="json")

    response = admin.post(url, {"reason": "second void, with reason"}, format="json")

    assert (response.status_code, response.data["code"]) == (409, "already_voided")


def test_void_requires_a_reason(admin, speed) -> None:
    url = versions_url("speed_lock_kmh", f"{scheduled(speed).id}/void/")

    response = admin.post(url, {"reason": " "}, format="json")

    assert response.status_code == 400
    assert "reason" in response.data["fields"]


def test_a_date_freed_by_voiding_can_be_scheduled_again(admin, speed) -> None:
    payload = {"value": 15, "effective_from": future_date(), "reason": "first"}
    created = admin.post(versions_url("speed_lock_kmh"), payload, format="json")
    admin.post(
        versions_url("speed_lock_kmh", f"{created.data['id']}/void/"),
        {"reason": "a typo in the value"},
        format="json",
    )

    again = admin.post(versions_url("speed_lock_kmh"), {**payload, "value": 16}, format="json")

    assert again.status_code == 201


def test_effective_from_beyond_the_horizon_is_400_effective_from_too_far(admin, speed) -> None:
    payload = {"value": 15, "effective_from": future_date(400), "reason": "typo 2206"}

    response = admin.post(versions_url("speed_lock_kmh"), payload, format="json")

    assert response.status_code == 400
    assert response.data["fields"]["effective_from"][0]["code"] == "effective_from_too_far"


def test_two_versions_for_today_are_allowed_and_the_latest_wins(admin, speed, org_a) -> None:
    today = timezone.now().astimezone(ZoneInfo(org_a.timezone)).date().isoformat()
    for value in (15, 16):
        payload = {"value": value, "effective_from": today, "reason": "correction"}
        assert admin.post(versions_url("speed_lock_kmh"), payload, format="json").status_code == 201

    assert admin.get(f"{PARAMETERS_URL}speed_lock_kmh/").data["value"] == 16


def test_a_version_of_another_parameter_is_404(admin, speed, org_a) -> None:
    other = RuleParameterFactory(organization=org_a, key="other_key")
    version = RuleParameterVersionFactory(parameter=other)

    response = admin.get(versions_url("speed_lock_kmh", f"{version.id}/"))

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("method", "url", "missing_code"),
    [
        ("get", PARAMETERS_URL, rule_codes.RULE_PARAMETER_READ),
        ("get", f"{PARAMETERS_URL}speed_lock_kmh/", rule_codes.RULE_PARAMETER_READ),
        ("get", versions_url("speed_lock_kmh"), rule_codes.RULE_PARAMETER_VERSION_READ),
        ("post", versions_url("speed_lock_kmh"), rule_codes.RULE_PARAMETER_VERSION_CREATE),
        (
            "post",
            versions_url("speed_lock_kmh", "VERSION/void/"),
            rule_codes.RULE_PARAMETER_VERSION_VOID,
        ),
    ],
)
def test_each_action_needs_its_own_permission_code(
    api_client, org_a, make_member, speed, method, url, missing_code
) -> None:
    granted = [code for code in ADMIN_CODES if code != missing_code]
    user, _ = make_member(org_a, granted)
    api_client.force_authenticate(user)

    url = url.replace("VERSION", str(speed.versions.first().id))

    response = getattr(api_client, method)(url, {}, format="json")

    assert response.status_code == 403


def test_anonymous_requests_are_401(api_client, speed) -> None:
    assert api_client.get(PARAMETERS_URL).status_code == 401
    assert api_client.post(versions_url("speed_lock_kmh"), {}, format="json").status_code == 401
