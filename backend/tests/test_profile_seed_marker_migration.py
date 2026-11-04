import importlib

import pytest
from django.apps import apps as global_apps

from organizations.models import Profile
from tests.factories import OrganizationFactory, ProfileFactory, UserFactory

pytestmark = pytest.mark.django_db

migration = importlib.import_module("organizations.migrations.0003_mark_existing_seeded_profiles")


def run_migration() -> None:
    migration.mark_seeded_profiles(global_apps, None)


def test_default_profiles_without_author_are_marked_as_seeded() -> None:
    organization = OrganizationFactory()
    profile = ProfileFactory(organization=organization, slug="courier")

    run_migration()

    profile.refresh_from_db()
    assert profile.created_by_seed is True


def test_profiles_with_an_author_stay_unmarked() -> None:
    profile = ProfileFactory(slug="admin", created_by=UserFactory())

    run_migration()

    profile.refresh_from_db()
    assert profile.created_by_seed is False


def test_profiles_with_other_slugs_stay_unmarked() -> None:
    profile = ProfileFactory(slug="custom")

    run_migration()

    profile.refresh_from_db()
    assert profile.created_by_seed is False


def test_a_marked_profile_then_receives_the_default_codes() -> None:
    from organizations.defaults import seed_default_permission_codes

    organization = OrganizationFactory()
    ProfileFactory(organization=organization, slug="courier")

    run_migration()
    seed_default_permission_codes(organization)

    courier = Profile.objects.get(organization=organization, slug="courier")
    assert "catalog.read" in courier.permission_codes
