"""Real signed custody, manual review and release replay share the single ledger."""

from decimal import Decimal
from uuid import uuid4

import pytest

from field_sync.models import FieldEvent
from inventory.allocations.reconciliation import receipt_remaining
from inventory.allocations.stock import assignment_balance
from inventory.models import StockMovement, StockOperation
from releases.models import Release
from reviews.actions import ReviewDecisionRequest, decide_review
from reviews.exceptions import ReviewBlockedError
from reviews.models import ReviewItem
from tests.releases_support import (
    accept_release,
    additional_release_task,
    release_capture,
    release_setup,
)
from tests.sync_support import event

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def release_context(org_a, make_member, monkeypatch, settings, tmp_path):
    return release_setup(org_a, make_member, monkeypatch, settings, tmp_path)


def test_release_review_consumes_one_real_receipt_once_and_keeps_original_result(release_context):
    context = release_context
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_transit_review_required"
    assert not Release.objects.exists()
    assert not StockOperation.objects.filter(source_kind="release_record").exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")
    released = accept_release(context)
    operation = StockOperation.objects.get(release=released)
    movement = StockMovement.objects.get(operation=operation)
    assert operation.release_receipt_line == context.receipt_line
    assert movement.quantity == Decimal("-2")
    assert movement.assignment == context.assignment
    assert movement.lot == context.lot
    assert receipt_remaining(context.receipt_line) == Decimal("8")
    assert assignment_balance(context.receipt_line) == Decimal("8")
    assert released.provenance["stock"]["transit_policy_id"] == str(context.transit_policy.pk)
    detail = context.phone.client.get(f"/api/v1/releases/{released.pk}/")
    assert detail.status_code == 200, detail.data
    assert detail.data["blocked_by"] == []
    assert detail.data["provenance"]["permit_version"] == str(context.permit_version.pk)
    replay = context.phone.sync([context.capture])
    assert replay.data["results"] == response.data["results"]
    assert Release.objects.count() == 1
    assert StockOperation.objects.filter(source_kind="release_record").count() == 1
    assert FieldEvent.objects.get(pk=context.capture["id"]).status == "in_review"


def test_second_release_cannot_spend_the_same_credited_custody(release_context):
    context = release_context
    first = release_capture(context, quantity="8")
    accept_release(context, first)
    planned = additional_release_task(context, "R116-SECOND")
    second = release_capture(context, quantity="3", task_id=planned["task_id"])
    response = context.phone.sync([second])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_stock_unavailable"
    assert receipt_remaining(context.receipt_line) == Decimal("2")
    assert StockOperation.objects.filter(source_kind="release_record").count() == 1


def test_release_review_rechecks_current_lot_expiry_before_consumption(release_context):
    context = release_context
    response = context.phone.sync([context.capture])
    assert response.data["results"][0]["code"] == "release_transit_review_required"
    item = ReviewItem.objects.get(field_event_id=context.capture["id"])
    # No lot/configuration changes: only real current time crosses retained expiry.
    context.clock["now"] = context.stock.version.expires_at
    with pytest.raises(ReviewBlockedError) as blocked:
        decide_review(
            context.reviewer,
            item.pk,
            ReviewDecisionRequest(
                "accept",
                0,
                "Reviewed exact retained transit photos after expiry",
            ),
        )
    assert "release_lot_blocked" in {reason["reason"] for reason in blocked.value.blocked_by}
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_release_dependency_prevents_voiding_its_source_receipt(release_context):
    context = release_context
    accept_release(context)
    correction = event(
        id=str(uuid4()),
        type="record.void",
        voids_event_id=context.receipt_capture["id"],
        payload={"reason_code": "other", "reason": "Attempted correction retains physical release"},
    )
    response = context.phone.sync([correction])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "supply_void_blocked"
    assert FieldEvent.objects.get(pk=context.receipt_capture["id"]).voided_at is None
    assert receipt_remaining(context.receipt_line) == Decimal("8")


