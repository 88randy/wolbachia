"""Operational safety rejects stale lifecycle, plan and later qualification facts."""

from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from geography.models import Block, Quadrant, SamplingPoint
from inventory.allocations.reconciliation import receipt_remaining
from inventory.models import StockOperation
from organizations.models import Center
from releases.handlers import _training
from releases.models import Release
from releases.services import append_permit_version, change_release_device_status, suspend_permit
from reviews.actions import ReviewDecisionRequest, decide_review
from reviews.exceptions import ReviewBlockedError
from reviews.models import ReviewItem
from scheduling.models import ScheduledTask, TaskOwnership
from tests.people_support import certify, people_context, require_training, training_version
from tests.releases_support import release_setup
from tests.test_inventory_transfers_106 import verified_upload

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def release_context(org_a, make_member, monkeypatch, settings, tmp_path):
    return release_setup(org_a, make_member, monkeypatch, settings, tmp_path)


@pytest.mark.parametrize("status", ["inactive", "retired"])
def test_release_handler_refuses_latest_equipment_status_before_consuming_custody(
    status,
    release_context,
):
    context = release_context
    change_release_device_status(
        context.actor,
        context.device.pk,
        {
            "status": status,
            "reason": "Equipment failed a regulatory inspection",
            "expected_revision": 1,
        },
    )
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    result = response.data["results"][0]
    assert result["status"] == "rejected"
    assert result["code"] == "release_device_unavailable"
    assert result["params"]["severity"] == "critical"
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_later_equipment_reactivation_cannot_authorize_an_inactive_capture(release_context):
    from releases.selectors import current_device_status

    context = release_context
    change_release_device_status(
        context.actor,
        context.device.pk,
        {
            "status": "inactive",
            "reason": "Equipment failed its original inspection",
            "expected_revision": 1,
        },
    )
    context.clock["now"] += timedelta(minutes=1)
    change_release_device_status(
        context.actor,
        context.device.pk,
        {
            "status": "active",
            "reason": "Equipment passed a later independent inspection",
            "expected_revision": 2,
        },
    )
    assert current_device_status(context.device) == "active"
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_device_unavailable"
    assert response.data["results"][0]["status"] == "rejected"
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_device_published_after_capture_cannot_retroactively_supply_equipment_authority(
    org_a,
    make_member,
    monkeypatch,
):
    from releases.handlers import _device
    from releases.services import create_release_device
    from tests.inventory_support import AT, allow_all, inventory_context
    from uploads.access import UploadActor

    clock = {"now": AT}
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock["now"])
    author, member = make_member(org_a, ("permit.manage",))
    allow_all(member)
    center = Center.objects.create(
        organization=org_a, created_by=author, code="LATE-C116", name="Synthetic center"
    )
    quadrant = Quadrant.objects.create(
        organization=org_a, created_by=author, center=center, code="LATE-Q116"
    )
    stock = inventory_context(org_a, make_member, biological=True, quadrant=quadrant)
    clock["now"] += timedelta(minutes=1)
    device = create_release_device(
        UploadActor(author, org_a),
        {
            "code": "LATE-DEVICE116",
            "quadrant_id": quadrant.pk,
            "source_lot_id": stock.lot.pk,
        },
    )
    captured = SimpleNamespace(organization=org_a, envelope=SimpleNamespace(device_time=AT))
    permit = SimpleNamespace(center_id=center.pk, quadrant_id=quadrant.pk)
    with pytest.raises(EventRejected) as refused:
        _device(captured, {"release_device_id": device.pk, "lot_id": stock.lot.pk}, permit)
    assert refused.value.code == "release_device_unavailable"


