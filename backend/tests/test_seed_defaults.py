from datetime import timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from catalogs.models import Catalog, CatalogItem
from catalogs.seeds import DEFAULT_CATALOG_SEEDS
from core import permission_codes as codes
from organizations.models import Organization, Profile
from organizations.services import (
    AdminSpec,
    OrganizationSpec,
    bootstrap_organization,
    create_organization,
    seed_default_permission_codes,
    seed_default_profiles,
    seed_organization_defaults,
)
from rules.models import RuleParameter, RuleParameterVersion
from rules.seeds import DEFAULT_PARAMETER_SEEDS
from tests.factories import OrganizationFactory

pytestmark = pytest.mark.django_db

SPEC = OrganizationSpec(name="Acme", slug="acme", country="MX", timezone="America/Mexico_City")

BRIEF_VALUES = {
    "max_distance_to_point_m": 50,
    "min_distance_same_block_m": 50,
    "speed_lock_kmh": 10,
    "closed_house_weeks_to_relocate": 2,
    "incidents_to_relocate": 3,
    "reminder_minutes_before_end": 60,
    "max_paddle_reuses": 2,
}
PENDING_KEYS = [
    "speed_unlock_seconds",
    "clock_skew_review_seconds",
    "session_idle_minutes",
    "fuel_efficiency_min_km_l",
    "fuel_efficiency_max_km_l",
]
CLOSED_CATALOGS = {"motorcycle-check-item", "ovitrap-finding"}


def current_values(organization: Organization) -> dict[str, Decimal | None]:
    versions = {
        v.parameter.key: v.value
        for v in RuleParameterVersion.objects.filter(organization=organization).select_related(
            "parameter"
        )
    }
    return {
        p.key: versions.get(p.key) for p in RuleParameter.objects.filter(organization=organization)
    }


def test_create_organization_seeds_catalogs_and_parameters() -> None:
    organization = create_organization(SPEC)

    assert (
        Catalog.objects.filter(organization=organization).count() == len(DEFAULT_CATALOG_SEEDS) == 9
    )
    assert RuleParameter.objects.filter(organization=organization).count() == len(
        DEFAULT_PARAMETER_SEEDS
    )


def test_bootstrap_organization_is_seeded_too() -> None:
    organization, _ = bootstrap_organization(SPEC, AdminSpec("boss", "boss@example.test"))

    assert Catalog.objects.filter(organization=organization).exists()
    assert RuleParameter.objects.filter(organization=organization).exists()


@pytest.mark.parametrize(("key", "value"), BRIEF_VALUES.items())
def test_seeded_values_match_brief(key, value) -> None:
    organization = create_organization(SPEC)

    assert current_values(organization)[key] == value


@pytest.mark.parametrize("key", PENDING_KEYS)
def test_parameters_without_a_brief_value_are_seeded_without_version(key) -> None:
    organization = create_organization(SPEC)

    assert current_values(organization)[key] is None


def test_seeded_versions_use_the_seed_reason_and_have_no_author() -> None:
    organization = create_organization(SPEC)

    version = RuleParameterVersion.objects.filter(organization=organization).first()

    assert version.reason == "seed: design brief"
    assert version.created_by is None


def test_seeded_parameters_have_the_expected_types_and_units() -> None:
    organization = create_organization(SPEC)

    fuel = RuleParameter.objects.get(organization=organization, key="fuel_efficiency_min_km_l")
    speed = RuleParameter.objects.get(organization=organization, key="speed_lock_kmh")

    assert (fuel.value_type, fuel.unit) == ("decimal", "km_l")
    assert (speed.value_type, speed.unit) == ("integer", "km_h")


def test_catalogs_follow_the_open_and_closed_defaults() -> None:
    organization = create_organization(SPEC)

    closed = set(
        Catalog.objects.filter(organization=organization, is_open=False).values_list(
            "slug", flat=True
        )
    )

    assert closed == CLOSED_CATALOGS


def test_every_open_catalog_has_exactly_the_other_item_and_closed_ones_have_none() -> None:
    organization = create_organization(SPEC)

    for catalog in Catalog.objects.filter(organization=organization):
        codes_in_catalog = [item.code for item in catalog.items.all()]
        assert codes_in_catalog == (["other"] if catalog.is_open else [])
    other = CatalogItem.objects.filter(organization=organization, is_other=True).first()
    assert (other.label_es, other.label_en, other.is_active) == (
        "Otro (especificar)",
        "Other (specify)",
        True,
    )


