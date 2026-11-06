"""Real source boundaries and append-only decisions; PostgreSQL execution belongs to CI."""

import pytest
from django.db import transaction

from field_sync.exceptions import EventNeedsReview
from field_sync.models import FieldEvent
from field_sync.registry import HANDLERS, EventHandler
from reviews.models import ReviewSourceSnapshot
from tests.sync_support import event, make_phone


@pytest.fixture(autouse=True)
def _isolate_notice_broker(monkeypatch):
    """Exercise durable causes, while transport is outside these domain tests."""
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)


@pytest.mark.django_db(transaction=True)
def test_simultaneous_decisions_have_one_effect_then_a_stale_revision_conflict(
    org_a, make_member, monkeypatch
):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection

    from field_sync.exceptions import SyncInProgressError
    from reviews import actions
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewConflictError
    from reviews.models import HistoryPublicationReceipt, ReviewDecision, ReviewEffectReceipt
    from shifts.models import MotorcycleBlockEvent, Shift
    from tests.review_support import reviewed_open, reviewer

    _phone, _moto, item, _capture = reviewed_open(org_a, make_member)
    first, second = reviewer(org_a, make_member), reviewer(org_a, make_member)
    entered, release = threading.Event(), threading.Event()
    apply = actions._apply_or_adopt

    def held_apply(*args):
        entered.set()
        assert release.wait(timeout=10), "The test did not release the first real writer."
        return apply(*args)

    monkeypatch.setattr(actions, "_apply_or_adopt", held_apply)
    request = ReviewDecisionRequest("accept", 0, "Validated original severe checklist")

    def run_first():
        try:
            return decide_review(first, item.pk, request)
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(run_first)
        try:
            assert entered.wait(timeout=10)
            with pytest.raises(SyncInProgressError):
                decide_review(second, item.pk, request)
        finally:
            release.set()
        decision = job.result(timeout=10)
    with pytest.raises(ReviewConflictError):
        decide_review(second, item.pk, request)
    assert ReviewDecision.objects.filter(review_item=item).count() == 1
    assert ReviewEffectReceipt.objects.filter(source_event=item.field_event).count() == 1
    assert HistoryPublicationReceipt.objects.filter(cause_id=decision.pk).count() == 1
    assert Shift.objects.filter(opened_event=item.field_event).count() == 1
    assert MotorcycleBlockEvent.objects.filter(field_event=item.field_event).count() == 1
    item.field_event.refresh_from_db()
    assert item.field_event.status == "in_review"


@pytest.mark.django_db
def test_acceptance_preserves_original_envelope_result_and_replay(org_a, make_member):
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.inspection import original_source_envelope
    from reviews.models import ReviewEffectReceipt
    from reviews.source_identity import envelope_metadata
    from tests.review_support import reviewed_open, reviewer

    phone, _motorcycle, item, capture = reviewed_open(org_a, make_member)
    source = item.field_event
    before = (
        envelope_metadata(original_source_envelope(source)),
        source.status,
        source.status_code,
        source.device_time,
        source.server_received_at,
        item.courier_sequence,
    )
    decision = decide_review(
        reviewer(org_a, make_member),
        item.pk,
        ReviewDecisionRequest("accept", 0, "Confirmed original observation and authority"),
    )
    source.refresh_from_db()
    item.refresh_from_db()
    assert before == (
        envelope_metadata(original_source_envelope(source)),
        source.status,
        source.status_code,
        source.device_time,
        source.server_received_at,
        item.courier_sequence,
    )
    replay = phone.sync([capture])
    assert replay.data["results"][0]["status"] == "in_review"
    assert ReviewEffectReceipt.objects.get(decision=decision).source_event_id == source.pk


@pytest.mark.django_db
def test_current_membership_cannot_replace_missing_historical_authority(org_a, make_member):
    from django.utils import timezone

    from reviews.authority import historical_authority
    from tests.fleet_support import grant_fleet_scope

    user, _member = grant_fleet_scope(make_member(org_a, ("field_event.sync",)))
    proof = historical_authority(org_a, user.pk, timezone.now())
    assert proof.unavailable == "authority_history_unavailable"
    assert not proof.scope.grants


