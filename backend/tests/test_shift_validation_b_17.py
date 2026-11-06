"""Closed-shift gate and actual typed observation delivery, including current vector scope."""

import pytest

from field_sync.models import CourierChange
from reviews.exceptions import ReviewBlockedError, ReviewConflictError
from reviews.models import HistoryPublicationReceipt, ShiftDecision
from shifts.validation import ShiftDecisionRequest, decide_shift
from tests.factories import ShiftFactory
from tests.review_support import reviewer


@pytest.mark.django_db
def test_open_shift_cannot_be_approved_or_observed(org_a, make_member):
    shift = ShiftFactory(organization=org_a)
    actor = reviewer(org_a, make_member)
    for kind in ("approve", "observe"):
        with pytest.raises(ReviewBlockedError):
            decide_shift(actor, shift.pk, ShiftDecisionRequest(kind, 0, "The frame is still open"))
    assert not ShiftDecision.objects.filter(shift=shift).exists()


@pytest.mark.django_db
def test_closed_approval_is_an_audit_and_later_captured_source_invalidates_it(org_a, make_member):
    from dataclasses import replace
    from datetime import timedelta

    from django.utils import timezone

    from field_sync.envelope import BatchContext, describe_payload
    from field_sync.services import sync_batch
    from shifts.validation import validation_projection
    from tests.fleet_support import grant_fleet_scope
    from tests.ovitrap_support import envelope, setup_field
    from tests.review_support import audit_current_membership

    field = setup_field()
    grant_fleet_scope((field.batch.user, field.membership))
    audit_current_membership(field.membership)
    shift = ShiftFactory(
        organization=field.batch.organization,
        is_closed=True,
        courier=field.batch.user,
        device=field.batch.device,
    )
    actor = reviewer(field.batch.organization, make_member)
    first = decide_shift(
        actor, shift.pk, ShiftDecisionRequest("approve", 0, "Verified entire closed frame")
    )
    assert validation_projection(shift)["approval_current"] is True
    # The old field capture has now arrived after the reviewer saw the frame.
    captured = shift.closed_at_device + timedelta(microseconds=1)
    payload = envelope(field).payload
    late = replace(
        envelope(field),
        shift_id=shift.pk,
        device_time=captured,
        payload=payload,
        payload_info=describe_payload(payload),
    )
    now = timezone.now()
    batch = BatchContext(shift.organization, shift.courier, shift.device, captured, now)
    assert sync_batch(batch, [late], None).results[0].status == "in_review"
    projection = validation_projection(shift)
    assert projection["approval_current"] is False
    assert "unresolved_shift_review" in projection["blockers"]
    with pytest.raises(ReviewBlockedError):
        decide_shift(actor, shift.pk, ShiftDecisionRequest("approve", 1, "Unresolved new capture"))
    assert ShiftDecision.objects.filter(shift=shift).count() == 1
    assert HistoryPublicationReceipt.objects.filter(cause_id=first.pk).count() == 1
    shift.refresh_from_db()
    assert shift.status == "closed"


