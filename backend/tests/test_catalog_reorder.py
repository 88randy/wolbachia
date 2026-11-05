"""Issue #182: conditional batch writes and catalog revisions."""

import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from django.db import connection

from catalogs.selectors import build_catalog_snapshot
from tests import test_catalog_api as api_fixtures
from tests.factories import CatalogFactory, CatalogItemFactory, UserFactory
from tests.test_catalog_api import items_url

admin = api_fixtures.admin
catalog = api_fixtures.catalog

pytestmark = pytest.mark.django_db


def reorder(admin, catalog, ids, *, version=0):
    return admin.post(
        items_url(catalog.slug, "reorder/"),
        {"version": version, "ordered_ids": [str(item_id) for item_id in ids]},
        format="json",
    )


def test_reorder_returns_full_order_preserving_inactive_and_other(admin, catalog):
    first, second, third = CatalogItemFactory.create_batch(3, catalog=catalog, sort=0)
    inactive = CatalogItemFactory(catalog=catalog, is_active=False, sort=15)
    other = CatalogItemFactory(catalog=catalog, is_other=True, code="other", sort=0)

    response = reorder(admin, catalog, [third.pk, first.pk, second.pk])

    assert response.status_code == 200
    catalog.refresh_from_db()
    assert response.data["version"] == catalog.revision == 1
    expected = [(third.pk, 10), (inactive.pk, 15), (first.pk, 20), (second.pk, 30), (other.pk, 0)]
    assert [(row["id"], row["sort"]) for row in response.data["items"]] == [
        (str(pk), sort) for pk, sort in expected
    ]
    assert all(
        "usage_count" in row and "created_by_username" in row for row in response.data["items"]
    )
    assert list(catalog.items.values_list("id", "sort")) == expected


def test_stale_reorder_conflicts_before_ids_validation_and_changes_nothing(admin, catalog):
    item = CatalogItemFactory(catalog=catalog, sort=7)
    catalog.revision = 3
    catalog.save(update_fields=["revision"])

    response = reorder(admin, catalog, [], version=2)

    assert (response.status_code, response.data["code"]) == (409, "catalog_version_conflict")
    item.refresh_from_db()
    catalog.refresh_from_db()
    assert (item.sort, catalog.revision) == (7, 3)


@pytest.mark.parametrize(
    "invalid",
    ["missing", "extra", "duplicate", "inactive", "other", "foreign_org", "foreign_catalog"],
)
def test_reorder_ids_mismatch_has_one_non_disclosing_error(admin, catalog, org_b, invalid):
    first, second = CatalogItemFactory.create_batch(2, catalog=catalog)
    ids = [first.pk, second.pk]
    if invalid == "missing":
        ids.pop()
    elif invalid == "extra":
        ids.append(uuid4())
    elif invalid == "duplicate":
        ids[1] = first.pk
    elif invalid in {"inactive", "other"}:
        ids.append(
            CatalogItemFactory(
                catalog=catalog, is_active=invalid != "inactive", is_other=invalid == "other"
            ).pk
        )
    else:
        foreign_catalog = CatalogFactory(
            organization=org_b if invalid == "foreign_org" else catalog.organization
        )
        ids.append(CatalogItemFactory(catalog=foreign_catalog).pk)
    before = list(catalog.items.values_list("id", "sort"))

    response = reorder(admin, catalog, ids)

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"] == {
        "ordered_ids": [{"code": "reorder_ids_mismatch", "params": {}}]
    }
    assert list(catalog.items.values_list("id", "sort")) == before
    catalog.refresh_from_db()
    assert catalog.revision == 0


def test_reorder_of_foreign_catalog_slug_is_404(admin, org_b):
    foreign = CatalogFactory(organization=org_b, slug="foreign")
    assert reorder(admin, foreign, []).status_code == 404