@pytest.mark.parametrize("mismatch", ["wrong_due_date", "other_courier", "foreign_task"])
def test_release_handler_refuses_a_task_outside_its_actual_plan(
    mismatch,
    release_context,
    org_b,
    make_member,
):
    from releases.planning import schedule_release

    context = release_context
    if mismatch == "wrong_due_date":
        plan = schedule_release(
            context.actor,
            context.permit.pk,
            {
                "point_id": context.point.pk,
                "courier_id": context.phone.user.pk,
                "due_date": context.task["due_date"] + timedelta(days=1),
                "expected_revision": 1,
            },
        )
        context.capture["payload"]["schedule_task_id"] = str(plan["task_id"])
    elif mismatch == "other_courier":
        user, _member = make_member(context.organization, ("field_event.sync",))
        TaskOwnership.objects.create(
            organization=context.organization,
            created_by=context.actor.user,
            task_id=context.task["task_id"],
            courier=user,
            revision=2,
        )
    else:
        user, _member = make_member(org_b)
        center = Center.objects.create(
            organization=org_b, created_by=user, code="FC116", name="Foreign center"
        )
        quadrant = Quadrant.objects.create(
            organization=org_b, created_by=user, center=center, code="FQ116"
        )
        block = Block.objects.create(
            organization=org_b, created_by=user, quadrant=quadrant, code="FB116"
        )
        point = SamplingPoint.objects.create(
            organization=org_b, created_by=user, block=block, code="FP116"
        )
        task = ScheduledTask.objects.create(
            organization=org_b,
            created_by=user,
            point=point,
            action="release",
            due_date=context.task["due_date"],
            rule_version_ids={},
        )
        context.capture["payload"]["schedule_task_id"] = str(task.pk)
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_schedule_invalid"
    assert response.data["results"][0]["status"] == "rejected"
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_release_handler_requires_the_plan_to_pin_the_actual_capture_permit_version(
    release_context,
):
    context = release_context
    original = context.permit_version
    append_permit_version(
        context.actor,
        context.permit.pk,
        {
            "type_id": original.type_id,
            "number": "Official successor to original plan",
            "authority": original.authority,
            "official_document_id": verified_upload(context.actor),
            "document_attestation": "Reviewed official successor regulation and geometry",
            "geometry": original.geometry,
            "valid_from": original.valid_from,
            "valid_to": original.valid_to,
            "expected_revision": 1,
        },
    )
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_schedule_invalid"
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


@pytest.mark.parametrize("blocker", ["suspension", "expiry"])
def test_current_regulatory_blocker_cannot_be_reviewed_into_original_offline_validity(
    blocker,
    release_context,
):
    context = release_context
    observed = context.phone.sync([context.capture])
    assert observed.status_code == 200, observed.data
    assert observed.data["results"][0]["code"] == "release_transit_review_required"
    if blocker == "suspension":
        suspend_permit(
            context.actor,
            context.permit.pk,
            {
                "reason": "Regulator suspended this release authority",
                "expected_revision": 1,
            },
        )
        code = "release_permit_suspended"
    else:
        context.clock["now"] = context.permit_version.valid_to
        code = "release_permit_expired"
    item = ReviewItem.objects.get(field_event_id=context.capture["id"])
    with pytest.raises(ReviewBlockedError) as refused:
        decide_review(
            context.reviewer,
            item.pk,
            ReviewDecisionRequest(
                "accept",
                0,
                "Attempted review retains original mandatory regulatory checks",
            ),
        )
    assert code in {reason["reason"] for reason in refused.value.blocked_by}
    source = FieldEvent.objects.get(pk=context.capture["id"])
    assert source.status == "in_review"
    assert source.status_code == "release_transit_review_required"
    assert not item.decisions.filter(is_terminal=True).exists()
    assert not Release.objects.exists()
    assert not StockOperation.objects.filter(source_kind="release_record").exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_a_later_backdated_certificate_cannot_fabricate_capture_time_qualification(
    org_a,
    make_member,
    monkeypatch,
    settings,
    tmp_path,
):
    context = people_context(org_a, make_member, monkeypatch, settings, tmp_path)
    course = training_version(context)
    require_training(context, course)
    captured_at = context.clock["now"] + timedelta(minutes=30)
    context.clock["now"] += timedelta(hours=1)
    certify(context, course, start=captured_at - timedelta(minutes=30))
    captured = SimpleNamespace(
        organization=org_a,
        user=context.phone.user,
        envelope=SimpleNamespace(device_time=captured_at),
    )
    permit = SimpleNamespace(center_id=context.center.pk, quadrant_id=context.quadrant.pk)
    with pytest.raises(EventRejected) as refused:
        _training(captured, {"training_version": course.pk}, permit)
    assert refused.value.code == "release_training_invalid"


