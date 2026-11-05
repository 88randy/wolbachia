"""A deactivation already holding the catalog item must win over a later void."""

import threading
import uuid
from time import monotonic

import pytest
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from catalogs.models import CatalogItem
from catalogs.services import deactivate_catalog_item
from core.services import void_record
from core.validation import flatten_error_details
from field_sync.envelope import BatchContext, EventEnvelope, describe_payload
from field_sync.models import FieldEvent
from field_sync.services import sync_batch
from tests.factories import FieldEventFactory, UserFactory, WidgetFactory
from tests.sync_support import run_in_threads

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.usefixtures("void_catalog")]


def run_during_deactivation(item, void):
    """Commit only once PostgreSQL observes the waiter, or a broken writer finishes early.

    The barrier starts the void after the item is changed but before it commits. Polling the
    actual blocker proves the void waited; the completion event also makes the old, unlocked
    implementation fail promptly instead of hanging at a barrier it can never reach.
    """
    ready = threading.Barrier(2, timeout=10)
    finished = threading.Event()
    waiter_pids = []

    def deactivate():
        with transaction.atomic():
            deactivate_catalog_item(item)
            ready.wait()
            deadline = monotonic() + 10
            with connection.cursor() as cursor:
                while not finished.is_set():
                    cursor.execute(
                        "SELECT pg_backend_pid() = ANY(pg_blocking_pids(%s))", waiter_pids
                    )
                    if cursor.fetchone()[0]:
                        return True
                    assert monotonic() < deadline, "the void neither waited nor finished"
        return False

    def void_after_item_is_locked():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_backend_pid()")
            waiter_pids.append(cursor.fetchone()[0])
        ready.wait()
        try:
            return void()
        finally:
            finished.set()

    return run_in_threads(deactivate, void_after_item_is_locked)


def test_void_record_waits_for_deactivation_and_refuses_the_inactive_code(org_a):
    target = WidgetFactory(organization=org_a)
    user = UserFactory()
    item = CatalogItem.objects.get(
        organization=org_a, catalog__slug="void-reason", code="duplicate-record"
    )

    waited, result = run_during_deactivation(item, lambda: void_record(target, user, "", item.code))

    assert isinstance(result, ValidationError), result
    assert flatten_error_details(result.get_full_details())["reason_code"][0]["code"] == (
        "void_reason_code_unknown"
    )
    assert waited is True, waited
    target.refresh_from_db()
    assert (target.voided_at, target.voided_by_id, target.void_reason, target.void_reason_code) == (
        None,
        None,
        "",
        "",
    )


def test_sync_void_waits_for_deactivation_and_keeps_the_target_intact(org_a):
    target = FieldEventFactory(organization=org_a)
    item = CatalogItem.objects.get(
        organization=org_a, catalog__slug="void-reason", code="duplicate-record"
    )
    now = timezone.now()
    batch = BatchContext(org_a, target.created_by, target.device, now, now)
    payload = {"reason_code": item.code}
    envelope = EventEnvelope(
        index=0,
        id=uuid.uuid4(),
        type="record.void",
        schema_version=1,
        device_time=now,
        payload=payload,
        payload_info=describe_payload(payload),
        rules_version="rules-1",
        catalog_version="catalog-1",
        manual_capture=False,
        voids_event_id=target.pk,
    )

    waited, outcome = run_during_deactivation(item, lambda: sync_batch(batch, [envelope], None))

    assert not isinstance(outcome, Exception), outcome
    result = outcome.results[0]
    assert (result.status, result.code) == ("in_review", "void_reason_code_deactivated")
    assert waited is True, waited
    stored = FieldEvent.objects.get(pk=envelope.id)
    assert (stored.status, stored.status_code, stored.voids_event_id) == (
        "in_review",
        "void_reason_code_deactivated",
        target.pk,
    )
    target.refresh_from_db()
    assert (target.voided_at, target.voided_by_id, target.void_reason, target.void_reason_code) == (
        None,
        None,
        "",
        "",
    )
