"""Password reset: request (always 202), email text per locale, confirm (token, validators)."""

import logging
import smtplib
import threading
import uuid
from unittest import mock

import pytest
from django.core import mail
from django.db import connection
from django.test import override_settings
from kombu.exceptions import OperationalError
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.exceptions import InvalidCredentialsError, InvalidResetTokenError
from accounts.models import DeviceSession, RevokeReason, User
from accounts.reset_emails import build_reset_url, send_password_reset_emails
from accounts.revocation import Revocation, revoke_session
from accounts.services import DeviceInfo, reset_password, start_device_session
from accounts.tasks import send_password_reset_email
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import MembershipFactory, OrganizationFactory, UserFactory

pytestmark = pytest.mark.django_db

REQUEST = "/api/v1/auth/password-reset/"
CONFIRM = "/api/v1/auth/password-reset/confirm/"
LOGIN = "/api/v1/auth/login/"
CSRF = "/api/v1/auth/csrf/"
ME = "/api/v1/me/"
OLD_PASSWORD = "an old and long passphrase"  # noqa: S105
NEW_PASSWORD = "a brand new passphrase 42"  # noqa: S105
DELAY = "accounts.views.send_password_reset_email.apply_async"


def account(email: str = "ana@example.test", **kwargs: object) -> User:
    user = UserFactory(email=email, **kwargs)
    user.set_password(OLD_PASSWORD)
    user.save(update_fields=["password"])
    return user


def link_parts(user: User) -> tuple[str, str]:
    """`uid` and `token` of a fresh reset link for the user."""
    _, uid, token = build_reset_url(user).rsplit("/", 2)
    return uid, token


def confirm(client: APIClient, user: User, password: str = NEW_PASSWORD, **override: str):
    uid, token = link_parts(user)
    body = {"uid": uid, "token": token, "new_password": password, **override}
    return client.post(CONFIRM, body, format="json")


# --- request ------------------------------------------------------------------------------------


def test_request_is_202_with_an_empty_body_whether_or_not_the_account_exists(
    api_client: APIClient,
) -> None:
    account("real@example.test")
    inactive = account("off@example.test", is_active=False)

    with mock.patch(DELAY) as delay:
        responses = [
            api_client.post(REQUEST, {"email": address}, format="json")
            for address in ("real@example.test", "ghost@example.test", inactive.email)
        ]

    assert {r.status_code for r in responses} == {202}
    assert {r.content for r in responses} == {b""}
    assert delay.call_count == 3  # the view always enqueues; the worker decides


def test_request_enqueues_the_address_and_does_no_database_work(
    api_client: APIClient, django_assert_num_queries
) -> None:
    account("real@example.test")

    with mock.patch(DELAY) as delay, django_assert_num_queries(0):
        api_client.post(REQUEST, {"email": "real@example.test"}, format="json")
        api_client.post(REQUEST, {"email": "ghost@example.test"}, format="json")

    assert [call.kwargs["args"] for call in delay.call_args_list] == [
        ["real@example.test"],
        ["ghost@example.test"],
    ]
    # Celery shows `argsrepr` in worker logs and monitoring instead of the address.
    assert {call.kwargs["argsrepr"] for call in delay.call_args_list} == {"('<redacted>',)"}


def test_request_stays_202_when_the_broker_is_down(api_client: APIClient) -> None:
    with mock.patch(DELAY, side_effect=OperationalError("broker down")):
        response = api_client.post(REQUEST, {"email": "real@example.test"}, format="json")

    assert response.status_code == 202


@pytest.mark.parametrize("payload", [{}, {"email": ""}, {"email": "not-an-email"}, {"email": 5}])
def test_request_validates_the_email_shape(
    api_client: APIClient, payload: dict[str, object]
) -> None:
    with mock.patch(DELAY) as delay:
        response = api_client.post(REQUEST, payload, format="json")

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
    delay.assert_not_called()


def test_request_is_rate_limited_per_address(
    api_client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "password_reset", "2/hour")

    with mock.patch(DELAY):
        codes = [
            api_client.post(REQUEST, {"email": f"u{i}@example.test"}, format="json").status_code
            for i in range(3)
        ]

    assert codes == [202, 202, 429]