@pytest.mark.parametrize(
    "operation",
    [
        "create",
        "label_es",
        "label_en",
        "icon",
        "sort",
        "requires_photo",
        "deactivate",
        "activate",
        "reorder",
    ],
)
def test_every_item_write_bumps_catalog_version(admin, catalog, operation):
    item = CatalogItemFactory(catalog=catalog, is_active=operation != "activate")
    base = items_url(catalog.slug, f"{item.pk}/")
    if operation == "create":
        response = admin.post(
            items_url(catalog.slug), {"code": "new", "label_es": "New"}, format="json"
        )
    elif operation in {"activate", "deactivate"}:
        response = admin.post(f"{base}{operation}/")
    elif operation == "reorder":
        response = reorder(admin, catalog, [item.pk])
    else:
        value = {"sort": 11, "requires_photo": True}.get(operation, "changed")
        response = admin.patch(base, {operation: value}, format="json")

    assert response.status_code in {200, 201}
    assert admin.get("/api/v1/catalogs/").data["results"][0]["version"] == 1


def test_revision_is_not_part_of_field_snapshot_hash(admin, catalog):
    before = build_catalog_snapshot(catalog.organization)["version"]
    assert reorder(admin, catalog, []).status_code == 200
    assert build_catalog_snapshot(catalog.organization)["version"] == before


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_reorders_from_one_version_serialize_to_one_success():
    """Keep the winner uncommitted until the competing connection is observed waiting."""
    from queue import Queue
    from time import monotonic

    from django.db import transaction

    from catalogs.exceptions import CatalogVersionConflictError
    from catalogs.services import reorder_catalog_items

    catalog = CatalogFactory()
    first, second = CatalogItemFactory.create_batch(2, catalog=catalog, sort=0)
    author = UserFactory()

    ready = threading.Barrier(2, timeout=15)
    release_commit = threading.Event()
    backend_pids = Queue()

    def winner_uncommitted():
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '5s'")
                cursor.execute("SELECT pg_backend_pid()")
                backend_pids.put(("winner", cursor.fetchone()[0]))
            with transaction.atomic():
                result = reorder_catalog_items(catalog, 0, [second.pk, first.pk], author)
                ready.wait()
                assert release_commit.wait(15)
            return result[0]
        finally:
            connection.close()

    def stale_competitor():
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '5s'")
                cursor.execute("SELECT pg_backend_pid()")
                backend_pids.put(("competitor", cursor.fetchone()[0]))
            ready.wait()
            try:
                return reorder_catalog_items(catalog, 0, [first.pk, second.pk], author)[0]
            except CatalogVersionConflictError as error:
                return error.code, error.status_code
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        winner = executor.submit(winner_uncommitted)
        competitor = executor.submit(stale_competitor)
        try:
            pids = dict(backend_pids.get(timeout=15) for _ in range(2))
            deadline = monotonic() + 15
            with connection.cursor() as cursor:
                while monotonic() < deadline:
                    cursor.execute(
                        "SELECT %s = ANY(pg_blocking_pids(%s))",
                        [pids["winner"], pids["competitor"]],
                    )
                    if cursor.fetchone()[0]:
                        break
                else:
                    pytest.fail("The competing reorder never waited behind the uncommitted winner.")
        finally:
            release_commit.set()
            outcomes = [winner.result(timeout=15), competitor.result(timeout=15)]

    assert outcomes == [1, ("catalog_version_conflict", 409)]
    assert list(catalog.items.values_list("id", "sort")) == [(second.pk, 10), (first.pk, 20)]
    catalog.refresh_from_db()
    assert catalog.revision == 1


@pytest.mark.django_db
def test_seed_insert_invalidates_existing_plan_but_idempotent_rerun_does_not(admin, catalog):
    from catalogs.seeds import seed_default_catalogs

    seed_default_catalogs(catalog.organization)
    catalog.refresh_from_db()
    assert catalog.revision == 1  # The newly seeded Other changes this existing catalog.
    assert reorder(admin, catalog, [], version=0).status_code == 409
    seed_default_catalogs(catalog.organization)
    catalog.refresh_from_db()
    assert catalog.revision == 1
