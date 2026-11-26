"""An org admin issues a one-time password without ever knowing the user's final one."""

from uuid import uuid4

import pytest

from accounts.models import AccessLog, DeviceSession, User
from accounts.personnel_services import issue_temporary_password
from accounts.services import DeviceInfo, start_device_session
from core.exceptions import FieldValidationError
from organizations.models import all_scope
from platform_admin.models import PlatformAdmin
from tests.factories import MembershipFactory, OrganizationFactory
from tests.test_accounts_b_02 import (
    make_actor,
    make_person,
    setup,  # noqa: F401 -- shared fixture
)

pytestmark = pytest.mark.django_db


@pytest.mark.django_db(transaction=True)
def test_issues_a_must_change_password_and_ends_every_session(setup):  # noqa: F811
    person, member = make_person(setup.actor, setup.center)
    session = start_device_session(member.user, setup.actor.organization, DeviceInfo(uuid4()))
    receipts = AccessLog.objects.count()

    password = issue_temporary_password(setup.actor, member.user_id)

    user = User.objects.get(pk=member.user_id)
    assert user.check_password(password)
    assert user.must_change_password is True
    assert user.temporary_password_expires_at is not None
    assert DeviceSession.objects.get(pk=session.session.pk).revoked_at is not None
    assert AccessLog.objects.count() == receipts + 1


def test_refuses_the_callers_own_account(setup):  # noqa: F811
    with pytest.raises(FieldValidationError):
        issue_temporary_password(setup.actor, setup.actor.user.pk)


def test_refuses_a_login_shared_with_another_organization(setup):  # noqa: F811
    _person, member = make_person(setup.actor, setup.center)
    MembershipFactory(user=member.user, organization=OrganizationFactory(), scope=all_scope())
    before = User.objects.get(pk=member.user_id).password

    with pytest.raises(FieldValidationError):
        issue_temporary_password(setup.actor, member.user_id)

    assert User.objects.get(pk=member.user_id).password == before


def test_refuses_a_platform_admin(setup):  # noqa: F811
    _person, member = make_person(setup.actor, setup.center)
    PlatformAdmin.objects.create(user=member.user, created_by=setup.actor.user)

    with pytest.raises(FieldValidationError):
        issue_temporary_password(setup.actor, member.user_id)


def test_requires_user_update_over_the_target(setup, api_client):  # noqa: F811
    _person, member = make_person(setup.actor, setup.center)
    reader, _member, _profile = make_actor(setup.actor.organization, ["user.read"])
    api_client.force_authenticate(reader.user)
    headers = {"HTTP_X_ORGANIZATION": setup.actor.organization.slug}

    response = api_client.post(f"/api/v1/users/{member.user_id}/temporary-password/", **headers)

    assert response.status_code == 403
    assert not User.objects.get(pk=member.user_id).must_change_password


def test_endpoint_returns_the_password_once_without_caching(setup, api_client):  # noqa: F811
    _person, member = make_person(setup.actor, setup.center)
    api_client.force_authenticate(setup.actor.user)
    headers = {"HTTP_X_ORGANIZATION": setup.actor.organization.slug}

    response = api_client.post(f"/api/v1/users/{member.user_id}/temporary-password/", **headers)

    assert response.status_code == 200
    assert "no-store" in response["Cache-Control"]
    body = response.json()
    assert User.objects.get(pk=member.user_id).check_password(body["temporary_password"])
    assert body["expires_at"]