def test_request_log_has_the_ip_but_not_the_email(
    api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)

    with mock.patch(DELAY):
        api_client.post(REQUEST, {"email": "private.person@example.test"}, format="json")

    assert "event=password_reset_requested" in caplog.text
    assert "private.person" not in caplog.text


# --- the email ----------------------------------------------------------------------------------


def test_the_worker_emails_a_working_link_to_an_active_user() -> None:
    user = account("ana@example.test")

    sent = send_password_reset_email("  Ana@Example.test ")

    assert sent is None  # the task returns nothing
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["ana@example.test"]
    assert user.username in message.body
    url = next(line for line in message.body.splitlines() if line.startswith("http"))
    _, uid, token = url.rsplit("/", 2)
    assert url.startswith("http://localhost:5173/reset-password/")
    assert confirm(APIClient(), user, uid=uid, token=token).status_code == 204


def test_no_email_for_unknown_or_inactive_addresses() -> None:
    account("off@example.test", is_active=False)

    assert send_password_reset_emails("ghost@example.test") == 0
    assert send_password_reset_emails("off@example.test") == 0
    assert mail.outbox == []


def test_every_active_user_with_the_address_gets_their_own_link() -> None:
    first, second = account("shared@example.test"), account("SHARED@example.test")

    assert send_password_reset_emails("shared@example.test") == 2

    bodies = " ".join(message.body for message in mail.outbox)
    assert first.username in bodies
    assert second.username in bodies


def test_the_email_is_in_spanish_by_default(org_a: Organization) -> None:
    user = account("ana@example.test")
    MembershipFactory(user=user, organization=org_a)

    send_password_reset_emails(user.email)

    message = mail.outbox[0]
    assert message.subject == "Restablece tu contraseña de Wolbachia"
    assert "Hola" in message.body
    assert "solo se puede usar una vez" in message.body


def test_the_email_is_in_english_when_the_organization_works_in_english() -> None:
    user = account("ana@example.test")
    organization = OrganizationFactory(languages=["en"])
    MembershipFactory(user=user, organization=organization)

    send_password_reset_emails(user.email)

    message = mail.outbox[0]
    assert message.subject == "Reset your Wolbachia password"
    assert "Hello" in message.body
    assert "can be used only once" in message.body


def test_a_user_without_membership_gets_the_default_language() -> None:
    account("ana@example.test")

    send_password_reset_emails("ana@example.test")

    assert mail.outbox[0].subject.startswith("Restablece")


@override_settings(WEB_BASE_URL="https://app.example.test", WEB_PASSWORD_RESET_PATH="reset/")
def test_the_link_is_built_from_the_web_settings() -> None:
    user = account()

    assert build_reset_url(user).startswith("https://app.example.test/reset/")


def test_users_created_without_a_password_can_set_their_first_one() -> None:
    user = UserFactory(email="new@example.test")
    user.set_unusable_password()
    user.save(update_fields=["password"])

    assert send_password_reset_emails("new@example.test") == 1
    assert confirm(APIClient(), user).status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)


def test_emails_per_address_are_capped_per_hour() -> None:
    account("ana@example.test")

    sent = [send_password_reset_emails("ana@example.test") for _ in range(5)]

    assert sent == [1, 1, 1, 0, 0]
    assert len(mail.outbox) == 3


def test_a_delivery_failure_is_logged_without_the_address_and_does_not_raise(
    caplog: pytest.LogCaptureFixture,
) -> None:
    account("ana@example.test")
    caplog.set_level(logging.DEBUG)

    with mock.patch(
        "accounts.reset_emails.send_mail",
        side_effect=smtplib.SMTPRecipientsRefused({"ana@example.test": (550, b"no")}),
    ):
        sent = send_password_reset_emails("ana@example.test")

    assert sent == 0
    assert "event=password_reset_email_failed" in caplog.text
    assert "ana@example.test" not in caplog.text


# --- confirm ------------------------------------------------------------------------------------


def test_confirm_sets_the_new_password(api_client: APIClient) -> None:
    user = account()

    response = confirm(api_client, user)

    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    assert not user.check_password(OLD_PASSWORD)


