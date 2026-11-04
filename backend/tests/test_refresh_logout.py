"""`POST /auth/refresh/` (rotation, reuse detection) and `POST /auth/logout/`."""

import logging
import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import DeviceSession, RevokeReason, TokenPair, User
from accounts.services import DeviceInfo, start_device_session
from accounts.token_pairs import MAX_SIBLING_PAIRS, IssuedTokens
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

REFRESH = "/api/v1/auth/refresh/"
LOGOUT = "/api/v1/auth/logout/"
LOGIN = "/api/v1/auth/login/"
CSRF = "/api/v1/auth/csrf/"
ME = "/api/v1/me/"
PASSWORD = "pw-for-login-tests"  # noqa: S105


def session_for(make_member: MemberFactory, organization: Organization) -> IssuedTokens:
    user, _ = make_member(organization, ["ovitrap.read"])
    return start_device_session(user, organization, DeviceInfo(device_id=uuid.uuid4()))


def refresh(client: APIClient, issued: IssuedTokens, token: str | None = None):
    return client.post(
        REFRESH,
        {"refresh": token or issued.refresh, "device_id": str(issued.session.device_id)},
        format="json",
    )


def bearer(client: APIClient, token: str) -> APIClient:
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


# --- refresh ------------------------------------------------------------------------------------


def test_refresh_rotates_the_pair_and_the_new_access_token_works(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)

    response = refresh(api_client, issued)

    assert response.status_code == 200
    assert set(response.data) == {"access", "refresh", "server_time"}
    assert response.data["access"] != issued.access
    assert response.data["refresh"] != issued.refresh
    assert bearer(api_client, response.data["access"]).get(ME).status_code == 200


