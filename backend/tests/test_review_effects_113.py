"""Owner-specific effect/adoption journeys, without rewriting original ingest facts."""

import pytest

from tests.test_reviews_b_17 import (
    _isolate_notice_broker,  # noqa: F401 -- shared autouse broker fixture
)


@pytest.mark.django_db
def test_reviewed_void_of_incident_source_keeps_case_timeline_and_owned_holds(make_member):
    from dataclasses import replace
    from datetime import timedelta

    from django.utils import timezone

    from field_sync.envelope import describe_payload
    from field_sync.services import sync_batch
    from incidents.models import Incident
    from incidents.selectors import active_blockers, current_event
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewConflictError
    from reviews.models import ReviewEffectReceipt, ReviewItem
    from tests.ovitrap_support import envelope
    from tests.test_reviews_b_17 import _reviewed_incident

    case, item, _upload, actor = _reviewed_incident(make_member, "incident.report", held=True)
    decide_review(
        actor,
        item.pk,
        ReviewDecisionRequest(
            "accept", 0, "Verified the original scoped incident capture and authority"
        ),
    )
    incident = Incident.objects.get(source_event=item.field_event)
    holds = set(
        active_blockers(actor.organization).filter(incident=incident).values_list("pk", flat=True)
    )
    assert holds
    payload = {
        "reason_code": "other",
        "reason": "Correct the original capture without closing its case",
    }
    now = timezone.now()
    capture = replace(
        envelope(case.field, "record.void"),
        device_time=now,
        voids_event_id=item.field_event_id,
        payload=payload,
        payload_info=describe_payload(payload),
    )
    batch = replace(case.field.batch, sent_at=now - timedelta(hours=1), received_at=now)
    assert sync_batch(batch, [capture], None).results[0].status == "in_review"
    correction = ReviewItem.objects.get(field_event_id=capture.id)
    request = ReviewDecisionRequest(
        "accept", 0, "Apply this original source correction exactly once"
    )
    decide_review(actor, correction.pk, request)
    with pytest.raises(ReviewConflictError):
        decide_review(actor, correction.pk, request)
    incident.refresh_from_db()
    item.field_event.refresh_from_db()
    assert item.field_event.voided_at is not None
    assert item.field_event.status == "in_review"
    assert incident.source_event_id == item.field_event_id
    assert incident.events.count() == 1
    assert current_event(incident).state == "open"
    assert holds == set(
        active_blockers(actor.organization).filter(incident=incident).values_list("pk", flat=True)
    )
    assert ReviewEffectReceipt.objects.filter(source_event_id=capture.id).count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("mode", ["legacy", "deferred", "context_changed", "rule_changed"])