def test_a_link_works_only_once(api_client: APIClient) -> None:
    user = account()
    uid, token = link_parts(user)
    body = {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
    api_client.post(CONFIRM, body, format="json")

    again = api_client.post(CONFIRM, {**body, "new_password": "another good one 77"}, format="json")

    assert (again.status_code, again.data["code"]) == (400, "invalid_reset_token")
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)


def test_confirm_revokes_device_sessions_in_every_organization(
    api_client: APIClient, org_a: Organization, org_b: Organization, make_member: MemberFactory
) -> None:
    user = account()
    in_a = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    in_b = start_device_session(user, org_b, DeviceInfo(device_id=uuid.uuid4()))
    bystander = start_device_session(
        account("b@example.test"), org_a, DeviceInfo(device_id=uuid.uuid4())
    )

    confirm(api_client, user)

    for issued in (in_a, in_b):
        issued.session.refresh_from_db()
        assert issued.session.revoke_reason == RevokeReason.PASSWORD_CHANGED
        assert issued.session.final_upload_deadline is None
    bystander.session.refresh_from_db()
    assert bystander.session.revoked_at is None


def test_confirm_ends_the_web_session(org_a: Organization, make_member: MemberFactory) -> None:
    user = account()
    make_member(org_a, [], user=user)
    web = APIClient(enforce_csrf_checks=True)
    web.get(CSRF)
    web.post(
        LOGIN,
        {"username": user.username, "password": OLD_PASSWORD},
        format="json",
        headers={"X-CSRFToken": web.cookies["csrftoken"].value},
    )
    assert web.get(ME).status_code == 200
    user.refresh_from_db()  # the login stored `last_login`, which is part of the reset token

    assert confirm(APIClient(), user).status_code == 204

    assert web.get(ME).status_code == 401


@pytest.mark.parametrize("field", ["uid", "token"])
def test_a_tampered_link_is_the_same_generic_400(api_client: APIClient, field: str) -> None:
    user = account()

    response = confirm(api_client, user, **{field: "AAAA"})

    assert (response.status_code, response.data["code"]) == (400, "invalid_reset_token")
    user.refresh_from_db()
    assert user.check_password(OLD_PASSWORD)


def test_a_token_of_another_user_does_not_work(api_client: APIClient) -> None:
    victim, attacker = account("victim@example.test"), account("attacker@example.test")
    victim_uid, _ = link_parts(victim)
    _, attacker_token = link_parts(attacker)

    response = api_client.post(
        CONFIRM,
        {"uid": victim_uid, "token": attacker_token, "new_password": NEW_PASSWORD},
        format="json",
    )

    assert response.data["code"] == "invalid_reset_token"


@pytest.mark.parametrize("uid", ["!!!", "", "bm90LWEtdXVpZA", "zzzz zzzz"])
def test_garbage_uids_are_a_400_not_a_server_error(api_client: APIClient, uid: str) -> None:
    user = account()
    _, token = link_parts(user)

    response = api_client.post(
        CONFIRM, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}, format="json"
    )

    assert response.status_code == 400


def test_an_inactive_user_cannot_reset(api_client: APIClient) -> None:
    user = account(is_active=False)

    response = confirm(api_client, user)

    assert response.data["code"] == "invalid_reset_token"


@override_settings(PASSWORD_RESET_TIMEOUT=-1)
def test_an_expired_link_is_refused(api_client: APIClient) -> None:
    user = account()

    response = confirm(api_client, user)

    assert response.data["code"] == "invalid_reset_token"


@pytest.mark.parametrize(
    ("password", "code"),
    [
        ("short1", "password_too_short"),
        ("password123456", "password_too_common"),
        ("83920174659203", "password_entirely_numeric"),
        ("ana.lopez.example", "password_too_similar"),
    ],
)
def test_the_password_validators_apply_and_keep_the_link_alive(
    api_client: APIClient, password: str, code: str
) -> None:
    user = account("ana.lopez.example@example.test", username="ana.lopez.example")
    uid, token = link_parts(user)

    bad = api_client.post(
        CONFIRM, {"uid": uid, "token": token, "new_password": password}, format="json"
    )
    good = api_client.post(
        CONFIRM, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}, format="json"
    )

    assert (bad.status_code, bad.data["code"]) == (400, "validation_error")
    assert code in {error["code"] for error in bad.data["fields"]["new_password"]}
    assert good.status_code == 204


