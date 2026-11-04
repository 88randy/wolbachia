"""Password hash upgrade under the user lock, lock order, final upload transaction details."""

import threading
import uuid
from collections.abc import Callable
from datetime import timedelta
from functools import partial
from typing import Any

import pytest
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.tokens import default_token_generator
from django.db import connection
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts import services
from accounts.exceptions import InvalidCredentialsError, SessionRevokedError
from accounts.models import DeviceSession, RevokeReason, TokenPair, User
from accounts.revocation import Revocation, consume_final_upload, revoke_session
from accounts.services import (
    DeviceInfo,
    authenticate_user,
    reset_password,
    start_device_session,
    verify_credentials,
)
from accounts.token_pairs import IssuedTokens, rotate_refresh_token
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db

OLD_PASSWORD = "an old and long passphrase"  # noqa: S105
NEW_PASSWORD = "a brand new passphrase 42"  # noqa: S105
HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
FINAL_UPLOAD = "/api/v1/final-upload/"
LOGOUT = "/api/v1/auth/logout/"


def user_with_old_hash(**kwargs: object) -> User:
    """A user whose password is stored with MD5, which the PBKDF2-first setting upgrades."""
    user = UserFactory(**kwargs)
    User.objects.filter(pk=user.pk).update(password=make_password(OLD_PASSWORD, hasher="md5"))
    return User.objects.get(pk=user.pk)


# --- hash upgrade ------------------------------------------------------------------------------


@override_settings(PASSWORD_HASHERS=HASHERS)
def test_an_outdated_hash_is_upgraded_on_a_good_login() -> None:
    user = user_with_old_hash()
    assert user.password.startswith("md5$")

    verified = verify_credentials(user.username, OLD_PASSWORD)

    assert verified is not None
    stored = User.objects.get(pk=user.pk).password
    assert stored.startswith("pbkdf2_sha256$")
    assert verified.password == stored  # the caller sees the hash that was saved
    assert check_password(OLD_PASSWORD, stored)


@override_settings(PASSWORD_HASHERS=HASHERS)
def test_a_wrong_password_never_upgrades_anything() -> None:
    user = user_with_old_hash()

    assert verify_credentials(user.username, "wrong") is None

    assert User.objects.get(pk=user.pk).password == user.password


@override_settings(PASSWORD_HASHERS=HASHERS)
def test_a_reset_between_verification_and_upgrade_is_not_undone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """verify old hash -> reset commits -> the upgrade save must not restore the old password."""
    user = user_with_old_hash()
    token = default_token_generator.make_token(user)
    real_check = services.check_password

    def check_then_reset(password: str, encoded: str, setter: Callable[[str], None]) -> bool:
        verified = real_check(password, encoded, setter=setter)
        reset_password(user, token, NEW_PASSWORD)  # commits while the login is half done
        return verified

    monkeypatch.setattr(services, "check_password", check_then_reset)

    assert verify_credentials(user.username, OLD_PASSWORD) is None

    stored = User.objects.get(pk=user.pk).password
    assert check_password(NEW_PASSWORD, stored)
    assert not check_password(OLD_PASSWORD, stored)


@override_settings(PASSWORD_HASHERS=HASHERS)
def test_a_login_that_lost_the_race_to_a_reset_is_a_generic_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = user_with_old_hash()
    token = default_token_generator.make_token(user)
    real_check = services.check_password

    def check_then_reset(password: str, encoded: str, setter: Callable[[str], None]) -> bool:
        verified = real_check(password, encoded, setter=setter)
        reset_password(user, token, NEW_PASSWORD)
        return verified

    monkeypatch.setattr(services, "check_password", check_then_reset)

    with pytest.raises(InvalidCredentialsError):
        authenticate_user(user.username, OLD_PASSWORD, None)


def test_inactive_and_unknown_users_do_not_verify() -> None:
    user = UserFactory(is_active=False)
    user.set_password(OLD_PASSWORD)
    user.save(update_fields=["password"])

    assert verify_credentials(user.username, OLD_PASSWORD) is None
    assert verify_credentials("nobody-at-all", OLD_PASSWORD) is None


# --- lock order: no deadlocks -----------------------------------------------------------------


def run_in_threads(*jobs: Callable[[], None]) -> list[str]:
    errors: list[str] = []
    barrier = threading.Barrier(len(jobs))

    def wrap(job: Callable[[], None]) -> Callable[[], None]:
        def runner() -> None:
            try:
                barrier.wait(timeout=10)
                job()
            except Exception as error:  # noqa: BLE001 - the test reports everything it did not expect
                errors.append(type(error).__name__)
            finally:
                connection.close()

        return runner

    threads = [threading.Thread(target=wrap(job)) for job in jobs]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    assert not any(thread.is_alive() for thread in threads), "a thread is stuck: deadlock?"
    return errors


@pytest.mark.django_db(transaction=True)
def test_refresh_and_reset_for_the_same_user_never_deadlock(org_a: Organization) -> None:
    unexpected: list[str] = []
    for _ in range(12):
        user = UserFactory()
        user.set_password(OLD_PASSWORD)
        user.save(update_fields=["password"])
        MembershipFactory(user=user, organization=org_a)
        issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
        token = default_token_generator.make_token(User.objects.get(pk=user.pk))
        errors = run_in_threads(
            partial(rotate_refresh_token, issued.refresh, issued.session.device_id),
            partial(reset_password, user, token, NEW_PASSWORD),
        )
        unexpected += [name for name in errors if name != SessionRevokedError.__name__]
        assert DeviceSession.objects.filter(user=user, revoked_at__isnull=True).count() == 0

    assert unexpected == []  # no OperationalError / deadlock


