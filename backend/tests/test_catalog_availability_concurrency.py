"""Issue280: actual catalog-lock arbitration and post-service response ownership."""

import threading
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from time import monotonic

import pytest
from django.db import connection, transaction

from catalogs import views
from catalogs.exceptions import CatalogVersionConflictError
from catalogs.services import deactivate_catalog_item, update_catalog_item
from tests import test_catalog_api as api_fixtures
from tests.factories import CatalogFactory, CatalogItemFactory, UserFactory
from tests.test_catalog_api import items_url

admin = api_fixtures.admin
catalog = api_fixtures.catalog


@pytest.mark.django_db(transaction=True)
def test_conditional_availability_has_one_winner_after_real_catalog_lock_wait():
    catalog = CatalogFactory()
    first, second = CatalogItemFactory.create_batch(2, catalog=catalog)
    untouched_at = second.updated_at
    author, competitor = UserFactory.create_batch(2)
    ready = threading.Barrier(2, timeout=15)
    release_commit = threading.Event()
    backend_pids = Queue()

    def identify(role):
        with connection.cursor() as cursor:
            cursor.execute("SET lock_timeout = '5s'")
            cursor.execute("SELECT pg_backend_pid()")
            backend_pids.put((role, cursor.fetchone()[0]))

    def winner_uncommitted():
        try:
            identify("winner")
            with transaction.atomic():
                result = deactivate_catalog_item(first, author, version=0)
                ready.wait()
                assert release_commit.wait(15)
            return result.is_active
        finally:
            connection.close()

    def stale_competitor():
        try:
            identify("competitor")
            ready.wait()
            try:
                deactivate_catalog_item(second, competitor, version=0)
            except CatalogVersionConflictError as error:
                return error.code, error.status_code
            return "unexpected_success"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        winner = executor.submit(winner_uncommitted)
        loser = executor.submit(stale_competitor)
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
                    pytest.fail("The conditional action never waited behind the catalog winner.")
        finally:
            release_commit.set()
            outcomes = [winner.result(timeout=15), loser.result(timeout=15)]

    assert outcomes == [False, ("catalog_version_conflict", 409)]
    first.refresh_from_db()
    second.refresh_from_db()
    catalog.refresh_from_db()
    assert (first.is_active, first.deactivated_by_id) == (False, author.pk)
    assert (second.is_active, second.deactivated_at, second.deactivated_by_id) == (True, None, None)
    assert second.updated_at == untouched_at
    assert catalog.revision == 1


@pytest.mark.django_db(transaction=True)
def test_availability_response_keeps_its_version_after_another_committed_writer(
    admin, catalog, monkeypatch
):
    item, another = CatalogItemFactory.create_batch(2, catalog=catalog)
    service_finished = threading.Event()
    release_response = threading.Event()
    real_service = views.deactivate_catalog_item

    def held_service(target, user, version=None):
        result = real_service(target, user, version=version)
        # Do not access result.catalog here: that would hide the original lazy-read race.
        assert not connection.in_atomic_block
        service_finished.set()
        assert release_response.wait(15)
        return result

    monkeypatch.setattr(views, "deactivate_catalog_item", held_service)

    def request():
        try:
            return admin.post(
                items_url(catalog.slug, f"{item.pk}/deactivate/"),
                {"version": 0},
                format="json",
            )
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        pending_response = executor.submit(request)
        try:
            assert service_finished.wait(15)
            update_catalog_item(another, {"label_es": "Another editor's committed label"})
            catalog.refresh_from_db()
            assert catalog.revision == 2
        finally:
            release_response.set()
        response = pending_response.result(timeout=15)

    assert response.status_code == 200
    assert (response.data["is_active"], response.data["catalog_version"]) == (False, 1)
    assert response.data["deactivated_by"] is not None
