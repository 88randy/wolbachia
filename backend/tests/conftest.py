from collections.abc import Callable, Iterable, Iterator
from typing import Any

import pytest
from django.core.cache import cache
from django.db.backends.postgresql.operations import DatabaseOperations
from rest_framework.test import APIClient

from accounts.models import User
from catalogs.seeds import seed_default_catalogs
from organizations.models import Membership, Organization
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory

MemberFactory = Callable[..., tuple[User, Membership]]

WIDGET_CODES = ("widget.read", "widget.create", "widget.update", "widget.void")


AUDIT_TRUNCATE_GUARD = (
    "platform_admin_platformauditentry",
    "platform_admin_platformauditentry_truncate_guard",
)


@pytest.fixture(autouse=True, scope="session")
def _allow_test_database_flush() -> Iterator[None]:
    """Let Django's TRUNCATE-based flush (transaction=True tests) pass the audit table guard.

    The guard from `platform_admin/0003` refuses every TRUNCATE of the audit table. Only the flush
    statements are wrapped: the trigger is disabled and re-enabled inside the same transaction, so
    the guard itself stays active for everything else, including its own test. Test code only.
    """
    original = DatabaseOperations.sql_flush

    def sql_flush(self: DatabaseOperations, *args: Any, **kwargs: Any) -> list[str]:
        table, trigger = AUDIT_TRUNCATE_GUARD
        statements = original(self, *args, **kwargs)
        return [
            f"ALTER TABLE {table} DISABLE TRIGGER {trigger}",
            *statements,
            f"ALTER TABLE {table} ENABLE TRIGGER {trigger}",
        ]

    DatabaseOperations.sql_flush = sql_flush  # type: ignore[method-assign]
    yield
    DatabaseOperations.sql_flush = original  # type: ignore[method-assign]


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
    return make_member(org_a, WIDGET_CODES)[0]


@pytest.fixture
def client_a(api_client: APIClient, member_a: User) -> APIClient:
    api_client.force_authenticate(member_a)
    return api_client


@pytest.fixture
def void_catalog(org_a: Organization) -> None:
    """The void paths exercise the same catalog configured for a real organization."""
    seed_default_catalogs(org_a)