@pytest.mark.django_db(transaction=True)
def test_login_and_reset_for_the_same_user_never_deadlock_nor_leave_a_live_session(
    org_a: Organization,
) -> None:
    unexpected: list[str] = []
    for _ in range(12):
        user = UserFactory()
        user.set_password(OLD_PASSWORD)
        user.save(update_fields=["password"])
        MembershipFactory(user=user, organization=org_a)
        authenticated = User.objects.get(pk=user.pk)  # what the login verified
        token = default_token_generator.make_token(authenticated)
        errors = run_in_threads(
            partial(start_device_session, authenticated, org_a, DeviceInfo(device_id=uuid.uuid4())),
            partial(reset_password, user, token, NEW_PASSWORD),
        )
        unexpected += [name for name in errors if name != InvalidCredentialsError.__name__]
        live = DeviceSession.objects.filter(user=user, revoked_at__isnull=True)
        assert live.count() == 0  # a session opened with the old password cannot survive

    assert unexpected == []


@pytest.mark.django_db(transaction=True)
def test_final_upload_and_reset_for_the_same_user_never_deadlock(org_a: Organization) -> None:
    unexpected: list[str] = []
    for _ in range(12):
        user = UserFactory()
        user.set_password(OLD_PASSWORD)
        user.save(update_fields=["password"])
        MembershipFactory(user=user, organization=org_a)
        issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
        revoke_session(
            issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
        )
        token = default_token_generator.make_token(User.objects.get(pk=user.pk))
        errors = run_in_threads(
            partial(consume_final_upload, issued.session),
            partial(reset_password, user, token, NEW_PASSWORD),
        )
        unexpected += [name for name in errors if name != SessionRevokedError.__name__]

    assert unexpected == []


# --- final upload: methods and bookkeeping ----------------------------------------------------


def revoked_phone(
    make_member: MemberFactory, organization: Organization
) -> tuple[IssuedTokens, APIClient]:
    user, _ = make_member(organization, [])
    issued = start_device_session(user, organization, DeviceInfo(device_id=uuid.uuid4()))
    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True))
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    return issued, client


@pytest.mark.parametrize("method", ["options", "get", "head"])
def test_only_the_upload_method_spends_the_final_upload(
    org_a: Organization, make_member: MemberFactory, method: str
) -> None:
    issued, client = revoked_phone(make_member, org_a)

    refused = getattr(client, method)(FINAL_UPLOAD)
    uploaded = client.post(FINAL_UPLOAD)

    assert refused.status_code == 401
    assert uploaded.status_code == 200
    assert uploaded.headers["X-Session-Revoked"] == "true"
    issued.session.refresh_from_db()
    assert issued.session.final_upload_used_at is not None


def test_a_revoked_session_gets_no_telemetry_writes(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued, client = revoked_phone(make_member, org_a)
    before = TokenPair.objects.get(pk=issued.pair.pk).access_used_at

    client.post(FINAL_UPLOAD)

    assert TokenPair.objects.get(pk=issued.pair.pk).access_used_at == before


@pytest.mark.django_db(transaction=True)
def test_authentication_bookkeeping_runs_outside_the_final_upload_transaction(
    org_a: Organization, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    user, _ = make_member(org_a, [])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    seen: list[bool] = []

    def record(original: Callable[..., Any]) -> Callable[..., Any]:
        def wrapper(*arguments: Any, **options: Any) -> Any:  # noqa: ANN401
            seen.append(connection.in_atomic_block)
            return original(*arguments, **options)

        return wrapper

    from accounts import authentication

    monkeypatch.setattr(authentication, "touch_session", record(authentication.touch_session))
    monkeypatch.setattr(authentication, "claim_access_use", record(authentication.claim_access_use))
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")

    assert client.post(FINAL_UPLOAD).status_code == 200

    assert seen == [False, False]


# --- logout and final upload need the current pair ---------------------------------------------


def age_consumption(pair: TokenPair, seconds: int) -> None:
    moment = timezone.now() - timedelta(seconds=seconds)
    TokenPair.objects.filter(pk=pair.pk).update(consumed_at=moment, superseded_at=moment)


def test_logout_refuses_an_access_token_replaced_beyond_the_grace_window(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, [])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    rotate_refresh_token(issued.refresh, issued.session.device_id)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    age_consumption(issued.pair, 120)

    response = client.post(LOGOUT)

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")


def test_logout_refuses_a_retired_sibling_pair(
    org_a: Organization, make_member: MemberFactory
) -> None:
    from accounts.token_pairs import claim_access_use

    user, _ = make_member(org_a, [])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    winner = rotate_refresh_token(issued.refresh, issued.session.device_id)
    loser = rotate_refresh_token(issued.refresh, issued.session.device_id)
    assert (
        claim_access_use(TokenPair.objects.select_related("parent").get(pk=winner.pair.pk)) is None
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {loser.access}")

    response = client.post(LOGOUT)

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")


def test_the_final_upload_needs_the_current_pair(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, [])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    rotate_refresh_token(issued.refresh, issued.session.device_id)
    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True))
    age_consumption(issued.pair, 120)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")  # the replaced pair

    response = client.post(FINAL_UPLOAD)

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")