@pytest.mark.parametrize("has_effect", [False, True])
def test_release_correction_preserves_physical_consumption_and_can_cancel_unapplied_source(
    has_effect, release_context
):
    context = release_context
    if has_effect:
        accept_release(context)
    else:
        response = context.phone.sync([context.capture])
        assert response.data["results"][0]["code"] == "release_transit_review_required"
    correction = event(
        type="record.void",
        voids_event_id=context.capture["id"],
        payload={"reason_code": "other", "reason": "Correct original captured release declaration"},
    )
    response = context.phone.sync([correction])
    assert response.status_code == 200, response.data
    source = FieldEvent.objects.get(pk=context.capture["id"])
    if has_effect:
        assert response.data["results"][0]["code"] == "release_void_blocked"
        assert source.voided_at is None
        assert receipt_remaining(context.receipt_line) == Decimal("8")
        assert Release.objects.count() == 1
    else:
        assert response.data["results"][0]["status"] == "accepted", response.data
        assert source.voided_at is not None
        assert source.status == "in_review"
        assert receipt_remaining(context.receipt_line) == Decimal("10")
        assert not Release.objects.exists()


def test_later_lot_expiry_extension_cannot_authorize_an_expired_device_source(release_context):
    from datetime import timedelta

    from inventory.services import LotChange, revise_lot

    context = release_context
    source_expiry = context.stock.version.expires_at
    revise_lot(
        LotChange(
            context.actor,
            {
                "expires_at": source_expiry + timedelta(hours=1),
            },
            context.lot.pk,
            context.stock.version.revision,
        )
    )
    context.capture["device_time"] = source_expiry.isoformat()
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_lot_blocked"
    assert response.data["results"][0]["params"]["reason"] == "lot_expired"
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_sql_release_completion_refuses_a_debit_that_differs_from_its_source(release_context):
    from django.db import DatabaseError, connection, transaction

    from field_sync.envelope import describe_payload
    from scheduling.models import ScheduledTask
    from tests.factories import FieldEventFactory

    context = release_context
    released = accept_release(context)
    original = FieldEvent.objects.get(pk=context.capture["id"])
    planned = additional_release_task(context, "R116-SQL")
    task = ScheduledTask.objects.get(pk=planned["task_id"])
    payload = {**original.payload, "schedule_task_id": str(task.pk)}
    payload_hash = describe_payload(payload).sha256
    provenance = {
        **released.provenance,
        "source_payload_hash": payload_hash,
        "schedule": {
            "task_id": str(task.pk),
            "plan_id": str(task.release_schedule.pk),
            "capture_owner_id": str(task.ownerships.get().pk),
            "permit_version_id": str(task.release_schedule.permit_version_id),
        },
    }
    with pytest.raises(DatabaseError, match="same-custodian debit"), transaction.atomic():  # noqa: PT012 -- the deferred guard validates the whole candidate transaction
        source = FieldEventFactory(
            organization=context.organization,
            created_by=context.phone.user,
            device=original.device,
            type="release.record",
            schema_version=1,
            payload=payload,
            payload_sha256=payload_hash,
            device_time=original.device_time,
            server_received_at=original.server_received_at,
            rules_version=original.rules_version,
            catalog_version=original.catalog_version,
            gps_lat=original.gps_lat,
            gps_lng=original.gps_lng,
            gps_accuracy_m=original.gps_accuracy_m,
            shift_id=original.shift_id,
            status="accepted",
        )
        duplicate = Release.objects.create(
            code="LIB-9999",
            organization=context.organization,
            created_by=context.phone.user,
            declared_event_id=source.pk,
            permit_version=released.permit_version,
            lot=context.lot,
            release_device=context.device,
            training_version=context.training_version,
            schedule_task=task,
            quantity=released.quantity,
            location=released.location,
            device_time=source.device_time,
            server_received_at=source.server_received_at,
            provenance=provenance,
        )
        previous = released.stock_operation
        operation = StockOperation.objects.create(
            organization=context.organization,
            created_by=context.phone.user,
            release=duplicate,
            release_receipt_line=context.receipt_line,
            source_kind="release_record",
            source_id=duplicate.pk,
            content_hash=previous.content_hash,
        )
        movement = previous.movements.get()
        StockMovement.objects.create(
            organization=context.organization,
            created_by=context.phone.user,
            operation=operation,
            line_number=1,
            lot=context.lot,
            unit_version=movement.unit_version,
            assignment=context.assignment,
            quantity=-1,
        )
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
    assert StockOperation.objects.filter(source_kind="release_record").count() == 1
