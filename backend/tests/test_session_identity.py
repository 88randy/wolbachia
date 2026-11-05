"""`X-Session-Identity`: the server attests who every authenticated response was answered for (#82)."""

import pytest
from rest_framework.test import APIClient

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
