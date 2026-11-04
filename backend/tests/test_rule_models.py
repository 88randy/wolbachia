from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from core.exceptions import PhysicalDeleteForbiddenError
from rules.exceptions import ImmutableRecordError
from rules.models import RuleParameterVersion
from tests.factories import (
    OrganizationFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
)

pytestmark = pytest.mark.django_db


def test_parameter_key_is_unique_per_organization() -> None:
    parameter = RuleParameterFactory(key="speed_lock_kmh")

    with pytest.raises(IntegrityError), transaction.atomic():
        RuleParameterFactory(key="speed_lock_kmh", organization=parameter.organization)


def test_two_organizations_can_share_a_parameter_key() -> None:
    RuleParameterFactory(key="speed_lock_kmh", organization=OrganizationFactory())

    RuleParameterFactory(key="speed_lock_kmh", organization=OrganizationFactory())


@pytest.mark.parametrize("key", ["Speed", "1speed", "speed-lock", "speed lock", ""])
def test_parameter_key_must_be_snake_case(key: str) -> None:
    parameter = RuleParameterFactory.build(key=key)

    with pytest.raises(ValidationError) as error:
        parameter.full_clean(exclude=["organization"])

    assert "key" in error.value.message_dict


def test_creating_version_keeps_previous_versions() -> None:
    parameter = RuleParameterFactory()
    first = RuleParameterVersionFactory(
        parameter=parameter, value=50, effective_date=date(2026, 1, 1)
    )

    RuleParameterVersionFactory(parameter=parameter, value=60, effective_date=date(2026, 2, 1))

    first.refresh_from_db()
    assert first.value == 50
    assert parameter.versions.count() == 2


def test_saving_existing_version_raises_immutable_error() -> None:
    version = RuleParameterVersionFactory(value=50)
    version.value = 99

    with pytest.raises(ImmutableRecordError):
        version.save()

    version.refresh_from_db()
    assert version.value == 50


def test_queryset_update_raises_immutable_error() -> None:
    RuleParameterVersionFactory(value=50)

    with pytest.raises(ImmutableRecordError):
        RuleParameterVersion.objects.all().update(value=99)


def test_bulk_update_raises_immutable_error() -> None:
    version = RuleParameterVersionFactory(value=50)
    version.value = 99

    with pytest.raises(ImmutableRecordError):
        RuleParameterVersion.objects.bulk_update([version], ["value"])


def test_versions_cannot_be_deleted() -> None:
    version = RuleParameterVersionFactory()

    with pytest.raises(PhysicalDeleteForbiddenError):
        version.delete()
    with pytest.raises(PhysicalDeleteForbiddenError):
        RuleParameterVersion.objects.all().delete()


def test_a_parameter_cannot_have_two_versions_on_the_same_date() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(parameter=parameter, effective_date=date(2026, 3, 1))

    with pytest.raises(IntegrityError), transaction.atomic():
        RuleParameterVersionFactory(parameter=parameter, effective_date=date(2026, 3, 1))


def test_two_parameters_can_have_versions_on_the_same_date() -> None:
    RuleParameterVersionFactory(effective_date=date(2026, 3, 1))

    RuleParameterVersionFactory(effective_date=date(2026, 3, 1))


def test_value_keeps_three_decimal_places() -> None:
    version = RuleParameterVersionFactory(value="12.345")

    version.refresh_from_db()
    assert str(version.value) == "12.345"
