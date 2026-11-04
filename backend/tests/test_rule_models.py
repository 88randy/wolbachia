from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection, transaction

from core.exceptions import ImmutableRecordError, PhysicalDeleteForbiddenError
from core.services import void_record
from rules.models import RuleParameterVersion
from tests.factories import (
    OrganizationFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
    UserFactory,
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


def test_the_database_allows_same_day_versions_so_today_corrections_work() -> None:
    parameter = RuleParameterFactory()
    RuleParameterVersionFactory(parameter=parameter, effective_date=date(2026, 3, 1))

    RuleParameterVersionFactory(parameter=parameter, effective_date=date(2026, 3, 1))

    assert parameter.versions.count() == 2


def test_force_update_on_a_stored_version_raises_immutable_error() -> None:
    version = RuleParameterVersionFactory(value=50)
    version.value = 99

    with pytest.raises(ImmutableRecordError):
        version.save(force_update=True)

    version.refresh_from_db()
    assert version.value == 50


def test_save_with_update_fields_outside_the_void_fields_raises() -> None:
    version = RuleParameterVersionFactory(value=50)
    version.value = 99

    with pytest.raises(ImmutableRecordError):
        version.save(update_fields=["value"])


def test_a_new_instance_is_always_inserted_never_turned_into_an_update() -> None:
    parameter = RuleParameterFactory()
    version = RuleParameterVersionFactory.build(
        parameter=parameter, organization=parameter.organization
    )
    version.save(force_update=False)

    assert RuleParameterVersion.objects.filter(pk=version.pk).count() == 1


def test_bulk_create_with_update_conflicts_raises() -> None:
    version = RuleParameterVersionFactory(value=50)
    clone = RuleParameterVersion(
        id=version.id,
        organization=version.organization,
        parameter=version.parameter,
        value=99,
        effective_from=version.effective_from,
        effective_date=version.effective_date,
        reason="upsert",
    )

    with pytest.raises(ImmutableRecordError):
        RuleParameterVersion.objects.bulk_create(
            [clone], update_conflicts=True, unique_fields=["id"], update_fields=["value"]
        )


def test_the_base_manager_is_insert_only_too() -> None:
    RuleParameterVersionFactory(value=50)

    with pytest.raises(ImmutableRecordError):
        RuleParameterVersion._base_manager.all().update(value=99)


def test_voiding_through_save_is_allowed_once() -> None:
    version = RuleParameterVersionFactory()
    user = UserFactory()

    voided = void_record(version, user, "typo")

    assert (voided.voided_at is not None, voided.void_reason) == (True, "typo")


def test_raw_update_of_a_value_is_rejected_by_the_database() -> None:
    version = RuleParameterVersionFactory(value=50)

    with pytest.raises(DatabaseError, match="insert-only"), connection.cursor() as cursor:
        cursor.execute(
            "UPDATE rules_ruleparameterversion SET value = 99 WHERE id = %s", [version.id]
        )


def test_raw_delete_is_rejected_by_the_database() -> None:
    version = RuleParameterVersionFactory()

    with pytest.raises(DatabaseError, match="never deleted"), connection.cursor() as cursor:
        cursor.execute("DELETE FROM rules_ruleparameterversion WHERE id = %s", [version.id])


def test_raw_update_cannot_change_a_stored_void_or_unvoid_it() -> None:
    version = RuleParameterVersionFactory()
    void_record(version, UserFactory(), "typo")

    with pytest.raises(DatabaseError, match="insert-only"), connection.cursor() as cursor:
        cursor.execute(
            "UPDATE rules_ruleparameterversion SET void_reason = 'other' WHERE id = %s",
            [version.id],
        )


def test_raw_update_may_void_a_version_from_null() -> None:
    version = RuleParameterVersionFactory()
    user = UserFactory()

    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE rules_ruleparameterversion SET voided_at = now(), voided_by_id = %s,"
            " void_reason = 'x' WHERE id = %s",
            [user.id, version.id],
        )

    version.refresh_from_db()
    assert version.voided_at is not None


def test_value_keeps_three_decimal_places() -> None:
    version = RuleParameterVersionFactory(value="12.345")

    version.refresh_from_db()
    assert str(version.value) == "12.345"
