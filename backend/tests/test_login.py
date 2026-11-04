"""`POST /auth/login/`: mobile tokens, web session + CSRF, generic errors, rate limit, lockout."""

import logging
import uuid

import pytest
from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import Device, DeviceSession, TokenPair, User
from accounts.tokens import hash_token
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import DeviceFactory, MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db

LOGIN = "/api/v1/auth/login/"
CSRF = "/api/v1/auth/csrf/"
ME = "/api/v1/me/"
PASSWORD = "pw-for-login-tests"  # noqa: S105


def user_with_password(password: str = PASSWORD, **kwargs: object) -> User:
    user = UserFactory(**kwargs)
    user.set_password(password)
    user.save(update_fields=["password"])
    return user


def member(make_member: MemberFactory, organization: Organization, **kwargs: object) -> User:
    user, _ = make_member(organization, ["ovitrap.read"], user=user_with_password(**kwargs))
    return user


def mobile_body(user: User, **extra: object) -> dict[str, object]:
    return {
        "username": user.username,
        "password": PASSWORD,
        "device_id": str(uuid.uuid4()),
        **extra,
    }


# --- mobile --------------------------------------------------------------------------------------


def test_mobile_login_returns_tokens_me_and_server_time_and_registers_the_device(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    body = mobile_body(user, app_version="1.0.0", label="Moto 7")

    response = api_client.post(LOGIN, body, format="json")

    assert response.status_code == 200
    assert set(response.data) == {"access", "refresh", "me", "server_time"}
    assert response.data["me"]["user"]["username"] == user.username
    assert response.data["me"]["organization"]["slug"] == "org-a"
    assert response.data["server_time"].endswith("Z")
    device = Device.objects.get(pk=body["device_id"])
    assert (device.organization, device.label, device.app_version) == (org_a, "Moto 7", "1.0.0")
    pair = TokenPair.objects.get(session__device=device)
    assert pair.access_hash == hash_token(response.data["access"])
    assert pair.refresh_hash == hash_token(response.data["refresh"])


def test_mobile_login_does_not_create_a_django_session(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)

    response = api_client.post(LOGIN, mobile_body(user), format="json")

    assert "sessionid" not in response.cookies


def test_the_issued_access_token_works_on_the_next_request(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    tokens = api_client.post(LOGIN, mobile_body(user), format="json").data

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    assert api_client.get(ME).data["user"]["username"] == user.username


def test_mobile_login_with_several_organizations_needs_the_header(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    MembershipFactory(user=user, organization=org_b)

    missing = api_client.post(LOGIN, mobile_body(user), format="json")
    chosen = api_client.post(
        LOGIN, mobile_body(user), format="json", headers={"X-Organization": "org-b"}
    )

    assert (missing.status_code, missing.data["code"]) == (400, "organization_header_required")
    assert chosen.status_code == 200
    assert chosen.data["me"]["organization"]["slug"] == "org-b"
    assert DeviceSession.objects.get().organization == org_b


def test_mobile_login_without_active_membership_is_403_and_opens_no_session(
    api_client: APIClient,
) -> None:
    user = user_with_password()

    response = api_client.post(LOGIN, mobile_body(user), format="json")

    assert (response.status_code, response.data["code"]) == (403, "no_active_membership")
    assert not DeviceSession.objects.exists()
    assert not Device.objects.exists()


def test_device_registered_in_another_organization_is_403(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    foreign = DeviceFactory(organization=org_b)

    response = api_client.post(LOGIN, mobile_body(user, device_id=str(foreign.pk)), format="json")

    assert (response.status_code, response.data["code"]) == (403, "device_organization_mismatch")


def test_revoked_device_is_403(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    device = DeviceFactory(organization=org_a, is_revoked=True, revoked_at=timezone.now())

    response = api_client.post(LOGIN, mobile_body(user, device_id=str(device.pk)), format="json")

    assert (response.status_code, response.data["code"]) == (403, "device_revoked")


def test_login_ignores_an_organization_id_in_the_body(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)

    response = api_client.post(
        LOGIN, mobile_body(user, organization_id=str(org_b.pk)), format="json"
    )

    assert response.data["me"]["organization"]["slug"] == "org-a"


@pytest.mark.parametrize(
    "payload",
    [
        {"password": PASSWORD},
        {"username": "someone"},
        {"username": "someone", "password": PASSWORD, "device_id": "not-a-uuid"},
        {"username": "someone", "password": PASSWORD, "device_id": None},
        {"username": ["list"], "password": PASSWORD},
    ],
)
def test_malformed_login_bodies_are_validation_errors(
    api_client: APIClient, payload: dict[str, object]
) -> None:
    response = api_client.post(LOGIN, payload, format="json")

    assert (response.status_code, response.data["code"]) == (400, "validation_error")


def test_invalid_json_is_a_400_not_a_server_error(api_client: APIClient) -> None:
    response = api_client.post(LOGIN, "{not json", content_type="application/json")

    assert response.status_code == 400


# --- generic errors -----------------------------------------------------------------------------


def test_bad_password_unknown_user_and_inactive_user_get_the_same_401(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    active = member(make_member, org_a)
    inactive = member(make_member, org_a, is_active=False)
    unusable = UserFactory()
    unusable.set_unusable_password()
    unusable.save(update_fields=["password"])
    attempts = [
        {"username": active.username, "password": "pw-for-wrong-guess"},
        {"username": "nobody-at-all", "password": PASSWORD},
        {"username": inactive.username, "password": PASSWORD},
        {"username": unusable.username, "password": PASSWORD},
    ]

    responses = [
        api_client.post(LOGIN, {**a, "device_id": str(uuid.uuid4())}, format="json")
        for a in attempts
    ]

    assert {response.status_code for response in responses} == {401}
    assert {response.data["code"] for response in responses} == {"invalid_credentials"}
    assert len({str(response.data) for response in responses}) == 1
    assert all(response.headers["WWW-Authenticate"] == "Session" for response in responses)


# --- web ----------------------------------------------------------------------------------------


def csrf_client() -> APIClient:
    return APIClient(enforce_csrf_checks=True)


def web_login(client: APIClient, user: User, **headers: str):
    client.get(CSRF)
    token = client.cookies["csrftoken"].value
    return client.post(
        LOGIN,
        {"username": user.username, "password": PASSWORD},
        format="json",
        headers={"X-CSRFToken": token, **headers},
    )


def test_csrf_endpoint_answers_204_and_sets_the_cookie() -> None:
    client = csrf_client()

    response = client.get(CSRF)

    assert response.status_code == 204
    assert client.cookies["csrftoken"].value


def test_web_login_without_a_csrf_token_is_403_and_creates_no_session(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    client = csrf_client()

    response = client.post(LOGIN, {"username": user.username, "password": PASSWORD}, format="json")

    assert (response.status_code, response.data["code"]) == (403, "permission_denied")
    assert "sessionid" not in response.cookies


def test_web_login_with_a_wrong_csrf_token_is_403(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    client = csrf_client()
    client.get(CSRF)

    response = client.post(
        LOGIN,
        {"username": user.username, "password": PASSWORD},
        format="json",
        headers={"X-CSRFToken": "x" * 64},
    )

    assert response.status_code == 403


def test_web_login_with_csrf_sets_the_session_cookie_and_returns_me(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    client = csrf_client()

    response = web_login(client, user)

    assert response.status_code == 200
    assert set(response.data) == {"me", "server_time"}
    assert response.data["me"]["organization"]["slug"] == "org-a"
    cookie = response.cookies["sessionid"]
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Lax"
    assert client.get(ME).data["user"]["username"] == user.username


def test_web_login_rotates_the_csrf_token(org_a: Organization, make_member: MemberFactory) -> None:
    user = member(make_member, org_a)
    client = csrf_client()
    client.get(CSRF)
    before = client.cookies["csrftoken"].value

    web_login(client, user)

    assert client.cookies["csrftoken"].value != before


def test_web_login_does_not_return_tokens(org_a: Organization, make_member: MemberFactory) -> None:
    user = member(make_member, org_a)

    response = web_login(csrf_client(), user)

    assert "access" not in response.data
    assert not DeviceSession.objects.exists()


def test_web_login_with_several_organizations_returns_the_choices(
    org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    MembershipFactory(user=user, organization=org_b)

    response = web_login(csrf_client(), user)

    assert response.status_code == 200
    assert response.data["me"]["organization"] is None
    assert {o["slug"] for o in response.data["me"]["organizations"]} == {"org-a", "org-b"}


def test_web_login_without_membership_is_403_and_opens_no_session() -> None:
    user = user_with_password()
    client = csrf_client()

    response = web_login(client, user)

    assert (response.status_code, response.data["code"]) == (403, "no_active_membership")
    assert client.get(ME).status_code == 401


def test_web_login_with_bad_credentials_is_the_generic_401() -> None:
    client = csrf_client()
    client.get(CSRF)

    response = client.post(
        LOGIN,
        {"username": "nobody", "password": "x"},
        format="json",
        headers={"X-CSRFToken": client.cookies["csrftoken"].value},
    )

    assert (response.status_code, response.data["code"]) == (401, "invalid_credentials")


# --- lockout ------------------------------------------------------------------------------------


def fail(client: APIClient, username: str, **headers: str):
    return client.post(
        LOGIN,
        {"username": username, "password": "pw-for-wrong-guess", "device_id": str(uuid.uuid4())},
        format="json",
        headers=headers,
    )


@override_settings(AUTH_LOGIN_MAX_FAILURES=3)
def test_lockout_after_n_failures_blocks_even_the_right_password(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)

    codes = [fail(api_client, user.username).status_code for _ in range(3)]
    locked = api_client.post(LOGIN, mobile_body(user), format="json")

    assert codes == [401, 401, 401]
    assert (locked.status_code, locked.data["code"]) == (429, "throttled")
    assert int(locked.headers["Retry-After"]) > 0


@override_settings(AUTH_LOGIN_MAX_FAILURES=3)
def test_lockout_is_per_user_and_address(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    victim = member(make_member, org_a)
    other = member(make_member, org_a)
    for _ in range(3):
        fail(api_client, victim.username)

    other_user = api_client.post(LOGIN, mobile_body(other), format="json")

    assert other_user.status_code == 200


@override_settings(AUTH_LOGIN_MAX_FAILURES=3)
def test_a_successful_login_clears_the_failures(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user = member(make_member, org_a)
    for _ in range(2):
        fail(api_client, user.username)
    assert api_client.post(LOGIN, mobile_body(user), format="json").status_code == 200

    codes = [fail(api_client, user.username).status_code for _ in range(2)]

    assert codes == [401, 401]


@override_settings(AUTH_LOGIN_MAX_FAILURES=3)
def test_unknown_usernames_lock_out_exactly_like_real_ones(api_client: APIClient) -> None:
    codes = [fail(api_client, "ghost").status_code for _ in range(4)]

    assert codes == [401, 401, 401, 429]


@override_settings(AUTH_LOGIN_MAX_FAILURES=3)
def test_lockout_ignores_username_case(api_client: APIClient) -> None:
    results = [fail(api_client, name).status_code for name in ("Ghost", "GHOST", "ghost", "gHost")]

    assert results == [401, 401, 401, 429]


# --- rate limit ---------------------------------------------------------------------------------


def set_rate(monkeypatch: pytest.MonkeyPatch, scope: str, rate: str) -> None:
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, scope, rate)


def test_rotating_x_forwarded_for_does_not_evade_the_rate_limit(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_rate(monkeypatch, "login_user_ip", "3/min")

    codes = [
        fail(api_client, "ghost", **{"X-Forwarded-For": f"10.0.0.{i}"}).status_code
        for i in range(5)
    ]

    assert codes == [401, 401, 401, 429, 429]


def test_the_throttle_honors_num_proxies_for_the_client_address(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_rate(monkeypatch, "login_user_ip", "1/min")

    with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
        first = fail(api_client, "ghost", **{"X-Forwarded-For": "198.51.100.1"})
        other_client = fail(api_client, "ghost", **{"X-Forwarded-For": "198.51.100.2"})
        same_client = fail(api_client, "ghost", **{"X-Forwarded-For": "198.51.100.1"})

    assert (first.status_code, other_client.status_code, same_client.status_code) == (401, 401, 429)


def test_per_user_limit_does_not_block_other_users_from_the_same_address(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_rate(monkeypatch, "login_user_ip", "2/min")

    codes = [fail(api_client, name).status_code for name in ("a", "a", "a", "b")]

    assert codes == [401, 401, 429, 401]


def test_per_address_limit_applies_across_usernames(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_rate(monkeypatch, "login_ip", "3/min")

    codes = [fail(api_client, f"user{i}").status_code for i in range(4)]

    assert codes == [401, 401, 401, 429]
    assert fail(api_client, "user9").headers["Retry-After"]


def test_a_malformed_body_still_counts_against_the_address_limit(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_rate(monkeypatch, "login_ip", "2/min")

    codes = [
        api_client.post(LOGIN, "{bad", content_type="application/json").status_code
        for _ in range(3)
    ]

    assert codes == [400, 400, 429]


# --- logs ---------------------------------------------------------------------------------------


def test_login_logs_never_contain_passwords_tokens_or_emails(
    api_client: APIClient,
    org_a: Organization,
    make_member: MemberFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    user = member(make_member, org_a)
    caplog.set_level(logging.DEBUG)

    ok = api_client.post(LOGIN, mobile_body(user), format="json")
    api_client.post(
        LOGIN,
        {
            "username": user.username,
            "password": "pw-for-wrong-login-123",
            "device_id": str(uuid.uuid4()),
        },
        format="json",
    )

    text = caplog.text
    assert "event=login_succeeded" in text
    assert "event=login_failed" in text
    for secret in (
        PASSWORD,
        "pw-for-wrong-login-123",
        ok.data["access"],
        ok.data["refresh"],
        user.email,
    ):
        assert secret not in text
    assert user.username not in text  # only its keyed fingerprint is logged
    assert str(user.pk) in text


def test_user_model_is_not_leaked_in_the_failure_response(api_client: APIClient) -> None:
    response = fail(api_client, "ghost")

    assert "ghost" not in str(response.data)


# --- refusal and supersession logs -------------------------------------------------------------


def test_a_second_login_on_the_same_device_logs_the_supersession(
    api_client: APIClient,
    org_a: Organization,
    make_member: MemberFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    user = member(make_member, org_a)
    body = mobile_body(user)
    api_client.post(LOGIN, body, format="json")
    caplog.set_level(logging.DEBUG)

    api_client.post(LOGIN, body, format="json")

    assert "event=sessions_revoked" in caplog.text
    assert "reason=superseded" in caplog.text
    assert DeviceSession.objects.filter(revoke_reason="superseded").count() == 1


@pytest.mark.parametrize(
    "refusal", ["device_revoked", "device_organization_mismatch", "no_membership"]
)
def test_a_refused_login_after_a_valid_password_is_logged_with_its_reason(
    api_client: APIClient,
    org_a: Organization,
    org_b: Organization,
    make_member: MemberFactory,
    caplog: pytest.LogCaptureFixture,
    refusal: str,
) -> None:
    if refusal == "no_membership":
        user = user_with_password()
        body = mobile_body(user)
        expected = "no_active_membership"
    else:
        user = member(make_member, org_a)
        device = (
            DeviceFactory(organization=org_a, is_revoked=True, revoked_at=timezone.now())
            if refusal == "device_revoked"
            else DeviceFactory(organization=org_b)
        )
        body = mobile_body(user, device_id=str(device.pk))
        expected = refusal
    caplog.set_level(logging.DEBUG)

    response = api_client.post(LOGIN, body, format="json")

    assert response.status_code == 403
    assert "event=login_refused" in caplog.text
    assert f"reason={expected}" in caplog.text
    assert PASSWORD not in caplog.text
