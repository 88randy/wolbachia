"""The memberships list (W65 assignments) must not hide active members by default."""

import pytest

from organizations.models import all_scope
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory


@pytest.mark.django_db
def test_membership_list_without_filter_returns_active_and_inactive_members(api_client):
    organization = OrganizationFactory(slug="org-memberships")
    reader = ProfileFactory(organization=organization, permission_codes=["role.read"])
    reader.scope = all_scope()
    reader.save(update_fields=["scope"])
    admin = MembershipFactory(organization=organization, scope=all_scope())
    admin.profiles.add(reader)
    inactive = MembershipFactory(organization=organization, user=UserFactory(), is_active=False)
    MembershipFactory(user=UserFactory())  # another organization: never listed
    api_client.force_authenticate(admin.user)
    headers = {"HTTP_X_ORGANIZATION": organization.slug}

    unfiltered = api_client.get("/api/v1/memberships/", **headers)
    active = api_client.get("/api/v1/memberships/?is_active=true", **headers)
    only_inactive = api_client.get("/api/v1/memberships/?is_active=false", **headers)

    assert unfiltered.status_code == 200
    assert {row["id"] for row in unfiltered.json()["results"]} == {
        str(admin.pk),
        str(inactive.pk),
    }
    assert [row["id"] for row in active.json()["results"]] == [str(admin.pk)]
    assert [row["id"] for row in only_inactive.json()["results"]] == [str(inactive.pk)]