def test_seed_is_idempotent() -> None:
    organization = create_organization(SPEC)
    counts = (
        Catalog.objects.count(),
        CatalogItem.objects.count(),
        RuleParameter.objects.count(),
        RuleParameterVersion.objects.count(),
    )

    seed_organization_defaults(organization)
    seed_organization_defaults(organization)

    assert counts == (
        Catalog.objects.count(),
        CatalogItem.objects.count(),
        RuleParameter.objects.count(),
        RuleParameterVersion.objects.count(),
    )


def test_seed_never_adds_a_second_version_to_a_parameter_an_admin_changed() -> None:
    organization = create_organization(SPEC)
    parameter = RuleParameter.objects.get(organization=organization, key="speed_lock_kmh")
    RuleParameterVersion.objects.create(
        organization=organization,
        parameter=parameter,
        value=12,
        effective_from=timezone.now() + timedelta(days=3),
        effective_date=(timezone.now() + timedelta(days=3)).date(),
        reason="admin change",
    )

    seed_organization_defaults(organization)

    assert sorted(parameter.versions.values_list("value", flat=True)) == [10, 12]


def test_seed_keeps_admin_edits_to_catalog_labels() -> None:
    organization = create_organization(SPEC)
    Catalog.objects.filter(organization=organization, slug="removal-reason").update(
        label_es="Editado"
    )

    seed_organization_defaults(organization)

    assert (
        Catalog.objects.get(organization=organization, slug="removal-reason").label_es == "Editado"
    )


def test_seed_does_not_cross_organizations() -> None:
    first = create_organization(SPEC)
    second = create_organization(OrganizationSpec("Beta", "beta", "MX", "America/Mexico_City"))

    assert Catalog.objects.filter(organization=first).count() == 9
    assert Catalog.objects.filter(organization=second).count() == 9
    assert Catalog.objects.count() == 18


def test_default_profiles_get_the_permission_codes_of_the_plan() -> None:
    organization = create_organization(SPEC)

    by_slug = {
        p.slug: set(p.permission_codes) for p in Profile.objects.filter(organization=organization)
    }

    reader = {codes.CATALOG_READ, codes.RULE_PARAMETER_READ}
    assert by_slug["courier"] == by_slug["supervisor"] == by_slug["entomologist"] == reader
    assert by_slug["community_promoter"] == reader
    assert by_slug["admin"] == {
        codes.CATALOG_READ,
        codes.CATALOG_ITEM_CREATE,
        codes.CATALOG_ITEM_UPDATE,
        codes.CATALOG_ITEM_DEACTIVATE,
        codes.CATALOG_ITEM_ACTIVATE,
        codes.RULE_PARAMETER_READ,
        codes.RULE_PARAMETER_VERSION_CREATE,
    }


def test_seed_adds_permission_codes_without_removing_existing() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)
    Profile.objects.filter(organization=organization, slug="courier").update(
        permission_codes=["widget.read"]
    )

    seed_default_permission_codes(organization)
    seed_default_permission_codes(organization)

    courier = Profile.objects.get(organization=organization, slug="courier")
    assert courier.permission_codes == ["catalog.read", "rule_parameter.read", "widget.read"]


def test_seed_skips_organizations_with_other_profile_slugs() -> None:
    organization = OrganizationFactory()
    Profile.objects.create(organization=organization, slug="custom", label_es="C", label_en="C")

    seed_default_permission_codes(organization)

    assert Profile.objects.get(organization=organization, slug="custom").permission_codes == []


def test_seed_organization_defaults_command_updates_an_existing_organization() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)

    call_command(
        "seed_organization_defaults", "--organization", organization.slug, stdout=StringIO()
    )

    assert Catalog.objects.filter(organization=organization).count() == 9
    assert (
        "catalog.read"
        in Profile.objects.get(organization=organization, slug="courier").permission_codes
    )


def test_seed_organization_defaults_command_rejects_an_unknown_organization() -> None:
    with pytest.raises(CommandError, match="does not exist"):
        call_command("seed_organization_defaults", "--organization", "nope")
