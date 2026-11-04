"""Token issuing, rotation with reuse detection, revocation and the final upload (services)."""

import threading
import uuid
from datetime import timedelta

import pytest
from django.db import connection
from django.test import override_settings
from django.utils import timezone

from accounts.exceptions import (
    DeviceOrganizationMismatchError,
    DeviceRevokedError,
    InvalidTokenError,
    SessionRevokedError,
    TokenExpiredError,
)
from accounts.models import Device, DeviceSession, RevokeReason
from accounts.services import (
    DeviceInfo,
    IssuedTokens,
    Revocation,
    consume_final_upload,
    revoke_device,
    revoke_session,
    revoke_user_sessions,
    rotate_refresh_token,
    start_device_session,
)
from accounts.tokens import hash_token
from organizations.models import Organization
from tests.factories import DeviceFactory, UserFactory

pytestmark = pytest.mark.django_db


def login(user, organization, device_id: uuid.UUID | None = None) -> IssuedTokens:
    return start_device_session(user, organization, DeviceInfo(device_id=device_id or uuid.uuid4()))


def age_rotation(session: DeviceSession, seconds: int) -> None:
    DeviceSession.objects.filter(pk=session.pk).update(
        rotated_at=timezone.now() - timedelta(seconds=seconds)
    )


# --- start_device_session --------------------------------------------------------------------


