import threading

import pytest
from django.db import connection, transaction

from organizations.defaults import DEFAULT_PROFILE_PERMISSIONS, seed_default_permission_codes
from organizations.models import Profile
from organizations.services import OrganizationSpec, create_organization

pytestmark = pytest.mark.django_db(transaction=True)

SPEC = OrganizationSpec(name="Race", slug="race", country="MX", timezone="America/Mexico_City")
WAIT_SECONDS = 10


def test_a_revoke_committed_while_the_seed_waits_is_not_undone() -> None:
    """B holds the profile row, an admin revokes inside it, and A (the seed) waits for the lock.

    A must compute the codes to add from the row it locks, not from what it read before waiting.
    """
    organization = create_organization(SPEC)
    Profile.objects.filter(organization=organization, slug="courier").update(
        seeded_permission_codes=[], permission_codes=[]
    )
    holding = threading.Event()
    release = threading.Event()
    results: dict[str, object] = {}

    def grant_then_admin_revokes() -> None:
        try:
            with transaction.atomic():
                profile = Profile.objects.select_for_update().get(
                    organization=organization, slug="courier"
                )
                profile.seeded_permission_codes = list(DEFAULT_PROFILE_PERMISSIONS["courier"])
                profile.permission_codes = ["catalog.read"]  # granted, then one revoked
                profile.save()
                holding.set()
                release.wait(WAIT_SECONDS)
        finally:
            connection.close()

    def seed() -> None:
        try:
            results["plan"] = seed_default_permission_codes(organization)
        finally:
            connection.close()

    holder = threading.Thread(target=grant_then_admin_revokes)
    holder.start()
    assert holding.wait(WAIT_SECONDS)
    seeder = threading.Thread(target=seed)
    seeder.start()
    seeder.join(0.5)
    assert seeder.is_alive(), "the seed must wait for the profile lock"
    release.set()
    holder.join(WAIT_SECONDS)
    seeder.join(WAIT_SECONDS)

    courier = Profile.objects.get(organization=organization, slug="courier")
    assert courier.permission_codes == ["catalog.read"]
    assert "courier" not in results["plan"].grants
