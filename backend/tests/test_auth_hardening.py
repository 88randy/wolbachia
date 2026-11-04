"""Cross-cutting guards for the authentication endpoints."""

import uuid

import pytest
from django.views.debug import SafeExceptionReporterFilter
from rest_framework.test import APIClient

from accounts.serializers import PasswordResetConfirmSerializer
from accounts.services import _upgrade_hash, authenticate_user, reset_password, verify_credentials
from accounts.views import LoginView, PasswordResetConfirmView
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PASSWORD = "pw-for-login-tests"  # noqa: S105
SECRET = "pw-for-error-report"  # noqa: S105


def mobile_user(make_member: MemberFactory, organization: Organization) -> str:
    user = UserFactory()
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    make_member(organization, [], user=user)
    return user.username


def test_token_responses_are_never_cached(
    api_client: APIClient, org_a: Organization, make_member: MemberFactory
) -> None:
    username = mobile_user(make_member, org_a)
    device_id = str(uuid.uuid4())

    login = api_client.post(
        "/api/v1/auth/login/",
        {"username": username, "password": PASSWORD, "device_id": device_id},
        format="json",
    )
    refresh = api_client.post(
        "/api/v1/auth/refresh/",
        {"refresh": login.data["refresh"], "device_id": device_id},
        format="json",
    )

    for response in (login, refresh):
        assert response.status_code == 200
        assert "no-store" in response.headers["Cache-Control"]


def test_error_reports_mask_the_password_held_by_authenticate_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Django's error reports (DEBUG page, admin mail) hide the locals of `sensitive_variables`."""

    def explode(*arguments: object, **options: object) -> bool:
        raise RuntimeError("unexpected failure")

    monkeypatch.setattr("accounts.services.check_password", explode)
    user = UserFactory()

    with pytest.raises(RuntimeError) as failure:
        authenticate_user(user.username, SECRET, None)

    traceback = failure.value.__traceback__
    while traceback is not None and traceback.tb_frame.f_code.co_name != "authenticate_user":
        traceback = traceback.tb_next
    assert traceback is not None
    reported = SafeExceptionReporterFilter().get_traceback_frame_variables(None, traceback.tb_frame)
    assert "password" in dict(reported)  # the variable is listed, with its value masked
    assert SECRET not in str(reported)


@pytest.mark.parametrize(
    "function",
    [
        authenticate_user,
        verify_credentials,
        _upgrade_hash,
        reset_password,
        LoginView.post,
        PasswordResetConfirmView.post,
        PasswordResetConfirmSerializer.validate,
    ],
)
def test_every_function_that_holds_a_password_is_marked_sensitive(function: object) -> None:
    # `sensitive_variables` wraps the function; removing it would drop the masking silently.
    assert hasattr(function, "__wrapped__")