@pytest.mark.django_db(transaction=True)
def test_review_rolls_back_operational_rows_and_callbacks(org_a, make_member, monkeypatch):
    """A future writer cannot retain effects merely by raising a review observation."""
    from shifts.models import Motorcycle
    from shifts.payloads import ShiftClosePayloadSerializer

    phone = make_phone(make_member, org_a)
    envelope = event(type="test.review", payload={"odometer_km": 100, "note": ""})
    called = []

    def apply(ctx, data):
        Motorcycle.objects.create(organization=org_a, created_by=ctx.user, code="rollback")
        transaction.on_commit(lambda: called.append(True))
        raise EventNeedsReview("clock_skew")

    monkeypatch.setitem(
        HANDLERS,
        ("test.review", 1),
        EventHandler("test.review", 1, ShiftClosePayloadSerializer, apply, checks_shift=False),
    )
    result = phone.sync([envelope])
    assert result.status_code == 200, result.data
    assert result.data["results"][0]["status"] == "in_review"
    assert not Motorcycle.objects.filter(code="rollback").exists()
    assert not called
    source = FieldEvent.objects.get(pk=envelope["id"])
    assert source.review_item.code == "clock_skew"
    assert ReviewSourceSnapshot.objects.get(source_event=source).original_envelope["id"] == str(
        source.pk
    )


def _safety_case(org, make_member):
    from django.utils import timezone

    from catalogs.seeds import seed_default_catalogs
    from fleet.services import append_service
    from organizations.models import Membership
    from tests.review_support import reviewed_open, reviewer
    from tests.uploads_support import verified_upload

    seed_default_catalogs(org)
    phone, motorcycle, item, capture = reviewed_open(org, make_member)
    actor = reviewer(org, make_member)
    member = Membership.objects.get(organization=org, user=actor.user)
    profile = member.profiles.get()
    profile.permission_codes += ["motorcycle.service_clear", "motorcycle.manage"]
    profile.save(update_fields=["permission_codes"])
    inspection = append_service(
        motorcycle,
        actor.user,
        {
            "kind": "inspection",
            "performed_at": timezone.now().date(),
            "odometer_km": 12000,
            "notes": "Actual current inspection",
        },
    )
    upload = verified_upload(org, actor.user)
    return phone, motorcycle, item, capture, actor, inspection, upload


@pytest.mark.django_db
@pytest.mark.parametrize("missing", ["request", "permission", "evidence", "inspection"])
def test_severe_discard_stays_pending_until_current_double_permission_and_real_proof(
    org_a, make_member, missing
):
    from dataclasses import replace

    from django.http import Http404

    from organizations.models import Membership
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.contracts import SafetyDispositionRequest
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewDecision, ReviewSafetyDisposition
    from reviews.safety import has_pending_severe

    _phone, motorcycle, item, _capture, actor, inspection, upload = _safety_case(org_a, make_member)
    request = ReviewDecisionRequest(
        "void",
        0,
        "Checklist result was attributed incorrectly",
        [upload.public_id],
        SafetyDispositionRequest(inspection.pk, True),
    )
    if missing == "request":
        request = replace(request, safety_disposition=None)
    elif missing == "permission":
        profile = Membership.objects.get(organization=org_a, user=actor.user).profiles.get()
        profile.permission_codes.remove("motorcycle.service_clear")
        profile.save(update_fields=["permission_codes"])
    elif missing == "evidence":
        request = replace(request, evidence_ids=[])
    else:
        from uuid import uuid4

        request = replace(request, safety_disposition=SafetyDispositionRequest(uuid4(), True))
    with pytest.raises((ReviewBlockedError, Http404)):
        decide_review(actor, item.pk, request)
    assert has_pending_severe(motorcycle.pk)
    assert not ReviewDecision.objects.filter(review_item=item).exists()
    assert not ReviewSafetyDisposition.objects.filter(review_item=item).exists()


