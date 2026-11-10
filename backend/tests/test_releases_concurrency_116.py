"""Control both commit orders; real PostgreSQL locks govern suspension and consumption."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from django.db import close_old_connections

from field_sync.exceptions import SyncInProgressError
from inventory.models import StockOperation
from releases.models import PermitSuspension, Release
from releases.services import suspend_permit
from tests.releases_support import accept_release, release_setup

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def release_context(org_a, make_member, monkeypatch, settings, tmp_path):
    return release_setup(org_a, make_member, monkeypatch, settings, tmp_path)


def _isolated(job):
    close_old_connections()
    try:
        return job()
    finally:
        close_old_connections()


def test_suspension_commit_prevents_sync_retry_from_applying_release(release_context, monkeypatch):
    from releases import producers

    context = release_context
    locked, finish = Event(), Event()
    original = producers.publish_permit

    def held_publication(permit):
        original(permit)
        locked.set()
        assert finish.wait(15), "suspension test did not release the commit barrier"

    monkeypatch.setattr(producers, "publish_permit", held_publication)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            _isolated,
            lambda: suspend_permit(
                context.actor,
                context.permit.pk,
                {
                    "expected_revision": 1,
                    "reason": "Official suspension before field synchronization",
                },
            ),
        )
        try:
            assert locked.wait(15), "suspension never reached its commit barrier"
            response = context.phone.sync([context.capture])
            assert response.status_code == 429, response.data
            assert not Release.objects.exists()
        finally:
            finish.set()
        future.result(timeout=15)
    retry = context.phone.sync([context.capture])
    assert retry.status_code == 200, retry.data
    assert retry.data["results"][0]["code"] == "release_permit_suspended"
    assert retry.data["results"][0]["status"] == "rejected"
    assert not StockOperation.objects.filter(source_kind="release_record").exists()


def test_release_commit_is_consumed_once_before_retrying_contended_suspension(
    release_context, monkeypatch
):
    from releases import stock

    context = release_context
    locked, finish = Event(), Event()
    original = stock.append_release_stock

    def held_debit(release, pin):
        operation = original(release, pin)
        locked.set()
        assert finish.wait(15), "release test did not release the commit barrier"
        return operation

    monkeypatch.setattr(stock, "append_release_stock", held_debit)
    values = {
        "expected_revision": 1,
        "reason": "Official suspension after committed physical release",
    }
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_isolated, lambda: accept_release(context))
        try:
            assert locked.wait(15), "release never reached its commit barrier"
            with pytest.raises(SyncInProgressError):
                suspend_permit(context.actor, context.permit.pk, values)
        finally:
            finish.set()
        released = future.result(timeout=15)
    suspend_permit(context.actor, context.permit.pk, values)
    replay = context.phone.sync([context.capture])
    assert replay.status_code == 200, replay.data
    assert replay.data["results"][0]["status"] == "in_review"
    assert Release.objects.get().pk == released.pk
    assert StockOperation.objects.filter(source_kind="release_record").count() == 1
    assert PermitSuspension.objects.count() == 1