def test_fuel_original_context_or_legacy_adoption_preserves_values_and_refuses_changed_context(
    org_a, make_member, mode
):
    from uuid import UUID, uuid4

    from accounts.models import Device
    from field_sync.envelope import describe_payload
    from field_sync.exceptions import EventNeedsReview
    from field_sync.registry import EventContext
    from fleet.fuel_services import apply_fuel_load
    from fleet.models import FuelLoad
    from fleet.selectors import motorcycle_metrics
    from organizations.models import Membership
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.inspection import original_source_envelope, validated_original_payload
    from reviews.models import ReviewEffectReceipt, ReviewItem, ReviewSourceSnapshot
    from reviews.services import create_review_item
    from reviews.transactions import review_transaction
    from shifts.models import Shift
    from tests.factories import FieldEventFactory, MotorcycleFactory
    from tests.fleet_support import grant_fleet_scope
    from tests.review_support import audit_current_membership, reviewer
    from tests.shift_support import make_check_items, open_event
    from tests.sync_support import make_phone
    from tests.test_fleet_b_05 import fuel
    from uploads.access import UploadActor

    def scoped_member(*args, **kwargs):
        return grant_fleet_scope(make_member(*args, **kwargs))

    phone = make_phone(scoped_member, org_a)
    audit_current_membership(Membership.objects.get(organization=org_a, user=phone.user))
    make_check_items(org_a)
    _configure_fuel_bounds(org_a)
    motorcycle = MotorcycleFactory(organization=org_a)
    shift_id = uuid4()
    assert (
        phone.sync([open_event(motorcycle.code, shift_id)]).data["results"][0]["status"]
        == "accepted"
    )
    first = fuel(shift_id, motorcycle.code, 12000)
    assert phone.sync([first]).data["results"][0]["status"] == "accepted"
    capture = fuel(shift_id, motorcycle.code, 12010, litres="100.000")
    if mode == "legacy":
        source = FieldEventFactory(
            id=UUID(capture["id"]),
            organization=org_a,
            created_by=phone.user,
            device=Device.objects.get(pk=phone.device_id),
            type="fuel.load",
            shift_id=shift_id,
            payload=capture["payload"],
            payload_sha256=describe_payload(capture["payload"]).sha256,
            status="in_review",
            status_code="fuel_efficiency_review",
        )
        ctx = EventContext(
            org_a,
            phone.user,
            source.device,
            original_source_envelope(source),
            source.server_received_at,
        )
        with review_transaction(
            UploadActor(phone.user, org_a), source, {Shift.objects.get(pk=shift_id).opened_event_id}
        ):
            with pytest.raises(EventNeedsReview):
                apply_fuel_load(ctx, validated_original_payload(source))
            item = create_review_item(source)
        legacy = FuelLoad.objects.get(event=source)
        original = (
            legacy.pk,
            legacy.provisional,
            legacy.baseline_id,
            legacy.threshold_min,
            legacy.threshold_max,
            legacy.rule_provenance,
            legacy.efficiency_km_l,
        )
    else:
        assert phone.sync([capture]).data["results"][0]["code"] == "fuel_efficiency_review"
        item = ReviewItem.objects.get(field_event_id=capture["id"])
        assert not FuelLoad.objects.filter(event=item.field_event).exists()
    actor = reviewer(org_a, make_member)
    request = ReviewDecisionRequest(
        "accept", 0, "Original measured interval and threshold versions were verified"
    )
    if mode in {"context_changed", "rule_changed"}:
        from copy import deepcopy

        original_facts = deepcopy(
            ReviewSourceSnapshot.objects.get(source_event=item.field_event).facts
        )
        if mode == "context_changed":
            assert (
                phone.sync([fuel(shift_id, motorcycle.code, 12031)]).data["results"][0]["status"]
                == "accepted"
            )
        else:
            # Adversarial retained configuration, not a public backdating API:
            # later-created history must never replace the measured original inputs.
            from datetime import timedelta

            from rules.models import RuleParameter
            from tests.factories import RuleParameterVersionFactory

            RuleParameterVersionFactory(
                parameter=RuleParameter.objects.get(
                    organization=org_a, key="fuel_efficiency_min_km_l"
                ),
                value=1,
                effective_from=item.field_event.device_time - timedelta(seconds=1),
            )
        with pytest.raises(ReviewBlockedError) as blocked:
            decide_review(actor, item.pk, request)
        assert any(
            reason["reason"] == "fuel_context_changed" for reason in blocked.value.blocked_by
        )
        assert not ReviewEffectReceipt.objects.filter(source_event=item.field_event).exists()
        assert (
            ReviewSourceSnapshot.objects.get(source_event=item.field_event).facts == original_facts
        )
        return
    decision = decide_review(actor, item.pk, request)
    receipt = ReviewEffectReceipt.objects.get(decision=decision)
    row = FuelLoad.objects.get(event=item.field_event)
    assert receipt.mode == ("adopted_legacy" if mode == "legacy" else "applied_review")
    if mode == "legacy":
        assert original == (
            row.pk,
            row.provisional,
            row.baseline_id,
            row.threshold_min,
            row.threshold_max,
            row.rule_provenance,
            row.efficiency_km_l,
        )
    assert FuelLoad.objects.filter(event=item.field_event).count() == 1
    assert row.baseline.event_id == UUID(first["id"])
    assert motorcycle_metrics(motorcycle)["latest_efficiency"] == row.efficiency_km_l
    assert motorcycle_metrics(motorcycle)["latest_odometer"] == 12010
    item.field_event.refresh_from_db()
    assert item.field_event.status == "in_review"


def _configure_fuel_bounds(org):
    from datetime import timedelta

    from django.utils import timezone

    from tests.factories import RuleParameterFactory, RuleParameterVersionFactory

    for key, value in (("fuel_efficiency_min_km_l", 15), ("fuel_efficiency_max_km_l", 60)):
        parameter = RuleParameterFactory(
            organization=org, key=key, value_type="decimal", unit="km_l"
        )
        RuleParameterVersionFactory(
            parameter=parameter, value=value, effective_from=timezone.now() - timedelta(days=1)
        )


