import uuid
from datetime import timedelta

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from accounts.models import Device, DeviceSession, TokenPair, User
from accounts.tokens import hash_token
from catalogs.models import Catalog, CatalogItem
from field_sync.models import ACCEPTED_CODE, EventStatus, FieldEvent
from organizations.models import Membership, Organization, Profile
from reviews.models import ReviewItem, ReviewKind
from reviews.services import next_courier_sequence
from rules.models import RuleParameter, RuleParameterVersion, Unit, ValueType
from shifts.models import Motorcycle, Shift
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
    """A session without tokens. Use `accounts.services.start_device_session` for real tokens."""

    class Meta:
        model = DeviceSession

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    device = factory.SubFactory(DeviceFactory, organization=factory.SelfAttribute("..organization"))


class TokenPairFactory(DjangoModelFactory):
    """A token pair with random digests."""

    class Meta:
        model = TokenPair

    session = factory.SubFactory(DeviceSessionFactory)
    organization = factory.SelfAttribute("session.organization")
    access_hash = factory.LazyFunction(lambda: hash_token(uuid.uuid4().hex))
    refresh_hash = factory.LazyFunction(lambda: hash_token(uuid.uuid4().hex))
    access_expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(minutes=15))
    refresh_expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(days=30))


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


class RuleParameterFactory(DjangoModelFactory):
    class Meta:
        model = RuleParameter

    organization = factory.SubFactory(OrganizationFactory)
    key = factory.Sequence(lambda n: f"parameter_{n}")
    value_type = ValueType.INTEGER
    unit = Unit.METERS


class RuleParameterVersionFactory(DjangoModelFactory):
    """`effective_from` defaults to a moment in the past; `effective_date` follows it (UTC)."""

    class Meta:
        model = RuleParameterVersion

    parameter = factory.SubFactory(RuleParameterFactory)
    organization = factory.SelfAttribute("parameter.organization")
    value = 50
    effective_from = factory.LazyFunction(lambda: timezone.now() - timedelta(days=30))
    effective_date = factory.LazyAttribute(lambda version: version.effective_from.date())
    reason = "test"


class FieldEventFactory(DjangoModelFactory):
    """An accepted event of a fresh device and user, in the same organization."""

    class Meta:
        model = FieldEvent

    id = factory.LazyFunction(uuid.uuid4)
    organization = factory.SubFactory(OrganizationFactory)
    created_by = factory.SubFactory(UserFactory)
    device = factory.SubFactory(DeviceFactory, organization=factory.SelfAttribute("..organization"))
    type = "test.note"
    schema_version = 1
    payload: dict[str, object] = {"text": "hello"}
    payload_sha256 = factory.LazyFunction(lambda: "0" * 64)
    device_time = factory.LazyFunction(timezone.now)
    server_received_at = factory.LazyFunction(timezone.now)
    status = EventStatus.ACCEPTED
    status_code = ACCEPTED_CODE


class ReviewItemFactory(DjangoModelFactory):
    """A review item of a rejected event, in the event's organization."""

    class Meta:
        model = ReviewItem

    field_event = factory.SubFactory(
        FieldEventFactory, status=EventStatus.REJECTED, status_code="invalid_payload"
    )
    organization = factory.SelfAttribute("field_event.organization")
    created_by = factory.SelfAttribute("field_event.created_by")
    courier = factory.SelfAttribute("field_event.created_by")
    device = factory.SelfAttribute("field_event.device")
    event_type = factory.SelfAttribute("field_event.type")
    courier_sequence = factory.LazyAttribute(
        lambda item: next_courier_sequence(item.organization, item.courier)
    )
    kind = ReviewKind.REJECTED
    code = "invalid_payload"


class MotorcycleFactory(DjangoModelFactory):
    class Meta:
        model = Motorcycle

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"FM-{n:02d}")
    plate = factory.Sequence(lambda n: f"ABC-{n:03d}-D")


class ShiftFactory(DjangoModelFactory):
    """An open shift of a fresh courier; its `opened_event` is a stored accepted `shift.open`.
    `is_closed=True` makes it a closed one (with its `shift.close` event and a close odometer)."""

    class Meta:
        model = Shift

    class Params:
        is_closed = False

    id = factory.LazyFunction(uuid.uuid4)
    code = factory.Sequence(lambda n: f"JOR-{n:04d}")
    organization = factory.SubFactory(OrganizationFactory)
    courier = factory.SubFactory(UserFactory)
    created_by = factory.SelfAttribute("courier")
    device = factory.SubFactory(DeviceFactory, organization=factory.SelfAttribute("..organization"))
    motorcycle = factory.SubFactory(
        MotorcycleFactory, organization=factory.SelfAttribute("..organization")
    )
    opened_at_device = factory.LazyFunction(timezone.now)
    opened_event = factory.SubFactory(
        FieldEventFactory,
        type="shift.open",
        organization=factory.SelfAttribute("..organization"),
        created_by=factory.SelfAttribute("..courier"),
        device=factory.SelfAttribute("..device"),
    )
    odometer_open_km = 12_000
    status = factory.Maybe("is_closed", "closed", "open")
    closed_at_device = factory.Maybe("is_closed", factory.LazyFunction(timezone.now), None)
    odometer_close_km = factory.Maybe("is_closed", 12_050, None)
    closed_event = factory.Maybe(
        "is_closed",
        factory.SubFactory(
            FieldEventFactory,
            type="shift.close",
            organization=factory.SelfAttribute("..organization"),
            created_by=factory.SelfAttribute("..courier"),
            device=factory.SelfAttribute("..device"),
        ),
        None,
    )
