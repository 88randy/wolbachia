import pytest

from catalogs.exceptions import OtherItemLockedError
from catalogs.selectors import build_catalog_snapshot, find_item, list_items
from catalogs.services import (
    CatalogItemSpec,
    activate_catalog_item,
    create_catalog_item,
    deactivate_catalog_item,
    update_catalog_item,
)
from core.exceptions import FieldValidationError
from tests.factories import CatalogFactory, CatalogItemFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_create_item_appends_after_the_highest_sort_and_before_other() -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=0)
    CatalogItemFactory(catalog=catalog, code="a", sort=4)

    item = create_catalog_item(catalog, CatalogItemSpec("b", "Beta"), UserFactory())

    assert item.sort == 5
    assert [i.code for i in list_items(catalog)] == ["a", "b", "other"]


def test_create_first_item_starts_the_order_at_one() -> None:
    item = create_catalog_item(CatalogFactory(), CatalogItemSpec("a", "Alfa"), UserFactory())

    assert item.sort == 1


def test_create_item_keeps_an_explicit_sort_and_records_the_author() -> None:
    user = UserFactory()

    item = create_catalog_item(CatalogFactory(), CatalogItemSpec("a", "Alfa", sort=9), user)

    assert (item.sort, item.created_by) == (9, user)


def test_create_item_copies_the_organization_of_the_catalog() -> None:
    catalog = CatalogFactory()

    item = create_catalog_item(catalog, CatalogItemSpec("a", "Alfa"), UserFactory())

    assert item.organization_id == catalog.organization_id


def test_create_item_never_creates_the_other_item() -> None:
    item = create_catalog_item(CatalogFactory(), CatalogItemSpec("other", "Otro"), UserFactory())

    assert item.is_other is False


def test_create_item_with_a_taken_code_is_a_field_error() -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog, code="blocked")

    with pytest.raises(FieldValidationError) as error:
        create_catalog_item(catalog, CatalogItemSpec("blocked", "Bloqueado"), UserFactory())

    assert error.value.fields == {"code": [{"code": "duplicate_code", "params": {}}]}


def test_update_item_changes_only_the_editable_fields() -> None:
    item = CatalogItemFactory(code="blocked", label_es="Viejo")

    updated = update_catalog_item(
        item, {"label_es": "Nuevo", "code": "hacked", "is_other": True, "is_active": False}
    )

    assert (updated.label_es, updated.code, updated.is_other, updated.is_active) == (
        "Nuevo",
        "blocked",
        False,
        True,
    )


def test_update_item_persists_the_change() -> None:
    item = CatalogItemFactory(sort=1, requires_photo=False)

    update_catalog_item(item, {"sort": 7, "requires_photo": True})

    item.refresh_from_db()
    assert (item.sort, item.requires_photo) == (7, True)


def test_deactivate_other_raises_a_locked_error_and_keeps_it_active() -> None:
    other = CatalogItemFactory(code="other", is_other=True)

    with pytest.raises(OtherItemLockedError):
        deactivate_catalog_item(other)

    other.refresh_from_db()
    assert other.is_active is True


def test_deactivate_then_activate_a_regular_item() -> None:
    item = CatalogItemFactory()

    deactivate_catalog_item(item)
    assert find_item(item.organization, item.catalog.slug, item.code).is_active is False

    activate_catalog_item(item)
    assert find_item(item.organization, item.catalog.slug, item.code).is_active is True


def test_deactivating_twice_is_harmless() -> None:
    item = CatalogItemFactory(is_active=False)

    assert deactivate_catalog_item(item).is_active is False


def test_find_item_returns_inactive_items_and_none_for_other_organizations() -> None:
    item = CatalogItemFactory(is_active=False)
    outsider = CatalogFactory().organization

    assert find_item(item.organization, item.catalog.slug, item.code) == item
    assert find_item(outsider, item.catalog.slug, item.code) is None


def test_snapshot_lists_only_active_items_in_display_order() -> None:
    catalog = CatalogFactory(slug="removal-reason")
    CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=0)
    CatalogItemFactory(catalog=catalog, code="b", sort=2)
    CatalogItemFactory(catalog=catalog, code="a", sort=1)
    CatalogItemFactory(catalog=catalog, code="off", sort=3, is_active=False)

    snapshot = build_catalog_snapshot(catalog.organization)

    [only] = snapshot["catalogs"]
    assert [item["code"] for item in only["items"]] == ["a", "b", "other"]


def test_snapshot_never_includes_other_organizations() -> None:
    CatalogFactory(slug="foreign")
    mine = CatalogFactory(slug="mine")

    snapshot = build_catalog_snapshot(mine.organization)

    assert [catalog["slug"] for catalog in snapshot["catalogs"]] == ["mine"]


def test_snapshot_version_is_stable_and_changes_with_content() -> None:
    catalog = CatalogFactory()
    item = CatalogItemFactory(catalog=catalog)
    before = build_catalog_snapshot(catalog.organization)

    assert build_catalog_snapshot(catalog.organization)["version"] == before["version"]
    update_catalog_item(item, {"label_es": "Otro texto"})

    assert build_catalog_snapshot(catalog.organization)["version"] != before["version"]


def test_snapshot_version_changes_when_an_item_is_deactivated() -> None:
    catalog = CatalogFactory()
    item = CatalogItemFactory(catalog=catalog)
    before = build_catalog_snapshot(catalog.organization)["version"]

    deactivate_catalog_item(item)

    assert build_catalog_snapshot(catalog.organization)["version"] != before
