"""How the active organization is resolved from memberships and the X-Organization header."""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Membership, Organization
from tests.factories import MembershipFactory, OrganizationFactory, UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/widgets/"
HEADER = "X-Organization"


def test_user_without_membership_gets_403_no_active_membership(api_client: APIClient) -> None:
    api_client.force_authenticate(UserFactory())

    response = api_client.get(URL)

    assert response.status_code == 403
    assert response.data["code"] == "no_active_membership"


def test_inactive_membership_gets_403(
    api_client: APIClient, member_a: User, org_a: Organization
) -> None:
    Membership.objects.filter(user=member_a, organization=org_a).update(is_active=False)
    api_client.force_authenticate(member_a)

    response = api_client.get(URL)

    assert response.status_code == 403
    assert response.data["code"] == "no_active_membership"


def test_inactive_organization_gets_403(client_a: APIClient, org_a: Organization) -> None:
    Organization.objects.filter(pk=org_a.pk).update(is_active=False)

    response = client_a.get(URL)

    assert response.status_code == 403
    assert response.data["code"] == "no_active_membership"


def test_several_memberships_without_header_gets_400(api_client: APIClient, member_a: User) -> None:
    MembershipFactory(user=member_a, organization=OrganizationFactory(slug="org-c"))
    api_client.force_authenticate(member_a)

    response = api_client.get(URL)

    assert response.status_code == 400
    assert response.data["code"] == "organization_header_required"
    assert "fields" not in response.data


def test_several_memberships_with_valid_header_gets_200(
    api_client: APIClient, member_a: User
) -> None:
    MembershipFactory(user=member_a, organization=OrganizationFactory(slug="org-c"))
    api_client.force_authenticate(member_a)

    response = api_client.get(URL, headers={HEADER: "org-c"})

    assert response.status_code == 200


def test_header_with_a_slug_outside_the_memberships_gets_403(
    client_a: APIClient, org_b: Organization
) -> None:
    response = client_a.get(URL, headers={HEADER: org_b.slug})

    assert response.status_code == 403
    assert response.data["code"] == "no_active_membership"


def test_header_with_an_unknown_slug_gets_403_even_with_one_membership(
    client_a: APIClient,
) -> None:
    response = client_a.get(URL, headers={HEADER: "does-not-exist"})

    assert response.status_code == 403


def test_anonymous_request_gets_401_not_authenticated(api_client: APIClient) -> None:
    response = api_client.get(URL)

    assert response.status_code == 401
    assert response.data["code"] == "not_authenticated"
