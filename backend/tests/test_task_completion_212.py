"""Task completion delivery follows operational effects, ownership and paired scope."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
from threading import Event

import pytest
from django.db import close_old_connections, transaction
from django.utils import timezone

from field_sync.cursor import decode_cursor
from field_sync.exceptions import SyncInProgressError
from field_sync.models import CourierChange, FieldEvent
from field_sync.services import bootstrap_bundle, lock_courier_batches, sync_batch
from organizations.models import Membership
from ovitraps.models import Ovitrap
from scheduling.models import ScheduledTask, TaskOwnership
from tests.ovitrap_support import CAPTURED, envelope, ingest, second_courier, setup_field


@pytest.fixture
def field(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    field = setup_field()
    field.profile.permission_codes += ["field.bootstrap"]
    field.profile.save(update_fields=["permission_codes"])
    return field


def owned_task(field, owner, action):
    task = ScheduledTask.objects.create(
        organization=field.batch.organization,
        point=field.point,
        action=action,
        due_date=CAPTURED.date(),
    )
    # A quadrant's new courier must not replace this task's explicit retained owner.
    TaskOwnership.objects.create(
        organization=field.batch.organization, task=task, courier=field.batch.user, revision=1
    )
    TaskOwnership.objects.create(
        organization=field.batch.organization, task=task, courier=owner.user, revision=2
    )
    return task


def task_changes(batch, cursor):
    position = decode_cursor(cursor, batch.organization.pk, batch.user.pk)
    return sync_batch(batch, [], position).changes.assignments


def void_event(field, target, **overrides):
    return envelope(
        field,
        "record.void",
        payload={"reason_code": "other", "reason": "Incorrect field capture"},
        voids_event_id=target.id,
        **overrides,
    )


@pytest.mark.django_db
@pytest.mark.parametrize("action", ["place", "check"])
def test_other_courier_receives_completed_and_reopened_task_once(field, action):
    if action == "check":
        assert ingest(field, envelope(field)).status == "accepted"
    owner = second_courier(field)
    unrelated = second_courier(field)
    task = owned_task(field, owner, action)
    before = bootstrap_bundle(owner)
    initial = next(row for row in before["assignments"] if row["id"] == str(task.pk))
    assert initial["is_completed"] is False
    # 01:00 UTC is still the previous local date, matching the task's local due date.
    captured_at = CAPTURED.replace(hour=1) + timedelta(days=1)
    capture = envelope(field, f"ovitrap.{action}", device_time=captured_at)
    assert ingest(field, capture).status == "accepted"
    assert ingest(field, capture).status == "accepted"
    completed = task_changes(owner, before["cursor"])
    assert len(completed) == 1
    assert completed[0]["resource_id"] == str(task.pk)
    assert completed[0]["data"] == {**initial, "is_completed": True}
    assert bootstrap_bundle(owner)["assignments"] == [completed[0]["data"]]
    correction = void_event(field, capture, device_time=captured_at + timedelta(days=1))
    assert ingest(field, correction).status == "accepted"
    assert ingest(field, correction).status == "accepted"
    delivered = task_changes(owner, before["cursor"])
    assert [row["data"]["is_completed"] for row in delivered] == [True, False]
    assert delivered[0]["resource_version"] != delivered[1]["resource_version"]
    assert bootstrap_bundle(owner)["assignments"] == [initial]
    assert set(
        CourierChange.objects.filter(kind="assignments").values_list("courier_id", flat=True)
    ) == {owner.user.pk}
    assert not CourierChange.objects.filter(courier=unrelated.user, kind="assignments").exists()
    source = FieldEvent.objects.get(pk=capture.id)
    assert source.status == "accepted"
    assert source.payload == capture.payload


@pytest.mark.django_db
def test_void_keeps_task_complete_when_another_same_date_placement_remains(field):
    from types import SimpleNamespace
    from uuid import uuid4

    from tests.test_ovitraps_lifecycle_b_15 import lifecycle

    owner = second_courier(field)
    owned_task(field, owner, "place")
    assert ingest(field, envelope(field)).status == "accepted"
    assert ingest(field, lifecycle(field, "remove")).status == "accepted"
    replacement_field = SimpleNamespace(**{**vars(field), "identity": uuid4()})
    capture = envelope(replacement_field)
    assert ingest(replacement_field, capture).status == "accepted"
    before = bootstrap_bundle(owner)
    assert ingest(replacement_field, void_event(replacement_field, capture)).status == "accepted"
    changes = task_changes(owner, before["cursor"])
    assert [row["data"]["is_completed"] for row in changes] == [True]
    assert bootstrap_bundle(owner)["assignments"][0]["is_completed"] is True


@pytest.mark.django_db
@pytest.mark.parametrize("action", ["place", "check"])
def test_review_capture_and_review_void_do_not_change_task_completion(field, action):
    if action == "check":
        assert ingest(field, envelope(field)).status == "accepted"
    owner = second_courier(field)
    task = owned_task(field, owner, action)
    before = bootstrap_bundle(owner)
    doubtful = envelope(field, f"ovitrap.{action}", gps=None)
    assert ingest(field, doubtful).status == "in_review"
    assert task_changes(owner, before["cursor"]) == []
    assert ingest(field, void_event(field, doubtful)).status == "accepted"
    assert task_changes(owner, before["cursor"]) == []
    capture = envelope(field, f"ovitrap.{action}")
    assert ingest(field, capture).status == "accepted"
    # Final upload is retained for review; it must leave the accepted effect intact.
    correction = void_event(field, capture)
    reviewed_batch = replace(field.batch, is_final_upload=True)
    assert sync_batch(reviewed_batch, [correction], None).results[0].status == "in_review"
    assert [row["data"]["is_completed"] for row in task_changes(owner, before["cursor"])] == [True]
    assert FieldEvent.objects.get(pk=capture.id).voided_at is None
    assert bootstrap_bundle(owner)["assignments"][0]["id"] == str(task.pk)


@pytest.mark.django_db
@pytest.mark.parametrize("exclusion", ["unpaired_scope", "inactive", "sync_only"])
def test_task_completion_does_not_leak_to_an_unauthorized_owner(field, exclusion):
    from tests.factories import ProfileFactory

    owner = second_courier(field)
    owned_task(field, owner, "place")
    member = Membership.objects.get(user=owner.user, organization=owner.organization)
    if exclusion == "unpaired_scope":
        center = str(field.point.center_id)
        quadrant = str(field.point.quadrant_id)
        grants = [
            {
                "centers": {"mode": "selected", "ids": [center]},
                "quadrants": {"mode": "none", "ids": []},
            },
            {
                "centers": {"mode": "none", "ids": []},
                "quadrants": {"mode": "selected", "ids": [quadrant]},
            },
        ]
        member.profiles.set(
            [
                ProfileFactory(
                    organization=owner.organization,
                    scope=scope,
                    permission_codes=["field.bootstrap"],
                )
                for scope in grants
            ]
        )
    elif exclusion == "inactive":
        member.is_active = False
        member.save(update_fields=["is_active"])
    else:
        member.profiles.set(
            [ProfileFactory(organization=owner.organization, permission_codes=["field_event.sync"])]
        )
    assert ingest(field, envelope(field)).status == "accepted"
    assert not CourierChange.objects.filter(kind="assignments").exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("operation", ["capture", "void"])
def test_busy_task_owner_rolls_back_effect_and_feed_until_same_uuid_retry(field, operation):
    owner = second_courier(field)
    owned_task(field, owner, "place")
    capture = envelope(field)
    if operation == "void":
        assert ingest(field, capture).status == "accepted"
    pending = capture if operation == "capture" else void_event(field, capture)
    before = set(CourierChange.objects.values_list("pk", flat=True))
    locked, release = Event(), Event()

    def hold_owner():
        close_old_connections()
        try:
            with transaction.atomic():
                lock_courier_batches(owner)
                locked.set()
                assert release.wait(10)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        holder = pool.submit(hold_owner)
        try:
            assert locked.wait(10)
            with pytest.raises(SyncInProgressError):
                ingest(field, pending)
            assert set(CourierChange.objects.values_list("pk", flat=True)) == before
            assert not FieldEvent.objects.filter(pk=pending.id).exists()
            if operation == "capture":
                assert not Ovitrap.objects.exists()
            else:
                assert FieldEvent.objects.get(pk=capture.id).voided_at is None
        finally:
            release.set()
            holder.result(timeout=10)
    assert ingest(field, pending).status == "accepted"
