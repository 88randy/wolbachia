"""Legacy owner rows are adopted only when their actual immutable identity is complete."""

from dataclasses import replace
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from tests.test_reviews_b_17 import _isolate_notice_broker  # noqa: F401 -- shared autouse transport isolation


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kind", ["place", "check", "replace", "relocate", "remove", "void", "partial_place"]
)
def test_legacy_capture_adopts_exact_owner_rows_once_without_replaying_effects(make_member, kind):
    from field_sync.models import CourierChange
    from ovitraps.lifecycle.models import PhysicalOvitrapLineage, RelocationProposal, RemovalAttempt
    from ovitraps.models import Bag, Ovitrap, OvitrapReading, OvitrapVoid, PlacementAttempt
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError, ReviewConflictError
    from reviews.models import ReviewEffectReceipt, ReviewSourceSnapshot
    from scheduling.models import ScheduledTask, TaskOwnership
    from scheduling.selectors import task_query, week_start
    from tests.ovitrap_support import setup_field
    from tests.review_support import audit_current_membership, reviewer

    field = setup_field()
    field.profile.permission_codes += ["field.bootstrap"]
    field.profile.save(update_fields=["permission_codes"])
    audit_current_membership(field.membership)
    day = timezone.now().astimezone(ZoneInfo(field.batch.organization.timezone)).date()
    task = (
        ScheduledTask.objects.create(
            organization=field.batch.organization,
            created_by=field.batch.user,
            point=field.point,
            action="place",
            due_date=day,
            rule_version_ids={},
        )
        if kind == "place"
        else None
    )
    if task is not None:
        TaskOwnership.objects.create(
            organization=field.batch.organization,
            created_by=field.batch.user,
            task=task,
            courier=field.batch.user,
            revision=1,
        )
    item = _legacy_capture(field, kind)
    source = item.field_event
    owner_models = (
        Ovitrap,
        PlacementAttempt,
        OvitrapReading,
        Bag,
        PhysicalOvitrapLineage,
        RelocationProposal,
        RemovalAttempt,
        OvitrapVoid,
    )
    counts = tuple(model.objects.count() for model in owner_models)
    original = (
        source.payload_sha256,
        source.status,
        source.status_code,
        source.device_time,
        source.server_received_at,
        source.voids_event_id,
    )
    published = (
        CourierChange.objects.filter(kind="assignments", resource_id=str(task.pk)).count()
        if task
        else 0
    )
    if task is not None:
        assert (
            not task_query(
                field.membership, week_start(field.batch.organization, day), "field.bootstrap"
            )
            .get(pk=task.pk)
            .is_completed
        )
    actor = reviewer(field.batch.organization, make_member)
    request = ReviewDecisionRequest(
        "accept", 0, "Verified exact retained source, original authority and complete owner rows"
    )
    if kind == "partial_place":
        with pytest.raises(ReviewBlockedError):
            decide_review(actor, item.pk, request)
        assert not ReviewEffectReceipt.objects.filter(source_event=source).exists()
        return
    decision = decide_review(actor, item.pk, request)
    with pytest.raises(ReviewConflictError):
        decide_review(actor, item.pk, request)
    assert ReviewEffectReceipt.objects.get(decision=decision).mode == "adopted_legacy"
    assert tuple(model.objects.count() for model in owner_models) == counts
    assert not ReviewSourceSnapshot.objects.filter(source_event=source).exists()
    source.refresh_from_db()
    assert original == (
        source.payload_sha256,
        source.status,
        source.status_code,
        source.device_time,
        source.server_received_at,
        source.voids_event_id,
    )
    if task is not None:
        assert (
            task_query(
                field.membership, week_start(field.batch.organization, day), "field.bootstrap"
            )
            .get(pk=task.pk)
            .is_completed
        )
        feed = CourierChange.objects.filter(kind="assignments", resource_id=str(task.pk))
        assert feed.count() == published + 1
        assert feed.order_by("-sequence").first().payload["is_completed"] is True


def _legacy_capture(field, kind):
    from field_sync.envelope import describe_payload
    from field_sync.registry import EventContext, get_handler
    from field_sync.services import fanout_courier_changes, sync_batch
    from geography.selectors import point_version_at
    from ovitraps.models import Ovitrap
    from ovitraps.services import point_fanout_scope
    from reviews.inspection import validated_original_payload
    from reviews.services import create_review_item
    from reviews.transactions import review_transaction
    from tests.factories import FieldEventFactory
    from tests.ovitrap_support import envelope
    from tests.test_ovitraps_lifecycle_b_15 import lifecycle
    from uploads.access import UploadActor
    from uploads.linking import record_event_links

    now = timezone.now()
    parent = None
    if kind not in {"place", "partial_place"}:
        parent = replace(envelope(field), device_time=now)
        batch = replace(field.batch, sent_at=now, received_at=now)
        assert sync_batch(batch, [parent], None).results[0].status == "accepted"
    if kind in {"replace", "relocate", "remove"}:
        event = lifecycle(field, kind)
    elif kind == "void":
        payload = {"reason_code": "other", "reason": "Actual historical placement correction"}
        event = replace(
            envelope(field, "record.void"),
            voids_event_id=parent.id,
            payload=payload,
            payload_info=describe_payload(payload),
        )
    else:
        event = envelope(field, "ovitrap.check" if kind == "check" else "ovitrap.place")
    event = replace(event, device_time=timezone.now())
    source = FieldEventFactory(
        id=event.id,
        organization=field.batch.organization,
        created_by=field.batch.user,
        device=field.batch.device,
        type=event.type,
        payload=event.payload,
        payload_sha256=event.payload_info.sha256,
        rules_version=event.rules_version,
        catalog_version=event.catalog_version,
        device_time=event.device_time,
        gps_lat=event.gps.lat,
        gps_lng=event.gps.lng,
        gps_accuracy_m=event.gps.accuracy_m,
        voids_event_id=event.voids_event_id,
        status="in_review",
        status_code="clock_skew",
    )
    actor = UploadActor(field.batch.user, field.batch.organization, field.batch.device.pk)
    ctx = EventContext(
        actor.organization, actor.user, field.batch.device, event, source.server_received_at
    )
    references = set() if parent is None else {parent.id}
    with (
        review_transaction(actor, source, references),
        fanout_courier_changes(point_fanout_scope(field.point)),
    ):
        if kind == "partial_place":
            Ovitrap.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                event=source,
                client_uuid=field.identity,
                sampling_point=field.point,
                point_version=point_version_at(field.point, event.device_time),
            )
        else:
            handler = get_handler(event.type, event.schema_version)
            handler.review_adapter.prepare_boundary(ctx, validated_original_payload(source))
            handler.apply(ctx, validated_original_payload(source))
            record_event_links(source)
        return create_review_item(source)
