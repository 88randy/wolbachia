import pytest
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Organization
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/"


def test_me_returns_user_organization_profiles_permissions_and_scope(
    api_client: APIClient, org_a: Organization
) -> None:
    user = UserFactory(first_name="Ana", last_name="Lopez")
    membership = MembershipFactory(
        user=user, organization=org_a, scope={"centers": ["c1"], "quadrants": []}
    )
    membership.profiles.add(
        ProfileFactory(
            organization=org_a, slug="courier", permission_codes=["ovitrap.read", "shift.write"]
        ),
        ProfileFactory(
            organization=org_a, slug="supervisor", permission_codes=["ovitrap.read", "report.read"]
        ),
    )
    api_client.force_authenticate(user)

    response = api_client.get(URL)

    assert response.status_code == 200
    body = response.data
    assert body["user"]["username"] == user.username
    assert body["user"]["first_name"] == "Ana"
    assert body["organization"]["slug"] == "org-a"
    assert body["organization"]["logo_url"] is None
    assert body["organization"]["languages"] == ["es-MX"]
    assert [p["slug"] for p in body["profiles"]] == ["courier", "supervisor"]
    assert body["permissions"] == ["ovitrap.read", "report.read", "shift.write"]
    assert body["scope"] == {"centers": ["c1"], "quadrants": []}
    assert body["organizations"] == [{"slug": "org-a", "name": org_a.name}]


def test_me_ignores_inactive_profiles(api_client: APIClient, org_a: Organization) -> None:
    user = UserFactory()
    membership = MembershipFactory(user=user, organization=org_a)
    membership.profiles.add(
        ProfileFactory(organization=org_a, permission_codes=["a.read"], is_active=False)
    )
    api_client.force_authenticate(user)

    response = api_client.get(URL)

    assert response.data["profiles"] == []
    assert response.data["permissions"] == []


def test_me_with_several_organizations_and_no_header_returns_null_organization(
    api_client: APIClient, member_a: User
) -> None:
    other = OrganizationFactory(slug="org-c", name="Org C")
    MembershipFactory(user=member_a, organization=other)
    api_client.force_authenticate(member_a)

    response = api_client.get(URL)

    assert response.status_code == 200
    assert response.data["organization"] is None
    assert response.data["permissions"] == []
    assert {o["slug"] for o in response.data["organizations"]} == {"org-a", "org-c"}


def test_me_with_header_selects_that_organization(api_client: APIClient, member_a: User) -> None:
    other = OrganizationFactory(slug="org-c")
    MembershipFactory(user=member_a, organization=other)
    api_client.force_authenticate(member_a)

    response = api_client.get(URL, headers={"X-Organization": "org-c"})

    assert response.data["organization"]["slug"] == "org-c"


def test_me_without_membership_gets_403(api_client: APIClient) -> None:
    api_client.force_authenticate(UserFactory())

    response = api_client.get(URL)

    assert response.status_code == 403
    assert response.data["code"] == "no_active_membership"


def test_me_requires_authentication(api_client: APIClient) -> None:
    assert api_client.get(URL).status_code == 401


def test_me_does_not_list_organizations_with_inactive_membership(
    api_client: APIClient, member_a: User
) -> None:
    other = OrganizationFactory(slug="org-c")
    MembershipFactory(user=member_a, organization=other, is_active=False)
    api_client.force_authenticate(member_a)

    response = api_client.get(URL)

    assert response.data["organization"]["slug"] == "org-a"
    assert [o["slug"] for o in response.data["organizations"]] == ["org-a"]


@pytest.mark.parametrize("stored", [{}, {"centers": "c1"}, ["x"], "garbage", {"centers": [1]}])
def test_me_survives_a_malformed_scope(
    api_client: APIClient, org_a: Organization, stored: object
) -> None:
    user = UserFactory()
    MembershipFactory(user=user, organization=org_a, scope=stored)
    api_client.force_authenticate(user)

    response = api_client.get(URL)

    assert response.status_code == 200
    assert set(response.data["scope"]) == {"centers", "quadrants"}
    assert response.data["scope"]["quadrants"] == []


def test_me_ignores_profiles_of_another_organization_attached_to_the_membership(
    api_client: APIClient, org_a: Organization, org_b: Organization
) -> None:
    user = UserFactory()
    membership = MembershipFactory(user=user, organization=org_a)
    membership.profiles.add(ProfileFactory(organization=org_b, permission_codes=["x.read"]))
    api_client.force_authenticate(user)

    response = api_client.get(URL)

    assert response.data["profiles"] == []
    assert response.data["permissions"] == []
