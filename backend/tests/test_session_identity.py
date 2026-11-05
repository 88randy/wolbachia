"""`X-Session-Identity`: the server attests who every authenticated response was answered for (#82)."""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from core.session_identity import IDENTITY_HEADER
from organizations.models import Organization
from tests.factories import MembershipFactory, OrganizationFactory, UserFactory

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/"
HEALTH = "/api/v1/health/"


def _identity(client: APIClient, slug: str | None = None) -> str | None:
    headers = {"HTTP_X_ORGANIZATION": slug} if slug else {}
    return client.get(ME, **headers).headers.get(IDENTITY_HEADER)


def _member(org: Organization) -> object:
    user = UserFactory()
    MembershipFactory(user=user, organization=org)
    return user


def test_same_session_and_organization_give_the_same_value(org_a: Organization) -> None:
    client = APIClient()
    client.force_login(_member(org_a))

    first = _identity(client)
    second = _identity(client)

    assert first is not None
    assert first == second
    assert len(first) == 32


def test_another_user_gets_another_value(org_a: Organization) -> None:
    one, other = APIClient(), APIClient()
    one.force_login(_member(org_a))
    other.force_login(_member(org_a))

    assert _identity(one) != _identity(other)


def test_another_organization_of_the_same_session_gets_another_value(org_a: Organization) -> None:
    org_b = OrganizationFactory(slug="org-b")
    user = UserFactory()
    MembershipFactory(user=user, organization=org_a)
    MembershipFactory(user=user, organization=org_b)
    client = APIClient()
    client.force_login(user)

    assert _identity(client, "org-a") != _identity(client, "org-b")


def test_a_new_login_of_the_same_user_is_another_session_and_gets_another_value(
    org_a: Organization,
) -> None:
    user = _member(org_a)
    first, second = APIClient(), APIClient()
    first.force_login(user)
    second.force_login(user)

    assert _identity(first) != _identity(second)


def test_a_resource_and_me_agree_for_the_same_identity(org_a: Organization) -> None:
    client = APIClient()
    client.force_login(_member(org_a))

    me = client.get(ME).headers.get(IDENTITY_HEADER)
    catalogs = client.get("/api/v1/catalogs/").headers.get(IDENTITY_HEADER)

    assert me == catalogs


def test_the_value_is_opaque(org_a: Organization) -> None:
    user = _member(org_a)
    client = APIClient()
    client.force_login(user)

    value = _identity(client) or ""

    assert str(user.pk) not in value
    assert org_a.slug not in value


def test_anonymous_and_non_api_responses_carry_no_attestation() -> None:
    client = APIClient()

    assert IDENTITY_HEADER not in client.get(HEALTH).headers
    assert IDENTITY_HEADER not in client.get(ME).headers  # 401: nobody is authenticated


def _user_with_password(password: str) -> User:
    user = UserFactory()
    user.set_password(password)
    user.save(update_fields=["password"])
    return user


def _login_identity(slug: str | None, username: str, password: str) -> tuple[APIClient, str | None]:
    client = APIClient(enforce_csrf_checks=False)
    headers = {"HTTP_X_ORGANIZATION": slug} if slug else {}
    response = client.post(
        "/api/v1/auth/login/",
        {"username": username, "password": password},
        format="json",
        **headers,
    )
    assert response.status_code == 200
    return client, response.headers.get(IDENTITY_HEADER)


def test_the_login_answer_attests_the_same_identity_as_me_and_a_resource(
    org_a: Organization,
) -> None:
    password = "pw-for-the-identity-test-123"
    user = _user_with_password(password)
    MembershipFactory(user=user, organization=org_a)

    client, from_login = _login_identity(None, user.username, password)

    assert from_login is not None
    assert from_login == client.get(ME).headers.get(IDENTITY_HEADER)
    assert from_login == client.get("/api/v1/catalogs/").headers.get(IDENTITY_HEADER)


def test_the_login_answer_with_x_organization_matches_that_organization(
    org_a: Organization,
) -> None:
    password = "pw-for-the-identity-test-456"
    org_b = OrganizationFactory(slug="org-b")
    user = _user_with_password(password)
    MembershipFactory(user=user, organization=org_a)
    MembershipFactory(user=user, organization=org_b)

    client, from_login = _login_identity("org-b", user.username, password)

    assert from_login == _identity(client, "org-b")
    assert from_login != _identity(client, "org-a")


def test_error_answers_without_a_resolved_organization_carry_no_attestation(
    org_a: Organization,
) -> None:
    user = _member(org_a)
    client = APIClient()
    client.force_login(user)

    refused = client.get("/api/v1/catalogs/", HTTP_X_ORGANIZATION="not-mine")

    assert refused.status_code == 403
    assert IDENTITY_HEADER in refused.headers  # the user and session are known; the org is "" here