@pytest.mark.django_db
def test_source_bound_safety_void_preserves_other_fault_and_original_history(org_a, make_member):
    from django.db import DatabaseError, connection
    from django.utils import timezone

    from fleet.exceptions import FleetConflictError
    from fleet.models import InspectionClearance
    from fleet.selectors import active_blocks
    from fleet.services import void_history
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.contracts import SafetyDispositionRequest
    from reviews.models import ReviewEffectReceipt, ReviewSafetyDisposition
    from reviews.safety import has_pending_severe
    from shifts.models import MotorcycleBlockEvent, Shift
    from tests.test_fleet_b_05 import make_fault

    phone, motorcycle, item, capture, actor, inspection, upload = _safety_case(org_a, make_member)
    fault = make_fault(motorcycle, actor.user)
    original = (
        item.field_event.status,
        item.field_event.status_code,
        item.field_event.device_time,
        item.field_event.server_received_at,
    )
    decision = decide_review(
        actor,
        item.pk,
        ReviewDecisionRequest(
            "void",
            0,
            "Incorrect source attribution; current inspection confirms safety",
            [upload.public_id],
            SafetyDispositionRequest(inspection.pk, True),
        ),
    )
    fact = ReviewSafetyDisposition.objects.get(decision=decision)
    assert fact.inspection_id == inspection.pk
    assert fact.created_at >= inspection.created_at
    assert not has_pending_severe(motorcycle.pk)
    assert fault.pk in {row.pk for row in active_blocks(motorcycle)}
    assert MotorcycleBlockEvent.objects.filter(motorcycle=motorcycle).count() == 1
    assert not InspectionClearance.objects.filter(fault=fault).exists()
    assert not Shift.objects.filter(opened_event=item.field_event).exists()
    assert not ReviewEffectReceipt.objects.filter(source_event=item.field_event).exists()
    item.field_event.refresh_from_db()
    assert original == (
        item.field_event.status,
        item.field_event.status_code,
        item.field_event.device_time,
        item.field_event.server_received_at,
    )
    assert phone.sync([capture]).data["results"][0]["status"] == "in_review"
    with pytest.raises(FleetConflictError) as denied:
        void_history(
            inspection,
            actor.user,
            {"reason": "Inspection record has an error", "reason_code": "other"},
        )
    assert denied.value.code == "service_has_safety_disposition"
    with (
        pytest.raises(DatabaseError, match="service_has_safety_disposition"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE fleet_servicerecord SET voided_at=%s, voided_by_id=%s, void_reason=%s, void_reason_code=%s WHERE id=%s",
            [
                timezone.now(),
                actor.user.pk,
                "Inspection record requires correction",
                "other",
                inspection.pk,
            ],
        )
    with (
        pytest.raises(DatabaseError, match="review safety facts"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE reviews_reviewsafetydisposition SET attest_safe_now=false WHERE id=%s",
            [fact.pk],
        )
    inspection.refresh_from_db()
    assert inspection.voided_at is None


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("rollback", [False, True])
def test_safety_disposition_arbitrates_inspection_void_and_releases_rollback(
    org_a, make_member, monkeypatch, rollback
):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection

    from field_sync.exceptions import SyncInProgressError
    from fleet.exceptions import FleetConflictError
    from fleet.services import void_history
    from reviews import safety_dispositions
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.contracts import SafetyDispositionRequest
    from reviews.exceptions import ReviewBlockedError

    _phone, _motorcycle, item, _capture, actor, inspection, upload = _safety_case(
        org_a, make_member
    )
    entered, release = threading.Event(), threading.Event()
    prepare = safety_dispositions.prepare_safety_disposition

    def held_prepare(*args):
        proof = prepare(*args)
        entered.set()
        assert release.wait(timeout=10)
        if rollback:
            raise ReviewBlockedError(("test_rollback",))
        return proof

    monkeypatch.setattr(safety_dispositions, "prepare_safety_disposition", held_prepare)
    request = ReviewDecisionRequest(
        "void",
        0,
        "Source attribution disproved by current inspection",
        [upload.public_id],
        SafetyDispositionRequest(inspection.pk, True),
    )

    def first():
        try:
            return decide_review(actor, item.pk, request)
        finally:
            connection.close()

    values = {"reason": "Inspection record requires correction", "reason_code": "other"}
    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(first)
        try:
            assert entered.wait(timeout=10)
            with pytest.raises(SyncInProgressError):
                void_history(inspection, actor.user, values)
        finally:
            release.set()
        if rollback:
            with pytest.raises(ReviewBlockedError):
                job.result(timeout=10)
        else:
            job.result(timeout=10)
    if rollback:
        assert void_history(inspection, actor.user, values).voided_at is not None
        with pytest.raises(ReviewBlockedError):
            decide_review(actor, item.pk, request)
    else:
        with pytest.raises(FleetConflictError):
            void_history(inspection, actor.user, values)


def _reviewed_incident(make_member, event_type, *, held=False):
    from dataclasses import replace
    from datetime import timedelta

    from django.utils import timezone

    from catalogs.models import CatalogItem
    from field_sync.envelope import describe_payload
    from field_sync.services import sync_batch
    from incidents.configuration import write_type
    from reviews.models import ReviewItem
    from tests.ovitrap_support import setup_field
    from tests.review_support import audit_current_membership, reviewer
    from tests.sync_support import configure_clock_skew
    from tests.test_incidents_b_06 import configured, source
    from tests.uploads_support import verified_upload

    case = configured(setup_field())
    org = case.actor.organization
    if event_type == "emergency.accident":
        item = CatalogItem.objects.get(
            organization=org, catalog__slug="incident-type", code="emergency-accident"
        )
        write_type(
            case.actor,
            {
                "severity": "critical",
                "terminal_id": case.field.membership.pk,
                "supervisor_sla_seconds": 60,
                "coordinator_sla_seconds": 120,
            },
            item.pk,
        )
    write_type(
        case.actor,
        {
            "code": "review-followup",
            "label": "Review follow-up",
            "severity": "high",
            "terminal_id": case.field.membership.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
            "report_evidence_min": 1,
        },
    )
    configure_clock_skew(org)
    audit_current_membership(case.field.membership)
    upload = verified_upload(org, case.actor.user, device=case.field.batch.device)
    now = timezone.now()
    capture = source(case, event_type)
    payload = {**capture.payload, "evidence_ids": [str(upload.public_id).upper()]}
    if held:
        from tests.factories import MotorcycleFactory

        motorcycle = MotorcycleFactory(organization=org, center_id=case.field.point.center_id)
        payload = payload | {
            "scope": {"center_id": str(motorcycle.center_id)},
            "resource_ref": {"kind": "motorcycle", "id": str(motorcycle.pk)},
        }
    capture = replace(
        capture, device_time=now, payload=payload, payload_info=describe_payload(payload)
    )
    batch = replace(case.field.batch, sent_at=now - timedelta(hours=1), received_at=now)
    answer = sync_batch(batch, [capture], None)
    assert answer.results[0].code == "clock_skew"
    item = ReviewItem.objects.select_related(
        "field_event__organization", "field_event__device", "field_event__created_by"
    ).get(field_event_id=capture.id)
    return case, item, upload, reviewer(org, make_member)


@pytest.mark.django_db
@pytest.mark.parametrize("event_type", ["incident.report", "emergency.accident"])
def test_followup_leaves_original_incident_slot_free_and_never_grants_parent_evidence(
    make_member, event_type
):
    from django.http import Http404

    from incidents.evidence import bind_evidence
    from incidents.models import Incident
    from organizations.models import Membership
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewConflictError
    from reviews.models import ReviewEffectReceipt, ReviewIncidentLink
    from uploads.access import current_scope
    from uploads.models import AttachmentLink
    from uploads.targets import authorize_download

    case, item, upload, actor = _reviewed_incident(make_member, event_type)
    source = item.field_event
    decision = decide_review(
        actor,
        item.pk,
        ReviewDecisionRequest(
            "open_incident",
            0,
            "Follow up the original observation with the current reviewer",
            [upload.public_id],
        ),
    )
    followup = ReviewIncidentLink.objects.get(decision=decision).incident
    assert followup.source_event_id is None
    assert followup.created_by_id == actor.user.pk
    assert followup.device_time >= decision.created_at
    assert followup.server_received_at == followup.device_time
    assert not decision.is_terminal
    assert not Incident.objects.filter(source_event=source).exists()
    with pytest.raises(ReviewConflictError):
        decide_review(
            actor,
            item.pk,
            ReviewDecisionRequest(
                "open_incident",
                1,
                "A duplicate current follow-up must not create another case",
                [upload.public_id],
            ),
        )
    accepted = decide_review(
        actor,
        item.pk,
        ReviewDecisionRequest(
            "accept", 1, "Verified original historical capture and current subject authority"
        ),
    )
    original_case = Incident.objects.get(source_event=source)
    assert original_case.pk != followup.pk
    assert original_case.created_by_id == source.created_by_id
    assert ReviewEffectReceipt.objects.get(decision=accepted).source_event_id == source.pk
    actual_parent = AttachmentLink.objects.get(upload=upload)
    assert actual_parent.field_event_id == source.pk
    assert actual_parent.incident_id is None
    profile = Membership.objects.get(
        organization=case.actor.organization, user=actor.user
    ).profiles.get()
    profile.permission_codes.remove("review_item.read")
    profile.save(update_fields=["permission_codes"])
    assert current_scope(actor).allows(
        "incident.read", str(followup.center_id), str(followup.quadrant_id)
    )
    with pytest.raises(Http404):
        authorize_download(actor, actual_parent)
    with pytest.raises(Http404), transaction.atomic():
        bind_evidence(actor, followup, [upload.public_id], 1)
    assert AttachmentLink.objects.get(upload=upload).field_event_id == source.pk


@pytest.mark.django_db
def test_complete_legacy_adoption_is_once_without_reapplying_cross_device_close_or_fault(
    org_a, make_member
):
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError, ReviewConflictError
    from reviews.models import ReviewEffectReceipt
    from shifts.models import MotorcycleBlockEvent, MotorcycleCheck, Shift
    from shifts.selectors import highest_recorded_km
    from shifts.validation import ShiftDecisionRequest, decide_shift
    from tests.review_support import legacy_decreased_close, legacy_severe_open, reviewer

    phone, motorcycle, opening = legacy_severe_open(org_a, make_member)
    shift = Shift.objects.get(opened_event=opening.field_event)
    closing = legacy_decreased_close(phone, shift)
    assert closing.field_event.device_id != shift.device_id
    actor = reviewer(org_a, make_member)
    close_request = ReviewDecisionRequest(
        "accept", 0, "Verified historical close on the courier's second device"
    )
    close_decision = decide_review(actor, closing.pk, close_request)
    assert ReviewEffectReceipt.objects.get(decision=close_decision).mode == "adopted_legacy"
    with pytest.raises(ReviewConflictError):
        decide_review(actor, closing.pk, close_request)
    with pytest.raises(ReviewBlockedError):
        decide_shift(
            actor,
            shift.pk,
            ShiftDecisionRequest("approve", 0, "Cannot approve the unresolved opening"),
        )
    decision = decide_review(
        actor,
        opening.pk,
        ReviewDecisionRequest(
            "accept", 0, "Historical complete opening and existing fault are proven"
        ),
    )
    assert ReviewEffectReceipt.objects.get(decision=decision).mode == "adopted_legacy"
    shift.refresh_from_db()
    motorcycle.refresh_from_db()
    assert shift.status == "closed"
    assert shift.closed_event_id == closing.field_event_id
    assert shift.odometer_close_km == shift.odometer_open_km - 1
    assert highest_recorded_km(motorcycle) == shift.odometer_open_km
    assert motorcycle.is_blocked
    assert MotorcycleCheck.objects.filter(shift=shift).count() == 3
    assert MotorcycleBlockEvent.objects.filter(field_event=opening.field_event).count() == 1
    for item in (opening, closing):
        item.field_event.refresh_from_db()
        assert item.field_event.status == "in_review"


@pytest.mark.django_db
@pytest.mark.parametrize("partial", [False, True])
def test_unadopted_frame_is_never_work_authority_and_only_complete_current_close_can_exit(
    org_a, make_member, partial
):
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewEffectReceipt
    from shifts.models import Shift
    from tests.review_support import legacy_severe_open, reviewer
    from tests.shift_support import close_event
    from tests.test_fleet_b_05 import fuel

    phone, motorcycle, item = legacy_severe_open(org_a, make_member, partial=partial)
    shift = Shift.objects.get(opened_event=item.field_event)
    work = fuel(shift.pk, motorcycle.code, 12001)
    result = phone.sync([work]).data["results"][0]
    assert (result["status"], result["code"]) == ("in_review", "causal_parent_pending")
    actor = reviewer(org_a, make_member)
    if partial:
        with pytest.raises(ReviewBlockedError):
            decide_review(
                actor,
                item.pk,
                ReviewDecisionRequest(
                    "accept", 0, "An incomplete set of historical checks is not enough"
                ),
            )
    closed = phone.sync([close_event(shift.pk)]).data["results"][0]
    assert closed["status"] == ("in_review" if partial else "accepted")
    shift.refresh_from_db()
    motorcycle.refresh_from_db()
    assert shift.status == ("open" if partial else "closed")
    assert motorcycle.is_blocked
    assert not ReviewEffectReceipt.objects.filter(source_event=item.field_event).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("quota_blocked", [False, True])
def test_missing_void_target_preserves_envelope_through_quota_replay_and_append_only_resolution(
    make_member, settings, quota_blocked
):
    from dataclasses import replace
    from datetime import timedelta

    from django.utils import timezone

    from field_sync.envelope import GpsFix, describe_payload
    from field_sync.services import sync_batch
    from ovitraps.models import OvitrapVoid
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError, ReviewConflictError
    from reviews.models import (
        ReviewDependencyResolution,
        ReviewEffectReceipt,
        ReviewItem,
        ReviewSubjectScope,
    )
    from tests.ovitrap_support import envelope, setup_field
    from tests.review_support import audit_current_membership, reviewer

    field = setup_field()
    audit_current_membership(field.membership)
    now = timezone.now()
    parent = replace(
        envelope(field),
        index=1,
        device_time=now + timedelta(microseconds=1),
        gps=GpsFix(21, -99.99, 5),
    )
    if quota_blocked:
        parent = replace(parent, schema_version=999)
        settings.SYNC_MAX_REJECTIONS_PER_DEVICE_PER_DAY = 0
    payload = {"reason_code": "other", "reason": "Correct this exact originally declared placement"}
    child = replace(
        envelope(field, "record.void"),
        index=0,
        device_time=now,
        voids_event_id=parent.id,
        payload=payload,
        payload_info=describe_payload(payload),
    )
    batch = replace(field.batch, sent_at=now, received_at=now + timedelta(microseconds=2))
    first = sync_batch(batch, [child, parent], None)
    assert (first.results[0].status, first.results[0].code) == (
        "in_review",
        "causal_parent_pending",
    )
    source = FieldEvent.objects.get(pk=child.id)
    assert source.voids_event_id is None
    retained = ReviewSourceSnapshot.objects.get(source_event=source).original_envelope
    assert retained["declared_void_target_uuid"] == str(parent.id)
    assert sync_batch(batch, [child, parent], None).results == first.results

    actor = reviewer(field.batch.organization, make_member)
    item = ReviewItem.objects.get(field_event=source)
    if quota_blocked:
        assert first.results[1].code == "rejection_quota_exceeded"
        assert not FieldEvent.objects.filter(pk=parent.id).exists()
        with pytest.raises(ReviewBlockedError):
            decide_review(
                actor,
                item.pk,
                ReviewDecisionRequest(
                    "accept", 0, "An unstored quota-limited parent cannot supply authority"
                ),
            )
        return
    target_item = ReviewItem.objects.get(field_event_id=parent.id)
    decide_review(
        actor,
        target_item.pk,
        ReviewDecisionRequest(
            "accept", 0, "Confirmed original point and placement proximity observation"
        ),
    )
    request = ReviewDecisionRequest("accept", 0, "Apply the original authorized correction once")
    decision = decide_review(actor, item.pk, request)
    with pytest.raises(ReviewConflictError):
        decide_review(actor, item.pk, request)
    assert OvitrapVoid.objects.filter(event=source, target_event_id=parent.id).count() == 1
    assert ReviewEffectReceipt.objects.get(decision=decision).materialization[
        "target_event_id"
    ] == str(parent.id)
    assert (
        ReviewDependencyResolution.objects.get(dependency__source_event=source).parent_source_id
        == parent.id
    )
    assert ReviewSubjectScope.objects.filter(source_event=source).count() == 2
    source.refresh_from_db()
    assert source.voids_event_id is None
    assert source.status == "in_review"
    assert ReviewSourceSnapshot.objects.get(source_event=source).original_envelope == retained
    assert sync_batch(batch, [child, parent], None).results == first.results


@pytest.mark.django_db
@pytest.mark.parametrize("mode", ["shared", "same", "too_fast", "other_prior", "rule_changed"])
def test_physical_pending_parent_is_shared_only_through_real_scope_and_effective_source(
    make_member,
    mode,
):
    from dataclasses import replace
    from datetime import timedelta

    from django.utils import timezone

    from field_sync.envelope import GpsFix
    from field_sync.services import sync_batch
    from organizations.models import Membership
    from ovitraps.models import Bag, OvitrapReading
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewDependencyResolution, ReviewEffectReceipt, ReviewItem
    from tests.ovitrap_support import envelope, second_courier, setup_field
    from tests.review_support import audit_current_membership, reviewer
    from tests.sync_support import configure_clock_skew

    field = setup_field()
    configure_clock_skew(field.batch.organization)
    audit_current_membership(field.membership)
    now = timezone.now()
    parent = replace(envelope(field), device_time=now)
    if mode == "too_fast":
        parent = replace(parent, gps=GpsFix(20.010, -99.99, 5))
    parent_batch = replace(field.batch, sent_at=now - timedelta(hours=1), received_at=now)
    assert sync_batch(parent_batch, [parent], None).results[0].code == (
        "ovitrap_too_far" if mode == "too_fast" else "clock_skew"
    )
    other = second_courier(field) if mode == "shared" else field.batch
    if mode == "shared":
        audit_current_membership(
            Membership.objects.get(organization=other.organization, user=other.user)
        )
    captured = timezone.now()
    child = replace(envelope(field, "ovitrap.check"), device_time=captured)
    other = replace(other, sent_at=captured, received_at=captured)
    assert sync_batch(other, [child], None).results[0].code == "causal_parent_pending"
    original_facts = ReviewSourceSnapshot.objects.get(source_event_id=child.id).facts
    child_item = ReviewItem.objects.get(field_event_id=child.id)
    actor = reviewer(field.batch.organization, make_member)
    request = ReviewDecisionRequest("accept", 0, "The real shared physical parent is now effective")
    with pytest.raises(ReviewBlockedError):
        decide_review(actor, child_item.pk, request)
    parent_item = ReviewItem.objects.get(field_event_id=parent.id)
    decide_review(
        actor,
        parent_item.pk,
        ReviewDecisionRequest("accept", 0, "Verified original placement clock and point authority"),
    )
    assert not OvitrapReading.objects.filter(event_id=child.id).exists()
    if mode == "rule_changed":
        from rules.models import RuleParameter
        from tests.factories import RuleParameterVersionFactory

        RuleParameterVersionFactory(
            parameter=RuleParameter.objects.get(
                organization=field.batch.organization, key="max_distance_to_point_m"
            ),
            value=9999,
            effective_from=child.device_time - timedelta(microseconds=1),
        )
    if mode == "other_prior":
        prior = replace(
            envelope(field, "ovitrap.check", payload={"bag_code": "B17-prior"}),
            device_time=child.device_time - timedelta(microseconds=1),
        )
        assert sync_batch(other, [prior], None).results[0].status == "accepted"
    if mode in {"too_fast", "other_prior", "rule_changed"}:
        with pytest.raises(ReviewBlockedError) as blocked:
            decide_review(actor, child_item.pk, request)
        expected = "ovitrap_speed_anomaly" if mode == "too_fast" else "capture_context_changed"
        assert any(item["reason"] == expected for item in blocked.value.blocked_by)
        assert not OvitrapReading.objects.filter(event_id=child.id).exists()
        assert not ReviewDependencyResolution.objects.filter(
            dependency__source_event_id=child.id
        ).exists()
        assert ReviewSourceSnapshot.objects.get(source_event_id=child.id).facts == original_facts
        return
    decision = decide_review(actor, child_item.pk, request)
    reading = OvitrapReading.objects.get(event_id=child.id)
    assert reading.created_by_id == other.user.pk
    assert Bag.objects.get(reading=reading).collector_id == other.user.pk
    assert (
        ReviewDependencyResolution.objects.get(
            dependency__source_event_id=child.id
        ).parent_source_id
        == parent.id
    )
    if mode == "same":
        assert ReviewEffectReceipt.objects.get(decision=decision).materialization[
            "resolved_speed_reference"
        ]["source_event_id"] == str(parent.id)
    assert ReviewSourceSnapshot.objects.get(source_event_id=child.id).facts == original_facts
