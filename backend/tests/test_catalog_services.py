from functools import partial

import pytest

from catalogs import services
from catalogs.exceptions import (
    CatalogItemLimitError,
    CatalogVersionConflictError,
    OtherItemLockedError,
)
from catalogs.models import MAX_SORT
from catalogs.selectors import build_catalog_snapshot
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
    assert list(catalog.items.values_list("code", flat=True)) == ["a", "b", "other"]


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


def test_create_item_rejects_the_reserved_other_code() -> None:
    with pytest.raises(FieldValidationError) as error:
        create_catalog_item(CatalogFactory(), CatalogItemSpec("other", "Otro"), UserFactory())

    assert error.value.fields == {"code": [{"code": "reserved_code", "params": {}}]}


def test_create_item_never_flags_the_new_item_as_other() -> None:
    item = create_catalog_item(CatalogFactory(), CatalogItemSpec("another", "Otro"), UserFactory())

    assert item.is_other is False


def test_create_item_without_sort_fails_cleanly_when_the_order_is_exhausted() -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog, code="last", sort=MAX_SORT)

    with pytest.raises(FieldValidationError) as error:
        create_catalog_item(catalog, CatalogItemSpec("new", "Nuevo"), UserFactory())

    assert error.value.fields == {"sort": [{"code": "sort_exhausted", "params": {}}]}


def test_create_item_may_still_use_an_explicit_sort_when_the_order_is_exhausted() -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog, code="last", sort=MAX_SORT)

    item = create_catalog_item(catalog, CatalogItemSpec("new", "Nuevo", sort=1), UserFactory())

    assert item.sort == 1


@pytest.fixture
def two_item_limit(monkeypatch):
    monkeypatch.setattr(services, "MAX_ACTIVE_ITEMS_PER_CATALOG", 2)


def test_create_item_beyond_the_active_limit_is_refused(two_item_limit) -> None:
    catalog = CatalogFactory()
    CatalogItemFactory.create_batch(2, catalog=catalog)

    with pytest.raises(CatalogItemLimitError):
        create_catalog_item(catalog, CatalogItemSpec("one-more", "Una mas"), UserFactory())


def test_inactive_items_do_not_count_toward_the_limit(two_item_limit) -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog)
    CatalogItemFactory(catalog=catalog, is_active=False)

    assert create_catalog_item(catalog, CatalogItemSpec("fits", "Cabe"), UserFactory())


def test_activate_beyond_the_active_limit_is_refused(two_item_limit) -> None:
    catalog = CatalogFactory()
    CatalogItemFactory.create_batch(2, catalog=catalog)
    inactive = CatalogItemFactory(catalog=catalog, is_active=False)

    with pytest.raises(CatalogItemLimitError):
        activate_catalog_item(inactive)

    inactive.refresh_from_db()
    assert inactive.is_active is False


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
        deactivate_catalog_item(other, UserFactory())

    other.refresh_from_db()
    assert other.is_active is True


def test_deactivate_a_regular_item() -> None:
    assert deactivate_catalog_item(CatalogItemFactory(), UserFactory()).is_active is False


def test_activate_a_deactivated_item() -> None:
    assert activate_catalog_item(CatalogItemFactory(is_active=False)).is_active is True


def test_deactivating_twice_is_harmless() -> None:
    item = CatalogItemFactory(is_active=False)

    assert deactivate_catalog_item(item, UserFactory()).is_active is False


@pytest.mark.parametrize("is_active", [False, True])
def test_matching_availability_version_writes_once_and_preserves_no_op_audit(is_active):
    catalog = CatalogFactory(revision=10)
    item = CatalogItemFactory(catalog=catalog, is_active=not is_active)
    author = UserFactory()

    def change(actor, version):
        if is_active:
            return activate_catalog_item(item, version=version)
        return deactivate_catalog_item(item, actor, version=version)

    written = change(author, 10)
    audit = (written.deactivated_at, written.deactivated_by_id, written.updated_at)
    repeated = change(UserFactory(), 11)

    assert written.is_active == repeated.is_active == is_active
    assert written.catalog.revision == repeated.catalog.revision == 11
    assert (repeated.deactivated_at, repeated.deactivated_by_id, repeated.updated_at) == audit
    item.refresh_from_db()
    catalog.refresh_from_db()
    assert (item.is_active, catalog.revision) == (is_active, 11)


@pytest.mark.parametrize("is_active", [False, True])
@pytest.mark.parametrize("is_no_op", [False, True])
def test_stale_availability_version_rejects_before_mutation_or_no_op(is_active, is_no_op):
    catalog = CatalogFactory(revision=10)
    item = CatalogItemFactory(catalog=catalog, is_active=is_active if is_no_op else not is_active)
    before = (item.is_active, item.deactivated_at, item.deactivated_by_id, item.updated_at)
    change = (
        partial(activate_catalog_item, item)
        if is_active
        else partial(deactivate_catalog_item, item, UserFactory())
    )

    with pytest.raises(CatalogVersionConflictError):
        change(version=9)

    item.refresh_from_db()
    catalog.refresh_from_db()
    assert (item.is_active, item.deactivated_at, item.deactivated_by_id, item.updated_at) == before
    assert catalog.revision == 10


def test_conditional_undo_cannot_replace_another_editors_aba_change():
    catalog = CatalogFactory(revision=10)
    item = CatalogItemFactory(catalog=catalog)
    first_editor, later_editor = UserFactory.create_batch(2)
    own_write = deactivate_catalog_item(item, first_editor, version=10)
    undo_version = own_write.catalog.revision
    activate_catalog_item(item)
    later = deactivate_catalog_item(item, later_editor)

    with pytest.raises(CatalogVersionConflictError):
        activate_catalog_item(item, version=undo_version)

    item.refresh_from_db()
    catalog.refresh_from_db()
    assert undo_version == 11
    assert catalog.revision == 13
    assert item.is_active is False
    assert (item.deactivated_at, item.deactivated_by_id, item.updated_at) == (
        later.deactivated_at,
        later_editor.pk,
        later.updated_at,
    )


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


def test_snapshot_version_is_stable_while_nothing_changes() -> None:
    catalog = CatalogFactory()
    CatalogItemFactory(catalog=catalog)

    first = build_catalog_snapshot(catalog.organization)["version"]

    assert build_catalog_snapshot(catalog.organization)["version"] == first


def test_snapshot_version_changes_when_a_label_changes() -> None:
    catalog = CatalogFactory()
    item = CatalogItemFactory(catalog=catalog)
    before = build_catalog_snapshot(catalog.organization)["version"]

    update_catalog_item(item, {"label_es": "Otro texto"})

    assert build_catalog_snapshot(catalog.organization)["version"] != before


def test_snapshot_version_changes_when_an_item_is_deactivated() -> None:
    catalog = CatalogFactory()
    item = CatalogItemFactory(catalog=catalog)
    before = build_catalog_snapshot(catalog.organization)["version"]

    deactivate_catalog_item(item, UserFactory())

    assert build_catalog_snapshot(catalog.organization)["version"] != before
