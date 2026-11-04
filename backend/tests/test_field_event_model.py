"""FieldEvent and ReviewItem are insert-only: the model, the manager and the database agree."""

import pytest
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.utils import timezone

from core.exceptions import ImmutableRecordError, PhysicalDeleteForbiddenError
from core.services import void_record
from field_sync.models import FieldEvent
from reviews.models import ReviewItem
from tests.factories import FieldEventFactory, ReviewItemFactory, UserFactory

pytestmark = pytest.mark.django_db


def run_sql(sql: str, params: list[object]) -> None:
    with connection.cursor() as cursor:
        cursor.execute(sql, params)


def run_rejected_sql(sql: str, params: list[object], message: str) -> None:
    """The database must refuse the statement (and the failed statement is rolled back)."""
    with pytest.raises(DatabaseError, match=message), transaction.atomic():
        run_sql(sql, params)


def test_a_stored_event_cannot_be_saved_again() -> None:
    event = FieldEventFactory()
    event.status_code = "tampered"

    with pytest.raises(ImmutableRecordError):
        event.save()

    event.refresh_from_db()
    assert event.status_code == "accepted"


def test_queryset_update_and_bulk_update_are_blocked() -> None:
    event = FieldEventFactory()

    with pytest.raises(ImmutableRecordError):
        FieldEvent.objects.filter(pk=event.pk).update(payload={})
    with pytest.raises(ImmutableRecordError):
        FieldEvent.objects.bulk_update([event], ["payload"])


def test_an_event_cannot_be_deleted() -> None:
    event = FieldEventFactory()

    with pytest.raises(PhysicalDeleteForbiddenError):
        event.delete()
    with pytest.raises(PhysicalDeleteForbiddenError):
        FieldEvent.objects.all().delete()


def test_only_the_void_fields_are_mutable() -> None:
    event = FieldEventFactory()

    voided = void_record(event, UserFactory(), "typed in the wrong place")

    assert voided.voided_at is not None
    assert FieldEvent.objects.not_voided().filter(pk=event.pk).count() == 0
    assert FieldEvent.mutable_fields == {"voided_at", "voided_by", "void_reason"}


def test_the_database_rejects_raw_updates_of_an_event() -> None:
    event = FieldEventFactory()

    run_rejected_sql(
        "UPDATE field_sync_fieldevent SET status_code = %s WHERE id = %s",
        ["tampered", event.pk],
        "insert-only",
    )


def test_the_database_rejects_raw_deletes_of_an_event() -> None:
    event = FieldEventFactory()

    run_rejected_sql("DELETE FROM field_sync_fieldevent WHERE id = %s", [event.pk], "never deleted")


def test_the_database_lets_an_event_be_voided_once_and_no_more() -> None:
    event = FieldEventFactory()
    user = UserFactory()
    sql = (
        "UPDATE field_sync_fieldevent SET voided_at = %s, voided_by_id = %s, void_reason = %s"
        " WHERE id = %s"
    )
    run_sql(sql, [timezone.now(), user.pk, "first", event.pk])

    run_rejected_sql(sql, [timezone.now(), user.pk, "second", event.pk], "insert-only")


def test_the_status_must_be_one_of_the_three_states() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        FieldEventFactory(status="pending")


def test_a_void_must_carry_a_reason() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        FieldEventFactory(voided_at=timezone.now(), voided_by=UserFactory(), void_reason="")


def test_a_review_item_cannot_be_modified_or_deleted() -> None:
    item = ReviewItemFactory()
    item.code = "other"

    with pytest.raises(ImmutableRecordError):
        item.save()
    with pytest.raises(ImmutableRecordError):
        ReviewItem.objects.filter(pk=item.pk).update(code="other")
    with pytest.raises(PhysicalDeleteForbiddenError):
        item.delete()


def test_the_database_rejects_raw_changes_of_a_review_item() -> None:
    item = ReviewItemFactory()

    run_rejected_sql(
        "UPDATE reviews_reviewitem SET code = 'x' WHERE id = %s", [item.pk], "insert-only"
    )
    run_rejected_sql("DELETE FROM reviews_reviewitem WHERE id = %s", [item.pk], "insert-only")


def test_an_event_has_at_most_one_review_item() -> None:
    item = ReviewItemFactory()

    with pytest.raises(IntegrityError), transaction.atomic():
        ReviewItemFactory(field_event=item.field_event)


def test_review_items_are_isolated_by_organization() -> None:
    mine = ReviewItemFactory()
    ReviewItemFactory()

    visible = ReviewItem.objects.for_org(mine.organization)

    assert list(visible) == [mine]