def test_a_bad_link_does_not_reveal_the_password_rules(api_client: APIClient) -> None:
    response = api_client.post(
        CONFIRM, {"uid": "AAAA", "token": "x", "new_password": "1"}, format="json"
    )

    assert response.data["code"] == "invalid_reset_token"


@pytest.mark.parametrize("missing", ["uid", "token", "new_password"])
def test_confirm_requires_every_field(api_client: APIClient, missing: str) -> None:
    body = {"uid": "AAAA", "token": "x", "new_password": NEW_PASSWORD}
    del body[missing]

    response = api_client.post(CONFIRM, body, format="json")

    assert (response.status_code, response.data["code"]) == (400, "validation_error")


def test_a_spent_token_is_refused_by_the_recheck_inside_the_lock() -> None:
    user = account()
    _, token = link_parts(user)
    reset_password(user, token, NEW_PASSWORD)

    with pytest.raises(InvalidResetTokenError):
        reset_password(user, token, "yet another passphrase 9")


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_resets_with_the_same_token_only_one_wins() -> None:
    user = account()
    _, token = link_parts(user)
    outcomes: list[str] = []
    barrier = threading.Barrier(2)

    def attempt(password: str) -> None:
        try:
            barrier.wait(timeout=10)
            reset_password(user, token, password)
            outcomes.append("ok")
        except InvalidResetTokenError:
            outcomes.append("refused")
        finally:
            connection.close()

    threads = [
        threading.Thread(target=attempt, args=(NEW_PASSWORD,)),
        threading.Thread(target=attempt, args=("a second good passphrase 7",)),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert sorted(outcomes) == ["ok", "refused"]


def test_confirm_withdraws_pending_final_uploads_of_already_revoked_sessions(
    api_client: APIClient, org_a: Organization
) -> None:
    user = account()
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True))
    issued.session.refresh_from_db()
    assert issued.session.final_upload_deadline is not None

    confirm(api_client, user)

    issued.session.refresh_from_db()
    assert issued.session.final_upload_deadline is None
    assert issued.session.revoke_reason == RevokeReason.ADMIN_REVOKE  # the reason is kept


def test_a_login_that_authenticated_before_the_reset_gets_no_session(
    api_client: APIClient, org_a: Organization
) -> None:
    user = account()
    authenticated = User.objects.get(pk=user.pk)  # what the login verified: the old hash
    confirm(api_client, user)

    with pytest.raises(InvalidCredentialsError):
        start_device_session(authenticated, org_a, DeviceInfo(device_id=uuid.uuid4()))
    assert not DeviceSession.objects.exists()


@override_settings(AUTH_PASSWORD_RESET_EMAILS_PER_ADDRESS_PER_HOUR=1)
def test_the_per_address_email_limit_is_configurable() -> None:
    account("ana@example.test")

    sent = [send_password_reset_emails("ana@example.test") for _ in range(3)]

    assert sent == [1, 0, 0]


def test_confirm_is_rate_limited(api_client: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "password_reset_confirm", "2/hour")
    body = {"uid": "AAAA", "token": "x", "new_password": NEW_PASSWORD}

    codes = [api_client.post(CONFIRM, body, format="json").status_code for _ in range(3)]

    assert codes == [400, 400, 429]


def test_confirm_logs_neither_passwords_nor_tokens_nor_emails(
    api_client: APIClient, caplog: pytest.LogCaptureFixture
) -> None:
    user = account("log.check@example.test")
    uid, token = link_parts(user)
    caplog.set_level(logging.DEBUG)

    api_client.post(
        CONFIRM, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}, format="json"
    )

    assert "event=password_reset_confirmed" in caplog.text
    for secret in (NEW_PASSWORD, OLD_PASSWORD, token, uid, user.email):
        assert secret not in caplog.text


def test_confirm_does_not_touch_sessions_of_other_devices_of_other_users(
    api_client: APIClient, org_a: Organization
) -> None:
    user, other = account(), account("other@example.test")
    keep = start_device_session(other, org_a, DeviceInfo(device_id=uuid.uuid4()))

    confirm(api_client, user)

    assert not DeviceSession.objects.filter(pk=keep.session.pk, revoked_at__isnull=False).exists()
