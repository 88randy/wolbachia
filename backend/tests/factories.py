import uuid
from datetime import timedelta

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from accounts.models import Device, DeviceSession, User
from accounts.tokens import hash_token
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


class DeviceFactory(DjangoModelFactory):
    class Meta:
        model = Device

    id = factory.LazyFunction(uuid.uuid4)
    organization = factory.SubFactory(OrganizationFactory)
    label = factory.Sequence(lambda n: f"Phone {n}")


class DeviceSessionFactory(DjangoModelFactory):
    """A session with random digests. Use `accounts.services.start_device_session` for real tokens."""

    class Meta:
        model = DeviceSession

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    device = factory.SubFactory(DeviceFactory, organization=factory.SelfAttribute("..organization"))
    access_hash = factory.LazyFunction(lambda: hash_token(uuid.uuid4().hex))
    refresh_hash = factory.LazyFunction(lambda: hash_token(uuid.uuid4().hex))
    access_expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(minutes=15))
    refresh_expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(days=30))