def test_start_session_stores_only_digests_of_the_tokens(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    row = DeviceSession.objects.values().get(pk=issued.session.pk)

    stored = {str(value) for value in row.values()}
    assert issued.access not in stored
    assert issued.refresh not in stored
    assert row["access_hash"] == hash_token(issued.access)
    assert row["refresh_hash"] == hash_token(issued.refresh)


def test_start_session_registers_the_device_in_the_organization(org_a: Organization) -> None:
    user = UserFactory()
    device_id = uuid.uuid4()

    start_device_session(
        user, org_a, DeviceInfo(device_id=device_id, label="Moto 1", app_version="1.2.3")
    )

    device = Device.objects.get(pk=device_id)
    assert device.organization == org_a
    assert (device.label, device.app_version, device.last_user) == ("Moto 1", "1.2.3", user)
    assert device.last_seen_at is not None


def test_a_second_login_updates_the_device_and_keeps_blank_fields(org_a: Organization) -> None:
    user, device_id = UserFactory(), uuid.uuid4()
    start_device_session(user, org_a, DeviceInfo(device_id=device_id, label="Moto 1"))

    other = UserFactory()
    start_device_session(other, org_a, DeviceInfo(device_id=device_id, app_version="2.0"))

    device = Device.objects.get(pk=device_id)
    assert (device.label, device.app_version, device.last_user) == ("Moto 1", "2.0", other)
    assert Device.objects.count() == 1


def test_device_registered_in_another_organization_is_refused(
    org_a: Organization, org_b: Organization
) -> None:
    device = DeviceFactory(organization=org_b)

    with pytest.raises(DeviceOrganizationMismatchError):
        login(UserFactory(), org_a, device.pk)
    assert not DeviceSession.objects.exists()


def test_revoked_device_cannot_log_in(org_a: Organization) -> None:
    device = DeviceFactory(organization=org_a, is_revoked=True, revoked_at=timezone.now())

    with pytest.raises(DeviceRevokedError):
        login(UserFactory(), org_a, device.pk)


def test_new_login_supersedes_earlier_sessions_of_the_same_user_on_the_device(
    org_a: Organization,
) -> None:
    user, device_id = UserFactory(), uuid.uuid4()
    first = login(user, org_a, device_id)

    second = login(user, org_a, device_id)

    first.session.refresh_from_db()
    assert first.session.revoke_reason == RevokeReason.LOGOUT
    assert second.session.revoked_at is None


def test_login_does_not_touch_sessions_of_other_users_on_the_device(org_a: Organization) -> None:
    device_id = uuid.uuid4()
    first = login(UserFactory(), org_a, device_id)

    login(UserFactory(), org_a, device_id)

    first.session.refresh_from_db()
    assert first.session.revoked_at is None


# --- rotation ---------------------------------------------------------------------------------


def test_rotation_issues_a_new_pair_and_keeps_the_old_refresh_as_previous(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)

    rotated = rotate_refresh_token(issued.refresh, issued.session.device_id)

    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert rotated.access != issued.access
    assert rotated.refresh != issued.refresh
    assert session.access_hash == hash_token(rotated.access)
    assert session.refresh_hash == hash_token(rotated.refresh)
    assert session.previous_refresh_hash == hash_token(issued.refresh)
    assert session.rotated_at is not None


def test_the_old_access_token_stops_working_after_rotation(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    rotate_refresh_token(issued.refresh, issued.session.device_id)

    assert not DeviceSession.objects.filter(access_hash=hash_token(issued.access)).exists()


def test_reusing_the_previous_refresh_outside_the_grace_window_revokes_the_session(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    rotate_refresh_token(issued.refresh, issued.session.device_id)
    age_rotation(issued.session, 120)

    with pytest.raises(SessionRevokedError):
        rotate_refresh_token(issued.refresh, issued.session.device_id)

    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert session.revoke_reason == RevokeReason.REFRESH_REUSE  # committed, not rolled back
    assert session.final_upload_deadline is None


def test_reusing_the_previous_refresh_inside_the_grace_window_rotates_again(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)
    first = rotate_refresh_token(issued.refresh, issued.session.device_id)

    retry = rotate_refresh_token(issued.refresh, issued.session.device_id)

    session = DeviceSession.objects.get(pk=issued.session.pk)
    assert session.revoked_at is None
    assert session.refresh_hash == hash_token(retry.refresh)
    assert session.previous_refresh_hash == hash_token(issued.refresh)
    assert retry.refresh != first.refresh


def test_the_grace_window_does_not_stretch_with_retries(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    rotate_refresh_token(issued.refresh, issued.session.device_id)
    rotated_at = DeviceSession.objects.get(pk=issued.session.pk).rotated_at

    rotate_refresh_token(issued.refresh, issued.session.device_id)

    assert DeviceSession.objects.get(pk=issued.session.pk).rotated_at == rotated_at


@override_settings(AUTH_REFRESH_REUSE_GRACE_SECONDS=0)
def test_grace_can_be_disabled(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    rotate_refresh_token(issued.refresh, issued.session.device_id)
    age_rotation(issued.session, 1)

    with pytest.raises(SessionRevokedError):
        rotate_refresh_token(issued.refresh, issued.session.device_id)


def test_unknown_refresh_token_is_invalid(org_a: Organization) -> None:
    with pytest.raises(InvalidTokenError):
        rotate_refresh_token("not-a-real-token", uuid.uuid4())


def test_refresh_with_another_device_id_is_invalid_and_leaves_the_session_alone(
    org_a: Organization,
) -> None:
    issued = login(UserFactory(), org_a)

    with pytest.raises(InvalidTokenError):
        rotate_refresh_token(issued.refresh, uuid.uuid4())

    issued.session.refresh_from_db()
    assert issued.session.revoked_at is None
    assert issued.session.refresh_hash == hash_token(issued.refresh)


def test_expired_refresh_token_is_refused(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    DeviceSession.objects.filter(pk=issued.session.pk).update(
        refresh_expires_at=timezone.now() - timedelta(seconds=1)
    )

    with pytest.raises(TokenExpiredError):
        rotate_refresh_token(issued.refresh, issued.session.device_id)


def test_rotation_slides_the_refresh_expiry(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    soon = timezone.now() + timedelta(days=1)
    DeviceSession.objects.filter(pk=issued.session.pk).update(refresh_expires_at=soon)

    rotate_refresh_token(issued.refresh, issued.session.device_id)

    assert DeviceSession.objects.get(pk=issued.session.pk).refresh_expires_at > soon


def test_revoked_session_cannot_refresh(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, Revocation(RevokeReason.LOGOUT))

    with pytest.raises(SessionRevokedError):
        rotate_refresh_token(issued.refresh, issued.session.device_id)


def test_refresh_of_an_inactive_user_revokes_the_session(org_a: Organization) -> None:
    user = UserFactory()
    issued = login(user, org_a)
    user.is_active = False
    user.save(update_fields=["is_active"])

    with pytest.raises(SessionRevokedError):
        rotate_refresh_token(issued.refresh, issued.session.device_id)

    issued.session.refresh_from_db()
    assert issued.session.revoke_reason == RevokeReason.USER_DEACTIVATED


def test_session_of_a_revoked_device_cannot_refresh(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    Device.objects.filter(pk=issued.session.device_id).update(
        is_revoked=True, revoked_at=timezone.now()
    )

    with pytest.raises(SessionRevokedError):
        rotate_refresh_token(issued.refresh, issued.session.device_id)


# --- revocation ---------------------------------------------------------------------------------


def test_revoking_a_users_sessions_is_limited_to_the_organization(
    org_a: Organization, org_b: Organization
) -> None:
    user, admin = UserFactory(), UserFactory()
    in_a = login(user, org_a)
    in_b = login(user, org_b)

    count = revoke_user_sessions(
        user, Revocation(RevokeReason.ADMIN_REVOKE, revoked_by=admin), organization=org_a
    )

    in_a.session.refresh_from_db()
    in_b.session.refresh_from_db()
    assert count == 1
    assert (in_a.session.revoke_reason, in_a.session.revoked_by) == ("admin_revoke", admin)
    assert in_b.session.revoked_at is None


def test_revoking_twice_keeps_the_first_reason(org_a: Organization) -> None:
    user = UserFactory()
    issued = login(user, org_a)
    revoke_user_sessions(user, Revocation(RevokeReason.ADMIN_REVOKE))

    again = revoke_user_sessions(user, Revocation(RevokeReason.LOGOUT))

    issued.session.refresh_from_db()
    assert again == 0
    assert issued.session.revoke_reason == RevokeReason.ADMIN_REVOKE


def test_revoke_device_revokes_the_device_and_every_session_on_it(org_a: Organization) -> None:
    admin, device_id = UserFactory(), uuid.uuid4()
    first = login(UserFactory(), org_a, device_id)
    second = login(UserFactory(), org_a, device_id)
    elsewhere = login(UserFactory(), org_a)

    device = revoke_device(Device.objects.get(pk=device_id), admin)

    first.session.refresh_from_db()
    second.session.refresh_from_db()
    elsewhere.session.refresh_from_db()
    assert device.is_revoked
    assert (device.revoked_by, device.revoked_at is not None) == (admin, True)
    assert first.session.revoke_reason == second.session.revoke_reason == "device_revoked"
    assert elsewhere.session.revoked_at is None


def test_revoke_device_is_idempotent(org_a: Organization) -> None:
    admin, device = UserFactory(), DeviceFactory(organization=org_a)
    first = revoke_device(device, admin)

    second = revoke_device(device, UserFactory())

    assert second.revoked_at == first.revoked_at
    assert second.revoked_by == admin


# --- final upload -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("reason", "has_deadline"),
    [
        (RevokeReason.ADMIN_REVOKE, True),
        (RevokeReason.DEVICE_REVOKED, True),
        (RevokeReason.REFRESH_REUSE, False),
        (RevokeReason.PASSWORD_CHANGED, False),
        (RevokeReason.USER_DEACTIVATED, False),
        (RevokeReason.LOGOUT, False),
    ],
)
def test_only_admin_and_device_revocations_leave_a_final_upload(
    org_a: Organization, reason: RevokeReason, has_deadline: bool
) -> None:
    issued = login(UserFactory(), org_a)

    revoke_session(issued.session, Revocation(reason))

    issued.session.refresh_from_db()
    assert (issued.session.final_upload_deadline is not None) is has_deadline


@override_settings(AUTH_REVOKED_FINAL_UPLOAD_HOURS=0)
def test_final_upload_can_be_disabled(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE))

    issued.session.refresh_from_db()
    assert issued.session.final_upload_deadline is None


def test_final_upload_deadline_follows_the_setting(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE))

    issued.session.refresh_from_db()
    delta = issued.session.final_upload_deadline - issued.session.revoked_at
    assert delta == timedelta(hours=72)


def test_final_upload_is_single_use(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE))

    consume_final_upload(issued.session)

    with pytest.raises(SessionRevokedError):
        consume_final_upload(issued.session)


def test_final_upload_is_refused_after_the_deadline(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE))
    DeviceSession.objects.filter(pk=issued.session.pk).update(
        final_upload_deadline=timezone.now() - timedelta(seconds=1)
    )

    with pytest.raises(SessionRevokedError):
        consume_final_upload(issued.session)


def test_final_upload_is_refused_for_a_session_that_is_not_revoked(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)

    with pytest.raises(SessionRevokedError):
        consume_final_upload(issued.session)


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_final_uploads_only_one_wins(org_a: Organization) -> None:
    issued = login(UserFactory(), org_a)
    revoke_session(issued.session, Revocation(RevokeReason.ADMIN_REVOKE))
    outcomes: list[str] = []
    barrier = threading.Barrier(2)

    def attempt() -> None:
        try:
            barrier.wait(timeout=10)
            consume_final_upload(issued.session)
            outcomes.append("ok")
        except SessionRevokedError:
            outcomes.append("refused")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert sorted(outcomes) == ["ok", "refused"]
