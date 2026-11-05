"""Fleet domain rules and audit persistence; each behavior is tested at one layer."""

import pytest
from django.db import DatabaseError, connection, transaction

from core.exceptions import AlreadyVoidedError, FieldValidationError, ImmutableRecordError
from shifts.exceptions import MotorcycleInUseError, MotorcycleNotBlockedError
from shifts.models import MotorcycleBlockEvent
from shifts.services import (
    create_motorcycle,
    unblock_motorcycle,
    update_motorcycle,
    void_motorcycle,
)
from tests.factories import MotorcycleFactory, ShiftFactory, UserFactory
from tests.sync_support import run_in_threads

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("void_catalog")]


def test_voided_motorcycle_codes_stay_reserved_against_reuse(org_a):
    user = UserFactory()
    motorcycle = MotorcycleFactory(organization=org_a, code="M-03")
    void_motorcycle(motorcycle, user, "Incorrect motorcycle code", "other")

    with pytest.raises(FieldValidationError) as error:
        create_motorcycle(org_a, {"code": "M-03"}, user)

    assert error.value.fields == {"code": [{"code": "duplicate_code", "params": {}}]}


@pytest.mark.parametrize("operation", ["update", "void", "unblock"])
def test_voided_motorcycles_cannot_change_through_stale_instances(org_a, operation):
    user = UserFactory()
    motorcycle = MotorcycleFactory(organization=org_a)
    void_motorcycle(motorcycle, user, "Duplicate vehicle record", "other")
    operations = {
        "update": lambda: update_motorcycle(motorcycle, {"plate": "TEST"}),
        "void": lambda: void_motorcycle(motorcycle, user, "Duplicate vehicle record", "other"),
        "unblock": lambda: unblock_motorcycle(motorcycle, user, "Vehicle repaired now"),
    }
    with pytest.raises(AlreadyVoidedError):
        operations[operation]()


def test_void_refuses_a_motorcycle_in_an_open_shift(org_a):
    shift = ShiftFactory(organization=org_a)
    with pytest.raises(MotorcycleInUseError):
        void_motorcycle(shift.motorcycle, shift.courier, "Vehicle removed from fleet", "other")
    shift.motorcycle.refresh_from_db()
    assert shift.motorcycle.voided_at is None


@pytest.mark.parametrize("method", ["save", "update", "raw_update", "raw_delete"])
def test_block_audit_is_insert_only_in_models_and_database(org_a, method):
    motorcycle = MotorcycleFactory(
        organization=org_a, is_blocked=True, blocked_reason="severe_check"
    )
    unblock_motorcycle(motorcycle, UserFactory(), "Vehicle repaired now")
    audit = MotorcycleBlockEvent.objects.get(motorcycle=motorcycle)
    if method == "save":
        with pytest.raises(ImmutableRecordError):
            audit.save()
    elif method == "update":
        with pytest.raises(ImmutableRecordError):
            MotorcycleBlockEvent.objects.filter(pk=audit.pk).update(reason="changed")
    else:
        sql = (
            "UPDATE shifts_motorcycleblockevent SET reason = 'changed' WHERE id = %s"
            if method == "raw_update"
            else "DELETE FROM shifts_motorcycleblockevent WHERE id = %s"
        )
        with (
            pytest.raises(DatabaseError, match="insert-only"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(sql, [audit.pk])


@pytest.mark.django_db(transaction=True)
def test_concurrent_unblocks_create_only_one_audit_event(org_a):
    user = UserFactory()
    motorcycle = MotorcycleFactory(
        organization=org_a, is_blocked=True, blocked_reason="severe_check"
    )
    outcomes = run_in_threads(
        lambda: unblock_motorcycle(motorcycle, user, "Vehicle repaired now"),
        lambda: unblock_motorcycle(motorcycle, user, "Vehicle repaired now"),
    )
    assert sum(isinstance(outcome, MotorcycleNotBlockedError) for outcome in outcomes) == 1, (
        outcomes
    )
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1, outcomes
    assert MotorcycleBlockEvent.objects.filter(motorcycle=motorcycle).count() == 1


@pytest.mark.django_db(transaction=True)
def test_void_and_shift_open_cannot_leave_an_open_shift_on_a_voided_motorcycle(org_a, make_member):
    from shifts.models import Shift
    from tests.shift_support import make_check_items, open_event
    from tests.sync_support import make_phone

    make_check_items(org_a)
    motorcycle = MotorcycleFactory(organization=org_a, code="M-03")
    phone = make_phone(make_member, org_a)
    opened, voided = run_in_threads(
        lambda: phone.sync([open_event("M-03")]),
        lambda: void_motorcycle(motorcycle, phone.user, "Vehicle removed from fleet", "other"),
    )
    assert not isinstance(opened, Exception), opened
    assert opened.status_code == 200
    motorcycle.refresh_from_db()
    if isinstance(voided, MotorcycleInUseError):
        assert motorcycle.voided_at is None
        assert Shift.objects.filter(motorcycle=motorcycle, status="open").count() == 1
        assert opened.data["results"][0]["status"] == "accepted"
    else:
        assert not isinstance(voided, Exception), voided
        assert motorcycle.voided_at is not None
        assert not Shift.objects.filter(motorcycle=motorcycle, status="open").exists()
        assert opened.data["results"][0]["code"] == "motorcycle_unknown"


@pytest.mark.django_db(transaction=True)
def test_simultaneous_creates_map_the_losing_unique_constraint_to_a_field_error(org_a):
    user = UserFactory()
    outcomes = run_in_threads(
        lambda: create_motorcycle(org_a, {"code": "M-03"}, user),
        lambda: create_motorcycle(org_a, {"code": "M-03"}, user),
    )
    assert sum(isinstance(outcome, FieldValidationError) for outcome in outcomes) == 1, outcomes
    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1, outcomes
