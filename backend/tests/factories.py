import factory
from factory.django import DjangoModelFactory

from accounts.models import User
from catalogs.models import Catalog, CatalogItem
from organizations.models import Membership, Organization, Profile
from tests.testapp.models import Widget


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda user: f"{user.username}@example.test")


class OrganizationFactory(DjangoModelFactory):
    class Meta:
        model = Organization

    name = factory.Sequence(lambda n: f"Organization {n}")
    slug = factory.Sequence(lambda n: f"org-{n}")
    country = "MX"
    timezone = "America/Mexico_City"


class ProfileFactory(DjangoModelFactory):
    class Meta:
        model = Profile

    organization = factory.SubFactory(OrganizationFactory)
    slug = factory.Sequence(lambda n: f"profile-{n}")
    label_es = factory.LazyAttribute(lambda profile: f"Perfil {profile.slug}")
    label_en = factory.LazyAttribute(lambda profile: f"Profile {profile.slug}")
    permission_codes: list[str] = []


class MembershipFactory(DjangoModelFactory):
    class Meta:
        model = Membership

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(OrganizationFactory)


class WidgetFactory(DjangoModelFactory):
    class Meta:
        model = Widget

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Widget {n}")


class CatalogFactory(DjangoModelFactory):
    class Meta:
        model = Catalog

    organization = factory.SubFactory(OrganizationFactory)
    slug = factory.Sequence(lambda n: f"catalog-{n}")
    label_es = factory.LazyAttribute(lambda catalog: f"Catálogo {catalog.slug}")
    label_en = factory.LazyAttribute(lambda catalog: f"Catalog {catalog.slug}")


class CatalogItemFactory(DjangoModelFactory):
    class Meta:
        model = CatalogItem

    catalog = factory.SubFactory(CatalogFactory)
    organization = factory.SelfAttribute("catalog.organization")
    code = factory.Sequence(lambda n: f"item-{n}")
    label_es = factory.LazyAttribute(lambda item: f"Opción {item.code}")
    label_en = factory.LazyAttribute(lambda item: f"Option {item.code}")
    sort = factory.Sequence(lambda n: n + 1)
