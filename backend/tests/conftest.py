from collections.abc import Callable, Iterable

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Membership, Organization
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory

MemberFactory = Callable[..., tuple[User, Membership]]


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    """Throttle counters live in the cache; keep tests independent."""
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def org_a() -> Organization:
    return OrganizationFactory(slug="org-a")


@pytest.fixture
def org_b() -> Organization:
    return OrganizationFactory(slug="org-b")


@pytest.fixture
def make_member() -> MemberFactory:
    """Create a user with an active membership (and one profile with the given codes)."""

    def _make(
        organization: Organization,
        permission_codes: Iterable[str] = (),
        user: User | None = None,
    ) -> tuple[User, Membership]:
        user = user or UserFactory()
        membership = MembershipFactory(user=user, organization=organization)
        profile = ProfileFactory(organization=organization, permission_codes=list(permission_codes))
        membership.profiles.add(profile)
        return user, membership

    return _make


@pytest.fixture
def member_a(org_a: Organization, make_member: MemberFactory) -> User:
    return make_member(org_a)[0]


@pytest.fixture
def client_a(api_client: APIClient, member_a: User) -> APIClient:
    api_client.force_authenticate(member_a)
    return api_client