@pytest.mark.django_db
@pytest.mark.parametrize("reviewed", [False, True])
def test_void_invalidates_real_target_frame_and_own_other_frame_once_in_feed_and_bootstrap(
    make_member, reviewed
):
    from dataclasses import replace
    from datetime import timedelta

    from django.utils import timezone

    from field_sync.cursor import ChangesCursor
    from field_sync.envelope import describe_payload
    from field_sync.models import FieldEvent
    from field_sync.services import bootstrap_bundle, sync_batch
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewEffectReceipt, ReviewItem
    from shifts.validation import validation_projection
    from tests.ovitrap_support import envelope, setup_field
    from tests.review_support import audit_current_membership
    from tests.sync_support import configure_clock_skew

    field = setup_field()
    field.profile.permission_codes.append("field.bootstrap")
    field.profile.save(update_fields=["permission_codes"])
    audit_current_membership(field.membership)
    configure_clock_skew(field.batch.organization)
    frame = ShiftFactory(
        organization=field.batch.organization,
        is_closed=True,
        courier=field.batch.user,
        device=field.batch.device,
    )
    target = replace(envelope(field), shift_id=frame.pk, device_time=frame.closed_at_device)
    now = timezone.now()
    current = replace(field.batch, sent_at=now, received_at=now)
    assert sync_batch(current, [target], None).results[0].status == "accepted"
    actor = reviewer(field.batch.organization, make_member)
    approved = [
        decide_shift(
            actor, frame.pk, ShiftDecisionRequest("approve", 0, "Verified actual original frame")
        )
    ]
    other = None
    if reviewed:
        other = ShiftFactory(
            organization=frame.organization,
            is_closed=True,
            courier=frame.courier,
            device=frame.device,
        )
        approved.append(
            decide_shift(
                actor,
                other.pk,
                ShiftDecisionRequest("approve", 0, "Verified distinct correction frame"),
            )
        )
    original_change = CourierChange.objects.get(history_receipt__cause_id=approved[0].pk)
    original_payload = original_change.payload
    payload = {
        "reason_code": "other",
        "reason": "Correct exact original placement after frame approval",
    }
    correction = replace(
        envelope(field, "record.void"),
        device_time=timezone.now(),
        shift_id=None if other is None else other.pk,
        voids_event_id=target.id,
        payload=payload,
        payload_info=describe_payload(payload),
    )
    now = timezone.now()
    sending = replace(
        current, sent_at=now - timedelta(hours=1) if reviewed else now, received_at=now
    )
    result = sync_batch(sending, [correction], None).results[0]
    if reviewed:
        assert result.status == "in_review"
        assert validation_projection(frame)["approval_current"] is True
        item = ReviewItem.objects.get(field_event_id=correction.id)
        decision = decide_review(
            actor,
            item.pk,
            ReviewDecisionRequest(
                "accept", 0, "Verified original correction context and authority"
            ),
        )
        assert ReviewEffectReceipt.objects.filter(decision=decision).count() == 1
    else:
        assert result.status == "accepted"
    pulled = sync_batch(current, [], ChangesCursor()).changes.history
    bootstrap = bootstrap_bundle(current)["history"]
    for approval in approved:
        assert validation_projection(approval.shift)["approval_current"] is False
        changes = [row["data"] for row in pulled if row["data"]["id"] == str(approval.pk)]
        assert [row["approval_current"] for row in changes] == [True, False]
        assert (
            next(row for row in bootstrap if row["id"] == str(approval.pk))["approval_current"]
            is False
        )
        assert (
            HistoryPublicationReceipt.objects.filter(
                resource_id=approval.pk, cause_kind="shift_review_invalidated"
            ).count()
            == 1
        )
    assert sync_batch(sending, [correction], None).results[0] == result
    assert HistoryPublicationReceipt.objects.filter(resource_id=approved[0].pk).count() == 2
    source = FieldEvent.objects.get(pk=correction.id)
    actual_target = FieldEvent.objects.get(pk=target.id)
    assert source.voids_event_id == target.id
    assert source.shift_id == (None if other is None else other.pk)
    assert source.status == result.status
    assert actual_target.voided_at is not None
    assert actual_target.status == "accepted"
    original_change.refresh_from_db()
    assert original_change.payload == original_payload
    frame.refresh_from_db()
    assert frame.status == "closed"


@pytest.mark.django_db
def test_observation_is_one_real_courier_change_and_stale_retry_is_conflict(org_a, make_member):
    from django.utils import timezone

    from field_sync.cursor import ChangesCursor, decode_cursor
    from field_sync.envelope import BatchContext
    from field_sync.services import bootstrap_bundle, sync_batch
    from tests.fleet_support import grant_fleet_scope

    shift = ShiftFactory(organization=org_a, is_closed=True)
    grant_fleet_scope(
        make_member(org_a, ("field_event.sync", "field.bootstrap"), user=shift.courier)
    )
    actor = reviewer(org_a, make_member)
    request = ShiftDecisionRequest("observe", 0, "Please explain the captured fuel interval")
    decision = decide_shift(actor, shift.pk, request)
    with pytest.raises(ReviewConflictError):
        decide_shift(actor, shift.pk, request)
    receipt = HistoryPublicationReceipt.objects.get(
        cause_kind="shift_validation", cause_id=decision.pk
    )
    change = CourierChange.objects.get(pk=receipt.change_id)
    assert change.courier_id == shift.courier_id
    assert change.kind == "history"
    assert change.sequence > 0
    assert change.payload["kind"] == "shift_validation"
    assert change.payload["reason"] == request.reason
    assert change.payload["decision_kind"] == "observe"
    assert HistoryPublicationReceipt.objects.filter(cause_id=decision.pk).count() == 1
    now = timezone.now()
    batch = BatchContext(org_a, shift.courier, shift.device, now, now)
    first = sync_batch(batch, [], ChangesCursor())
    lost_response_retry = sync_batch(batch, [], ChangesCursor())
    assert first.changes.history == lost_response_retry.changes.history
    assert first.changes.history[0]["data"]["reason"] == request.reason
    advanced = decode_cursor(first.changes.cursor, org_a.pk, shift.courier_id)
    assert not sync_batch(batch, [], advanced).changes.history
    assert bootstrap_bundle(batch)["history"][0]["reason"] == request.reason
    shift.refresh_from_db()
    assert shift.status == "closed"


