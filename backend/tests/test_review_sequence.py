"""`courier_sequence`: the position of a review item in its courier's inbox."""

import pytest
from django.db import IntegrityError, transaction

from reviews.services import next_courier_sequence
from tests.factories import OrganizationFactory, ReviewItemFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_the_first_item_of_a_courier_is_one_and_the_next_is_one_more() -> None:
    first = ReviewItemFactory()

    second = ReviewItemFactory(
        field_event__organization=first.organization, field_event__created_by=first.courier
    )

    assert (first.courier_sequence, second.courier_sequence) == (1, 2)
    assert next_courier_sequence(first.organization, first.courier) == 3


def test_each_courier_and_each_organization_counts_on_its_own() -> None:
    organization = OrganizationFactory()
    a = ReviewItemFactory(field_event__organization=organization)
    b = ReviewItemFactory(field_event__organization=organization)
    elsewhere = ReviewItemFactory(field_event__created_by=a.courier)

    assert (a.courier_sequence, b.courier_sequence, elsewhere.courier_sequence) == (1, 1, 1)


def test_the_database_refuses_a_repeated_sequence_for_one_courier() -> None:
    item = ReviewItemFactory()

    with pytest.raises(IntegrityError), transaction.atomic():
        ReviewItemFactory(
            field_event__organization=item.organization,
            field_event__created_by=item.courier,
            courier_sequence=item.courier_sequence,
        )


def test_a_user_without_items_starts_at_one() -> None:
    assert next_courier_sequence(OrganizationFactory(), UserFactory()) == 1
