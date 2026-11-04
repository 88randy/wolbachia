"""A revoked phone may make one last upload, only when an admin allows it, on opt-in views."""

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import DeviceSession, RevokeReason, TokenPair
from accounts.revocation import Revocation, cancel_final_uploads, revoke_device, revoke_session
from accounts.services import DeviceInfo, start_device_session
from accounts.token_pairs import IssuedTokens
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import UserFactory
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db

FINAL_UPLOAD = "/api/v1/final-upload/"
ME = "/api/v1/me/"
REFRESH = "/api/v1/auth/refresh/"


def revoked_session(
    make_member: MemberFactory,
    organization: Organization,
    reason: RevokeReason,
    allow: bool = True,
) -> IssuedTokens:
    user, _ = make_member(organization, ["ovitrap.read"])
    issued = start_device_session(user, organization, DeviceInfo(device_id=uuid.uuid4()))
    revoke_session(issued.session, Revocation(reason, allow_final_upload=allow))
    return issued


def phone(issued: IssuedTokens) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    return client


@pytest.mark.parametrize("reason", [RevokeReason.ADMIN_REVOKE, RevokeReason.DEVICE_REVOKED])
def test_the_final_upload_works_once_and_says_the_session_is_revoked(
    org_a: Organization, make_member: MemberFactory, reason: RevokeReason
) -> None:
    client = phone(revoked_session(make_member, org_a, reason))

    first = client.post(FINAL_UPLOAD)
    second = client.post(FINAL_UPLOAD)

    assert (first.status_code, first.headers["X-Session-Revoked"]) == (200, "true")
    assert first.data["in_review"] is True  # the view knows to mark its events in_review
    assert (second.status_code, second.data["code"]) == (401, "session_revoked")
    assert Widget.objects.filter(name="final-upload").count() == 1


def test_without_the_explicit_flag_there_is_no_final_upload(
    org_a: Organization, make_member: MemberFactory
) -> None:
    client = phone(revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE, allow=False))

    response = client.post(FINAL_UPLOAD)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    assert not Widget.objects.exists()


def test_it_also_works_after_a_remote_device_revoke_that_allows_it(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, [])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    revoke_device(issued.session.device, UserFactory(), allow_final_upload=True)

    response = phone(issued).post(FINAL_UPLOAD)

    assert response.status_code == 200
    assert response.headers["X-Session-Revoked"] == "true"


def test_only_views_that_opt_in_accept_a_revoked_session(
    org_a: Organization, make_member: MemberFactory
) -> None:
    client = phone(revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE))

    response = client.get(ME)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    assert client.post(FINAL_UPLOAD).status_code == 200  # the unused upload is still there


@pytest.mark.parametrize(
    "reason",
    [
        RevokeReason.REFRESH_REUSE,
        RevokeReason.PASSWORD_CHANGED,
        RevokeReason.LOGOUT,
        RevokeReason.USER_DEACTIVATED,
        RevokeReason.SUPERSEDED,
        RevokeReason.MEMBERSHIP_INACTIVE,
    ],
)
def test_other_revocation_reasons_get_no_final_upload(
    org_a: Organization, make_member: MemberFactory, reason: RevokeReason
) -> None:
    client = phone(revoked_session(make_member, org_a, reason))

    response = client.post(FINAL_UPLOAD)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_the_upload_is_refused_after_the_deadline(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued = revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE)
    DeviceSession.objects.filter(pk=issued.session.pk).update(
        final_upload_deadline=timezone.now() - timedelta(seconds=1)
    )

    response = phone(issued).post(FINAL_UPLOAD)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_an_expired_access_token_does_not_block_the_final_upload(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued = revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE)
    TokenPair.objects.filter(pk=issued.pair.pk).update(
        access_expires_at=timezone.now() - timedelta(hours=5)
    )

    response = phone(issued).post(FINAL_UPLOAD)

    assert response.status_code == 200


def test_a_deactivated_user_gets_no_final_upload(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued = revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE)
    issued.session.user.is_active = False
    issued.session.user.save(update_fields=["is_active"])

    response = phone(issued).post(FINAL_UPLOAD)

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_a_password_change_cancels_pending_final_uploads_of_revoked_sessions(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued = revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE)
    issued.session.refresh_from_db()
    assert issued.session.final_upload_deadline is not None

    cancel_final_uploads(issued.session.user)

    response = phone(issued).post(FINAL_UPLOAD)
    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_a_revoked_session_still_cannot_refresh(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued = revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE)

    response = APIClient().post(
        REFRESH,
        {"refresh": issued.refresh, "device_id": str(issued.session.device_id)},
        format="json",
    )

    assert response.data["code"] == "session_revoked"


def test_an_active_session_on_the_opt_in_view_spends_nothing(
    org_a: Organization, make_member: MemberFactory
) -> None:
    user, _ = make_member(org_a, [])
    issued = start_device_session(user, org_a, DeviceInfo(device_id=uuid.uuid4()))
    client = phone(issued)

    first, second = client.post(FINAL_UPLOAD), client.post(FINAL_UPLOAD)

    assert (first.status_code, second.status_code) == (200, 200)
    assert "X-Session-Revoked" not in first.headers
    assert first.data["in_review"] is False
    issued.session.refresh_from_db()
    assert issued.session.final_upload_used_at is None


def test_a_failed_final_upload_does_not_spend_it_and_leaves_no_writes(
    org_a: Organization, make_member: MemberFactory
) -> None:
    issued = revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE)
    client = phone(issued)

    failed = client.post(f"{FINAL_UPLOAD}?fail=1")
    retried = client.post(FINAL_UPLOAD)

    assert failed.status_code == 409
    assert "X-Session-Revoked" not in failed.headers
    assert retried.status_code == 200  # the failed attempt rolled back, the phone may retry
    assert Widget.objects.filter(name="final-upload").count() == 1


def test_the_final_upload_is_enforced_by_the_mixin_not_by_the_view(
    org_a: Organization, make_member: MemberFactory
) -> None:
    """The test view never calls `consume_final_upload`; a second upload is refused anyway."""
    client = phone(revoked_session(make_member, org_a, RevokeReason.ADMIN_REVOKE))

    client.post(FINAL_UPLOAD)

    session = DeviceSession.objects.get()
    assert session.final_upload_used_at is not None