@pytest.mark.django_db
def test_every_shift_subject_is_filtered_before_limit_and_bootstrap_after_scope_loss(
    org_a, make_member, settings
):
    from uuid import uuid4

    from django.utils import timezone

    from field_sync.cursor import ChangesCursor
    from field_sync.envelope import BatchContext
    from field_sync.services import bootstrap_bundle, sync_batch
    from geography.models import Quadrant
    from organizations.models import Center, Membership
    from organizations.services import ProfileChange, update_profile_permissions
    from tests.fleet_support import grant_fleet_scope
    from tests.shift_support import close_event
    from tests.sync_support import event, make_phone

    center = Center.objects.create(organization=org_a, code="B17-C", name="Review scope center")
    quadrants = [
        Quadrant.objects.create(organization=org_a, center=center, code=f"B17-Q-{index}")
        for index in range(2)
    ]
    shift = ShiftFactory(organization=org_a, motorcycle__center=center)

    def scoped_member(*args, **kwargs):
        return grant_fleet_scope(make_member(*args, **kwargs))

    phone = make_phone(
        scoped_member,
        org_a,
        user=shift.courier,
        device_id=shift.device_id,
        codes=("field_event.sync", "field.bootstrap", "incident.create"),
    )
    captures = [
        event(
            type="incident.report",
            shift_id=str(shift.pk),
            payload={
                "type_id": str(uuid4()),
                "description": "Unconfigured incident still retains scoped source",
                "scope": {"center_id": str(center.pk), "quadrant_id": str(quadrant.pk)},
            },
        )
        for quadrant in quadrants
    ]
    response = phone.sync(captures)
    assert response.status_code == 200, response.data
    assert all(item["status"] == "rejected" for item in response.data["results"])
    assert phone.sync([close_event(shift.pk)]).data["results"][0]["status"] == "accepted"
    actor = reviewer(org_a, make_member)
    hidden = decide_shift(
        actor, shift.pk, ShiftDecisionRequest("observe", 0, "Two scoped captured incident sources")
    )
    other = ShiftFactory(
        organization=org_a,
        is_closed=True,
        courier=shift.courier,
        device=shift.device,
        motorcycle__center=center,
    )
    visible = decide_shift(
        actor, other.pk, ShiftDecisionRequest("observe", 0, "A separately visible closed frame")
    )
    member = Membership.objects.get(organization=org_a, user=shift.courier)
    profile = member.profiles.get()
    configuration_actor, _ = grant_fleet_scope(
        make_member(org_a, ("role.update", *profile.permission_codes))
    )
    update_profile_permissions(
        profile,
        ProfileChange(
            configuration_actor,
            profile.revision,
            profile.permission_codes,
            {
                "centers": {"mode": "selected", "ids": [str(center.pk)]},
                "quadrants": {"mode": "selected", "ids": [str(quadrants[0].pk)]},
            },
        ),
    )
    settings.API_CURSOR_PAGE_SIZE = 1
    now = timezone.now()
    batch = BatchContext(org_a, shift.courier, shift.device, now, now)
    pulled = sync_batch(batch, [], ChangesCursor()).changes.history
    assert [entry["data"]["id"] for entry in pulled] == [str(visible.pk)]
    assert str(hidden.pk) not in [entry["id"] for entry in bootstrap_bundle(batch)["history"]]
    from shifts.services import update_motorcycle

    original_change = CourierChange.objects.get(history_receipt__cause_id=visible.pk)
    captured_subjects = original_change.payload["subjects"]
    moved_center = Center.objects.create(
        organization=org_a, created_by=configuration_actor, code="B17-MOVED", name="New allocation"
    )
    update_motorcycle(other.motorcycle, {"center": moved_center})
    assert not sync_batch(batch, [], ChangesCursor()).changes.history
    assert not bootstrap_bundle(batch)["history"]
    original_change.refresh_from_db()
    assert original_change.payload["subjects"] == captured_subjects
