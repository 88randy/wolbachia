import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction

from accounts.models import User
from organizations.exceptions import ProfileOrganizationMismatchError
from organizations.models import Membership, Organization, Profile
from organizations.services import (
    DEFAULT_PROFILE_SEEDS,
    OrganizationSpec,
    assign_profiles,
    create_organization,
    seed_default_profiles,
)
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory

pytestmark = pytest.mark.django_db

SPEC = OrganizationSpec(name="Acme", slug="acme", country="MX", timezone="America/Mexico_City")


def test_create_organization_seeds_the_default_profiles() -> None:
    organization = create_organization(SPEC)

    slugs = set(Profile.objects.filter(organization=organization).values_list("slug", flat=True))
    assert slugs == {"courier", "supervisor", "entomologist", "community_promoter", "admin"}


def test_seed_default_profiles_is_idempotent() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)

    seed_default_profiles(organization)

    assert Profile.objects.filter(organization=organization).count() == len(DEFAULT_PROFILE_SEEDS)


def test_seed_does_not_overwrite_configured_permission_codes() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)
    Profile.objects.filter(organization=organization, slug="courier").update(
        permission_codes=["a.b"]
    )

    seed_default_profiles(organization)

    assert Profile.objects.get(organization=organization, slug="courier").permission_codes == [
        "a.b"
    ]


@pytest.mark.parametrize(
    ("field", "value"),
    [("country", "mex"), ("country", "mx"), ("timezone", "Mars/Olympus"), ("slug", "not a slug")],
)
def test_create_organization_rejects_invalid_values(field: str, value: str) -> None:
    values = {"name": "A", "slug": "a", "country": "MX", "timezone": "UTC", field: value}

    with pytest.raises(ValidationError):
        create_organization(OrganizationSpec(**values))


def test_create_organization_rejects_a_duplicate_slug() -> None:
    create_organization(SPEC)

    with pytest.raises(ValidationError):
        create_organization(SPEC)


def test_assign_profiles_sets_profiles_of_the_same_organization(org_a: Organization) -> None:
    membership = MembershipFactory(organization=org_a)
    profile = ProfileFactory(organization=org_a)

    assign_profiles(membership, [profile])

    assert list(membership.profiles.all()) == [profile]


def test_assign_profiles_rejects_a_profile_of_another_organization(
    org_a: Organization, org_b: Organization
) -> None:
    membership = MembershipFactory(organization=org_a)
    foreign = ProfileFactory(organization=org_b)

    with pytest.raises(ProfileOrganizationMismatchError):
        assign_profiles(membership, [foreign])

    assert membership.profiles.count() == 0


def test_membership_is_unique_per_user_and_organization(org_a: Organization) -> None:
    membership = MembershipFactory(organization=org_a)

    with pytest.raises(IntegrityError), transaction.atomic():
        MembershipFactory(user=membership.user, organization=org_a)


def test_profile_rejects_malformed_permission_codes(org_a: Organization) -> None:
    profile = Profile(
        organization=org_a, slug="p", label_es="P", label_en="P", permission_codes=["NoDot"]
    )

    with pytest.raises(ValidationError):
        profile.full_clean()


def test_bootstrap_command_creates_organization_admin_and_membership() -> None:
    call_command(
        "bootstrap_organization",
        "--name=Acme",
        "--slug=acme",
        "--country=MX",
        "--timezone=America/Mexico_City",
        "--admin-username=boss",
        "--admin-email=boss@example.test",
    )

    admin = User.objects.get(username="boss")
    membership = Membership.objects.get(user=admin, organization__slug="acme")
    assert not admin.has_usable_password()
    assert [p.slug for p in membership.profiles.all()] == ["admin"]


def test_bootstrap_command_fails_cleanly_on_invalid_country() -> None:
    with pytest.raises(CommandError):
        call_command(
            "bootstrap_organization",
            "--name=Acme",
            "--slug=acme",
            "--country=Mexico",
            "--timezone=UTC",
            "--admin-username=boss",
            "--admin-email=boss@example.test",
        )

    assert not Organization.objects.filter(slug="acme").exists()
    assert not User.objects.filter(username="boss").exists()


BOOTSTRAP_ARGS = [
    "--name=Acme",
    "--slug=acme",
    "--country=MX",
    "--timezone=UTC",
    "--admin-username=boss",
]


def test_bootstrap_refuses_an_existing_username_with_a_different_email() -> None:
    other = UserFactory(username="boss", email="someone.else@example.test")

    with pytest.raises(CommandError):
        call_command("bootstrap_organization", *BOOTSTRAP_ARGS, "--admin-email=boss@example.test")

    assert not Organization.objects.filter(slug="acme").exists()
    assert not Membership.objects.filter(user=other).exists()


def test_bootstrap_reuses_an_existing_user_with_the_same_email() -> None:
    existing = UserFactory(username="boss", email="boss@example.test")

    call_command("bootstrap_organization", *BOOTSTRAP_ARGS, "--admin-email=boss@example.test")

    assert Membership.objects.filter(user=existing, organization__slug="acme").exists()


def test_bootstrap_reuses_a_user_with_a_different_email_when_asked() -> None:
    existing = UserFactory(username="boss", email="someone.else@example.test")

    call_command(
        "bootstrap_organization",
        *BOOTSTRAP_ARGS,
        "--admin-email=boss@example.test",
        "--reuse-existing-user",
    )

    assert Membership.objects.filter(user=existing, organization__slug="acme").exists()


@pytest.mark.parametrize("scope", [[], "x", {"centers": "c1"}, {"quadrants": {"a": 1}}])
def test_membership_rejects_a_malformed_scope(scope: object, org_a: Organization) -> None:
    membership = Membership(user=UserFactory(), organization=org_a, scope=scope)

    with pytest.raises(ValidationError):
        membership.clean()


def test_membership_accepts_the_default_and_a_partial_scope(org_a: Organization) -> None:
    Membership(user=UserFactory(), organization=org_a).clean()
    Membership(user=UserFactory(), organization=org_a, scope={"centers": ["c1"]}).clean()