def test_the_replaced_access_token_stops_working_after_the_grace_window(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    refresh(api_client, issued)
    assert bearer(APIClient(), issued.access).get(ME).status_code == 200  # inside the window
    moment = timezone.now() - timedelta(seconds=120)
    TokenPair.objects.filter(pk=issued.pair.pk).update(consumed_at=moment, superseded_at=moment)

    response = bearer(APIClient(), issued.access).get(ME)

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")


def test_reusing_an_old_refresh_token_outside_the_grace_window_revokes_the_session(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    newest = refresh(api_client, issued).data
    moment = timezone.now() - timedelta(seconds=120)
    TokenPair.objects.filter(pk=issued.pair.pk).update(consumed_at=moment, superseded_at=moment)

    reuse = refresh(api_client, issued)
    legit = refresh(api_client, issued, token=newest["refresh"])
    access = bearer(APIClient(), newest["access"]).get(ME)

    assert (reuse.status_code, reuse.data["code"]) == (401, "session_revoked")
    assert (legit.status_code, legit.data["code"]) == (401, "session_revoked")
    assert (access.status_code, access.data["code"]) == (401, "session_revoked")
    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert session.revoke_reason == RevokeReason.REFRESH_REUSE
    assert session.final_upload_deadline is None


def test_retrying_the_old_refresh_token_inside_the_grace_window_rotates_again(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    refresh(api_client, issued)  # the response is "lost": the client retries with its old token

    retry = refresh(api_client, issued)

    assert retry.status_code == 200
    assert bearer(APIClient(), retry.data["access"]).get(ME).status_code == 200


def test_expired_refresh_token_is_401_token_expired(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    TokenPair.objects.filter(pk=issued.pair.pk).update(
        refresh_expires_at=timezone.now() - timedelta(seconds=1)
    )

    response = refresh(api_client, issued)

    assert (response.status_code, response.data["code"]) == (401, "token_expired")


def test_refresh_with_another_device_id_is_401_invalid_token(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)

    response = api_client.post(
        REFRESH, {"refresh": issued.refresh, "device_id": str(uuid.uuid4())}, format="json"
    )

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")
    assert refresh(api_client, issued).status_code == 200  # the session is untouched


def test_unknown_refresh_token_is_401_with_a_challenge(api_client: APIClient) -> None:
    response = api_client.post(
        REFRESH, {"refresh": "never-issued", "device_id": str(uuid.uuid4())}, format="json"
    )

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")
    assert "WWW-Authenticate" in response.headers


def test_an_access_token_is_not_a_refresh_token(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)

    response = refresh(api_client, issued, token=issued.access)

    assert response.data["code"] == "invalid_token"


@pytest.mark.parametrize(
    "payload", [{}, {"refresh": "x"}, {"device_id": "x"}, {"refresh": "x", "device_id": "no"}]
)
def test_refresh_validates_the_body(api_client: APIClient, payload: dict[str, str]) -> None:
    response = api_client.post(REFRESH, payload, format="json")

    assert (response.status_code, response.data["code"]) == (400, "validation_error")


def test_refresh_is_rate_limited_by_address(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "refresh", "2/min")
    body = {"refresh": "x", "device_id": str(uuid.uuid4())}

    codes = [api_client.post(REFRESH, body, format="json").status_code for _ in range(3)]

    assert codes == [401, 401, 429]


def test_refresh_logs_events_without_tokens(
    api_client: APIClient,
    org_a: Organization,
    make_member: MemberFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    issued = session_for(make_member, org_a)
    caplog.set_level(logging.DEBUG)

    ok = refresh(api_client, issued)
    refresh(api_client, issued)  # a duplicate inside the window: a grace retry
    moment = timezone.now() - timedelta(seconds=120)
    TokenPair.objects.filter(pk=issued.pair.pk).update(consumed_at=moment, superseded_at=moment)
    refresh(api_client, issued)  # outside the window: reuse

    assert "event=refresh " in caplog.text
    assert "event=refresh_grace_retry" in caplog.text
    assert "event=refresh_reuse_detected" in caplog.text
    for token in (issued.access, issued.refresh, ok.data["access"], ok.data["refresh"]):
        assert token not in caplog.text


# --- logout: mobile -----------------------------------------------------------------------------


def test_mobile_logout_revokes_the_session_and_its_tokens(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)

    response = bearer(api_client, issued.access).post(LOGOUT)

    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert response.status_code == 204
    assert (session.revoke_reason, session.revoked_by) == (RevokeReason.LOGOUT, session.user)
    assert session.final_upload_deadline is None
    assert api_client.get(ME).data["code"] == "session_revoked"
    assert refresh(APIClient(), issued).data["code"] == "session_revoked"


def test_mobile_logout_is_idempotent(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    bearer(api_client, issued.access)

    first = api_client.post(LOGOUT)
    second = api_client.post(LOGOUT)

    assert (first.status_code, second.status_code) == (204, 204)


def test_mobile_logout_works_with_an_expired_access_token(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    TokenPair.objects.filter(pk=issued.pair.pk).update(
        access_expires_at=timezone.now() - timedelta(hours=1)
    )

    response = bearer(api_client, issued.access).post(LOGOUT)

    assert response.status_code == 204
    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is not None


def test_logout_with_an_unknown_token_is_401(api_client: APIClient) -> None:
    response = bearer(api_client, "never-issued").post(LOGOUT)

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")


def test_logging_out_does_not_revoke_other_sessions_of_the_user(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a)
    first = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    second = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))

    bearer(api_client, first.access).post(LOGOUT)

    second.session.refresh_from_db()
    assert second.session.revoked_at is None


# --- logout: web --------------------------------------------------------------------------------


def web_session(user: User) -> APIClient:
    client = APIClient(enforce_csrf_checks=True)
    client.get(CSRF)
    client.post(
        LOGIN,
        {"username": user.username, "password": PASSWORD},
        format="json",
        headers={"X-CSRFToken": client.cookies["csrftoken"].value},
    )
    return client


def web_user(org: Organization, make_member: MemberFactory) -> User:
    user = UserFactory()
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    make_member(org, ["ovitrap.read"], user=user)
    return user


def test_web_logout_ends_the_session(org_a: Organization, make_member: MemberFactory) -> None:
    client = web_session(web_user(org_a, make_member))
    assert client.get(ME).status_code == 200

    response = client.post(LOGOUT, headers={"X-CSRFToken": client.cookies["csrftoken"].value})

    assert response.status_code == 204
    assert client.get(ME).status_code == 401


def test_web_logout_without_csrf_is_403_and_keeps_the_session(
    org_a: Organization, make_member: MemberFactory
) -> None:
    client = web_session(web_user(org_a, make_member))

    response = client.post(LOGOUT)

    assert response.status_code == 403
    assert client.get(ME).status_code == 200


def test_web_logout_twice_is_idempotent(org_a: Organization, make_member: MemberFactory) -> None:
    client = web_session(web_user(org_a, make_member))
    token = client.cookies["csrftoken"].value
    client.post(LOGOUT, headers={"X-CSRFToken": token})

    again = client.post(LOGOUT, headers={"X-CSRFToken": client.cookies["csrftoken"].value})

    assert again.status_code == 204


def test_logout_without_any_credentials_is_204(api_client: APIClient) -> None:
    assert api_client.post(LOGOUT).status_code == 204


def test_refresh_is_refused_and_the_session_revoked_when_the_membership_ended(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    user, membership = make_member(org_a, ["ovitrap.read"])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    membership.is_active = False
    membership.save(update_fields=["is_active"])

    response = refresh(api_client, issued)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    issued.session.refresh_from_db()
    assert issued.session.revoke_reason == RevokeReason.MEMBERSHIP_INACTIVE


def test_refreshing_a_second_sibling_after_the_first_was_used_revokes_the_session(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    first = refresh(api_client, issued).data
    second = refresh(api_client, issued).data  # a duplicate inside the window

    used = refresh(api_client, issued, token=first["refresh"])
    copy = refresh(api_client, issued, token=second["refresh"])

    assert used.status_code == 200
    assert (copy.status_code, copy.data["code"]) == (401, "session_revoked")
    assert (
        DeviceSession.objects.get(pk=issued.session.pk).revoke_reason == RevokeReason.REFRESH_REUSE
    )


def test_the_losing_siblings_access_token_revokes_the_session_through_the_api(
    api_client: APIClient,
    org_a: Organization,
    make_member: MemberFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    issued = session_for(make_member, org_a)
    winner = refresh(api_client, issued).data
    loser = refresh(api_client, issued).data  # a duplicate inside the window
    assert bearer(APIClient(), winner["access"]).get(ME).status_code == 200  # first use wins
    caplog.set_level(logging.DEBUG)

    response = bearer(APIClient(), loser["access"]).get(ME)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert session.revoke_reason == RevokeReason.REFRESH_REUSE  # committed before the answer
    assert "event=refresh_reuse_detected" in caplog.text
    assert bearer(APIClient(), winner["access"]).get(ME).data["code"] == "session_revoked"


def test_duplicates_past_the_sibling_cap_answer_429_and_keep_the_session(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    issued = session_for(make_member, org_a)
    for _ in range(MAX_SIBLING_PAIRS):
        assert refresh(api_client, issued).status_code == 200

    response = refresh(api_client, issued)

    assert (response.status_code, response.data["code"]) == (429, "throttled")
    assert int(response.headers["Retry-After"]) >= 1
    assert DeviceSession.objects.get(pk=issued.session.pk).revoked_at is None
