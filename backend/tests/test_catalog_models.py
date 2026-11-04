import pytest
from django.db import IntegrityError, transaction

from catalogs.models import Catalog, CatalogItem
from core.exceptions import PhysicalDeleteForbiddenError
from tests.factories import CatalogFactory, CatalogItemFactory, OrganizationFactory


@pytest.mark.django_db
def test_catalog_slug_is_unique_per_organization() -> None:
    catalog = CatalogFactory(slug="removal-reason")

    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogFactory(slug="removal-reason", organization=catalog.organization)


@pytest.mark.django_db
def test_two_organizations_can_share_a_catalog_slug() -> None:
    CatalogFactory(slug="removal-reason", organization=OrganizationFactory())

    CatalogFactory(slug="removal-reason", organization=OrganizationFactory())

    assert Catalog.objects.filter(slug="removal-reason").count() == 2


@pytest.mark.django_db
def test_item_code_is_unique_per_catalog() -> None:
    item = CatalogItemFactory(code="blocked")

    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogItemFactory(code="blocked", catalog=item.catalog)


@pytest.mark.django_db
def test_a_catalog_has_at_most_one_other_item() -> None:
    other = CatalogItemFactory(code="other", is_other=True)

    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogItemFactory(code="another", is_other=True, catalog=other.catalog)


@pytest.mark.django_db
def test_db_rejects_inactive_other_item() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        CatalogItemFactory(code="other", is_other=True, is_active=False)


@pytest.mark.django_db
def test_other_item_is_listed_last_regardless_of_sort() -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=0)
    CatalogItemFactory(catalog=catalog, code="b", sort=2)
    CatalogItemFactory(catalog=catalog, code="a", sort=1)

    codes = list(catalog.items.values_list("code", flat=True))

    assert codes == ["a", "b", "other"]


@pytest.mark.django_db
def test_catalog_items_cannot_be_deleted() -> None:
    item = CatalogItemFactory()

    with pytest.raises(PhysicalDeleteForbiddenError):
        item.delete()
    with pytest.raises(PhysicalDeleteForbiddenError):
        CatalogItem.objects.all().delete()