@pytest.mark.parametrize("late_fact", ["task", "ownership"])
def test_later_planning_facts_cannot_retroactively_authorize_a_capture(
    late_fact, release_context, make_member
):
    from tests.releases_support import additional_release_task

    context = release_context
    if late_fact == "task":
        context.clock["now"] += timedelta(minutes=1)
        plan = additional_release_task(context, "LATE-PLAN")
        context.capture["payload"]["schedule_task_id"] = str(plan["task_id"])
    else:
        other, _member = make_member(context.organization, ("field_event.sync",))
        TaskOwnership.objects.create(
            organization=context.organization,
            created_by=context.actor.user,
            task_id=context.task["task_id"],
            courier=other,
            revision=2,
        )
        context.clock["now"] += timedelta(minutes=1)
        TaskOwnership.objects.create(
            organization=context.organization,
            created_by=context.actor.user,
            task_id=context.task["task_id"],
            courier=context.phone.user,
            revision=3,
        )
    response = context.phone.sync([context.capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_schedule_invalid"
    assert not Release.objects.exists()
    assert receipt_remaining(context.receipt_line) == Decimal("10")


def test_empty_regulatory_guard_reversals_are_safe_without_dropping_provenance():
    from importlib import import_module

    from django.apps import apps
    from django.db import connection

    editor = SimpleNamespace(connection=connection)
    for name in ("0002_release_guards", "0004_release_device_status_guard"):
        import_module(f"releases.migrations.{name}").refuse_populated_reverse(apps, editor)
    uuid_guard = import_module("releases.migrations.0005_semantic_source_uuids")
    uuid_guard.Migration.operations[-1].reverse_code(apps, editor)


def revoke_bootstrap(context):
    from tests.review_support import audit_current_membership

    profile = context.people.subject.profiles.get()
    profile.permission_codes = [
        code for code in profile.permission_codes if code != "field.bootstrap"
    ]
    profile.revision += 1
    profile.save(update_fields=["permission_codes", "revision"])
    audit_current_membership(context.people.subject)


def test_release_planning_refuses_an_owner_without_paired_bootstrap(release_context):
    from django.http import Http404

    from tests.releases_support import additional_release_task

    context = release_context
    revoke_bootstrap(context)
    before = ScheduledTask.objects.count()
    with pytest.raises(Http404):
        additional_release_task(context, "NO-BOOTSTRAP")
    assert ScheduledTask.objects.count() == before


def test_completion_does_not_publish_to_an_owner_after_bootstrap_is_revoked(release_context):
    from field_sync.models import CourierChange

    context = release_context
    response = context.phone.sync([context.capture])
    assert response.data["results"][0]["code"] == "release_transit_review_required"
    context.clock["now"] += timedelta(minutes=1)
    revoke_bootstrap(context)
    before = CourierChange.objects.filter(courier=context.phone.user, kind="assignments").count()
    item = ReviewItem.objects.get(field_event_id=context.capture["id"])
    decide_review(
        context.reviewer,
        item.pk,
        ReviewDecisionRequest(
            "accept",
            0,
            "Reviewed exact original transit evidence after publication permission loss",
        ),
    )
    assert Release.objects.filter(declared_event_id=context.capture["id"]).exists()
    assert (
        CourierChange.objects.filter(courier=context.phone.user, kind="assignments").count()
        == before
    )


def test_populated_regulatory_guard_reverse_refuses_before_official_records_are_removed(
    release_context,
):
    from importlib import import_module

    from django.apps import apps
    from django.db import connection
    from django.db.migrations.exceptions import IrreversibleError

    context = release_context
    editor = SimpleNamespace(connection=connection)
    guard = import_module("releases.migrations.0002_release_guards")
    with pytest.raises(IrreversibleError, match="provenance must be retained"):
        guard.refuse_populated_reverse(apps, editor)
    change_release_device_status(
        context.actor,
        context.device.pk,
        {
            "status": "inactive",
            "reason": "Keep actual equipment inspection facts",
            "expected_revision": 1,
        },
    )
    equipment = import_module("releases.migrations.0004_release_device_status_guard")
    with pytest.raises(IrreversibleError, match="lifecycle must be retained"):
        equipment.refuse_populated_reverse(apps, editor)
    uuid_guard = import_module("releases.migrations.0005_semantic_source_uuids")
    with pytest.raises(IrreversibleError, match="provenance must be retained"):
        uuid_guard.Migration.operations[-1].reverse_code(apps, editor)
    assert context.permit.versions.filter(pk=context.permit_version.pk).exists()
    assert context.device.statuses.count() == 1