@pytest.mark.django_db(transaction=True)
def test_distinct_reviewed_voids_arbitrate_one_original_target_hook(make_member, monkeypatch):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    from dataclasses import replace
    from datetime import timedelta

    from django.db import connection
    from django.utils import timezone

    from core.exceptions import AlreadyVoidedError
    from field_sync.envelope import describe_payload
    from field_sync.exceptions import SyncInProgressError
    from field_sync.services import sync_batch
    from ovitraps.models import OvitrapVoid
    from reviews import actions
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewEffectReceipt, ReviewItem
    from tests.ovitrap_support import envelope, setup_field
    from tests.review_support import audit_current_membership, reviewer
    from tests.sync_support import configure_clock_skew

    field = setup_field()
    configure_clock_skew(field.batch.organization)
    audit_current_membership(field.membership)
    now = timezone.now()
    parent = replace(envelope(field), device_time=now)
    batch = replace(field.batch, sent_at=now, received_at=now)
    assert sync_batch(batch, [parent], None).results[0].status == "accepted"
    payload = {"reason_code": "other", "reason": "Correct the exact captured placement"}
    children = [
        replace(
            envelope(field, "record.void"),
            index=index,
            device_time=timezone.now(),
            voids_event_id=parent.id,
            payload=payload,
            payload_info=describe_payload(payload),
        )
        for index in range(2)
    ]
    late_batch = replace(batch, sent_at=now - timedelta(hours=1), received_at=timezone.now())
    assert all(
        result.status == "in_review" for result in sync_batch(late_batch, children, None).results
    )
    items = [ReviewItem.objects.get(field_event_id=child.id) for child in children]
    actors = [reviewer(field.batch.organization, make_member) for _ in items]
    entered, release = threading.Event(), threading.Event()
    apply = actions._apply_or_adopt

    def held_apply(*args):
        entered.set()
        assert release.wait(timeout=10)
        return apply(*args)

    monkeypatch.setattr(actions, "_apply_or_adopt", held_apply)
    request = ReviewDecisionRequest("accept", 0, "Verified the original correction and authority")

    def first():
        try:
            return decide_review(actors[0], items[0].pk, request)
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(first)
        try:
            assert entered.wait(timeout=10)
            with pytest.raises(SyncInProgressError):
                decide_review(actors[1], items[1].pk, request)
        finally:
            release.set()
        winner = job.result(timeout=10)
    with pytest.raises(AlreadyVoidedError) as blocked:
        decide_review(actors[1], items[1].pk, request)
    assert blocked.value.code == "already_voided"
    assert OvitrapVoid.objects.filter(target_event_id=parent.id).count() == 1
    assert ReviewEffectReceipt.objects.filter(decision=winner).count() == 1
    assert not ReviewEffectReceipt.objects.filter(source_event=items[1].field_event).exists()


@pytest.mark.django_db
def test_child_requires_both_pending_owned_shift_and_physical_parent_without_auto_replay(
    make_member,
):
    from dataclasses import replace
    from datetime import timedelta
    from uuid import uuid4

    from django.utils import timezone

    from field_sync.envelope import describe_payload
    from field_sync.services import sync_batch
    from ovitraps.models import OvitrapReading
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewDependency, ReviewDependencyResolution, ReviewItem
    from tests.factories import MotorcycleFactory
    from tests.ovitrap_support import envelope, setup_field
    from tests.review_support import audit_current_membership, reviewer
    from tests.shift_support import make_check_items, open_event
    from tests.sync_support import configure_clock_skew

    field = setup_field()
    configure_clock_skew(field.batch.organization)
    audit_current_membership(field.membership)
    make_check_items(field.batch.organization)
    motorcycle = MotorcycleFactory(organization=field.batch.organization)
    shift_id = uuid4()
    payload = open_event(motorcycle.code, shift_id)["payload"]
    opening = replace(
        envelope(field, "shift.open"),
        shift_id=shift_id,
        device_time=timezone.now(),
        payload=payload,
        payload_info=describe_payload(payload),
    )
    placement = replace(envelope(field), index=1, device_time=timezone.now())
    now = timezone.now()
    late = replace(field.batch, sent_at=now - timedelta(hours=1), received_at=now)
    assert all(
        result.status == "in_review"
        for result in sync_batch(late, [opening, placement], None).results
    )
    child = replace(envelope(field, "ovitrap.check"), shift_id=shift_id, device_time=timezone.now())
    now = timezone.now()
    current = replace(field.batch, sent_at=now, received_at=now)
    assert sync_batch(current, [child], None).results[0].code == "causal_parent_pending"
    item = ReviewItem.objects.get(field_event_id=child.id)
    assert set(
        ReviewDependency.objects.filter(source_event_id=child.id).values_list("kind", flat=True)
    ) == {"shift", "ovitrap"}
    actor = reviewer(field.batch.organization, make_member)
    request = ReviewDecisionRequest(
        "accept", 0, "Verify both exact effective parents and original child context"
    )
    for parent in (opening, placement):
        with pytest.raises(ReviewBlockedError):
            decide_review(actor, item.pk, request)
        decide_review(actor, ReviewItem.objects.get(field_event_id=parent.id).pk, request)
        assert not OvitrapReading.objects.filter(event_id=child.id).exists()
    decide_review(actor, item.pk, request)
    assert OvitrapReading.objects.filter(event_id=child.id).count() == 1
    assert (
        ReviewDependencyResolution.objects.filter(dependency__source_event_id=child.id).count() == 2
    )
