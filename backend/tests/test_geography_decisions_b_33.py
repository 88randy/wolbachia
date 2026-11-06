"""Real B33 writers and shared B17/B15 proofs; PostgreSQL execution belongs to CI."""

from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest
from django.utils import timezone

from field_sync.envelope import describe_payload
from geography.decisions.closure import close_quadrant, readiness
from geography.decisions.exceptions import GeographyDecisionConflictError
from geography.decisions.models import NextDayTask, QuadrantClosure
from geography.decisions.services import RelocationDecisionRequest, decide_relocation
from geography.models import BlockVersion, PointVersion, QuadrantVersion
from ovitraps.lifecycle.models import RelocationDecision, RelocationProposal, RemovalAttempt
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from uploads.access import UploadActor

pytestmark = pytest.mark.django_db
REASON = "Verified original capture and physical field evidence"


@pytest.fixture
def field(monkeypatch):
    from scheduling.models import AssignmentVersion
    from tests.factories import RuleParameterFactory, RuleParameterVersionFactory
    from tests.review_support import audit_current_membership

    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    case = setup_field()
    case.actor = UploadActor(case.membership.user, case.batch.organization)
    case.quadrant = case.point.block.quadrant
    case.profile.permission_codes += [
        "relocation.decide",
        "relocation.read",
        "quadrant.close",
        "quadrant.read",
        "intervention.read",
        "intervention.create",
        "review_item.read",
        "review_item.decide",
        "field.bootstrap",
        "removal.resolve",
    ]
    case.profile.save()
    audit_current_membership(case.membership)
    geometry = {
        "type": "Polygon",
        "coordinates": [[[-100, 20], [-99.98, 20], [-99.98, 20.01], [-100, 20.01], [-100, 20]]],
    }
    case.epoch = QuadrantVersion.objects.create(
        organization=case.batch.organization,
        created_by=case.batch.user,
        quadrant=case.quadrant,
        revision=1,
        effective_from=CAPTURED - timedelta(days=30),
        geometry=geometry,
    )
    BlockVersion.objects.create(
        organization=case.batch.organization,
        created_by=case.batch.user,
        block=case.point.block,
        revision=1,
        effective_from=case.epoch.effective_from,
        geometry=geometry,
    )
    case.assignment = AssignmentVersion.objects.create(
        organization=case.batch.organization,
        created_by=case.batch.user,
        quadrant=case.quadrant,
        courier=case.batch.user,
        valid_from=case.epoch.effective_from,
        version=1,
    )
    for key, value in {
        "clock_skew_review_seconds": 300,
        "closed_house_weeks_to_relocate": 2,
        "incidents_to_relocate": 3,
    }.items():
        parameter = RuleParameterFactory(organization=case.batch.organization, key=key)
        RuleParameterVersionFactory(
            parameter=parameter, value=value, effective_from=case.epoch.effective_from
        )
    return case


def lifecycle(field, kind, **overrides):
    from tests.uploads_support import verified_upload

    upload = verified_upload(field.batch.organization, field.batch.user, device=field.batch.device)
    payload = {
        "ovitrap_id": str(field.identity),
        "reason_code": "other",
        "other_text": REASON,
        "evidence_ids": [str(upload.public_id)],
    }
    payload.update(
        {"proposed_location": [-99.9901, 20.0051]}
        if kind == "relocate"
        else {"is_recovered": False}
    )
    payload.update(overrides)
    sent = envelope(field, f"ovitrap.{kind}")
    return replace(sent, payload=payload, payload_info=describe_payload(payload))


def proposal(field):
    assert ingest(field, envelope(field)).status == "accepted"
    sent = lifecycle(field, "relocate")
    assert ingest(field, sent).status == "accepted"
    return RelocationProposal.objects.get(event_id=sent.id)


def test_approval_appends_same_fixed_code_version_and_preserves_source(field):
    from field_sync.models import CourierChange
    from geography.decisions.producers import proposal_payload

    source = proposal(field)
    original = (
        source.event.payload,
        source.event.status,
        source.event.device_time,
        source.event.server_received_at,
        source.evidence_ids,
    )
    result = decide_relocation(
        field.actor, source.pk, RelocationDecisionRequest("approved", REASON, 0)
    )
    assert result.point_version.point_id == field.point.pk
    assert result.point_version.version == 2
    assert result.point_version.point.code == field.point.code
    assert result.point_version.location == source.new_location
    assert result.point_version.effective_from == result.decision.decided_at
    assert result.decision.event_id == source.event_id
    assert result.decision.created_by_id == field.actor.user.pk
    source.refresh_from_db()
    assert (
        source.event.payload,
        source.event.status,
        source.event.device_time,
        source.event.server_received_at,
        source.evidence_ids,
    ) == original
    assert not NextDayTask.objects.exists()
    assert PointVersion.objects.filter(point=field.point).count() == 2
    history = CourierChange.objects.filter(resource_type="history.relocation_proposal").latest(
        "sequence"
    )
    assert history.payload == proposal_payload(source)
    assert history.payload["decision"]["published_point_version"] == str(result.point_version.pk)
    assert "sampling_point.create" not in field.profile.permission_codes


def test_rejection_retries_keep_one_real_local_day_task_owner_and_delivery(field, monkeypatch):
    from datetime import UTC, datetime

    from field_sync.cursor import ChangesCursor, decode_cursor
    from field_sync.models import CourierChange
    from field_sync.services import bootstrap_bundle, sync_batch
    from geography.decisions import services
    from organizations.models import all_scope
    from scheduling.models import AssignmentVersion, ScheduledTask, TaskOwnership
    from tests.ovitrap_support import second_courier

    source = proposal(field)
    decision_time = datetime(2026, 2, 5, 5, 59, 59, tzinfo=UTC)
    other = second_courier(field)
    AssignmentVersion.objects.create(
        organization=field.batch.organization,
        created_by=field.batch.user,
        quadrant=field.quadrant,
        courier=other.user,
        version=2,
        valid_from=datetime(2026, 2, 6, 6, tzinfo=UTC),
    )
    clock = [decision_time]
    monkeypatch.setattr(timezone, "now", lambda: clock[0])
    append = services._append_decision

    def cross_midnight(*args):
        clock[0] = decision_time + timedelta(seconds=2)
        return append(*args)

    monkeypatch.setattr(services, "_append_decision", cross_midnight)
    result = decide_relocation(
        field.actor, source.pk, RelocationDecisionRequest("rejected", REASON, 0)
    )
    task = result.next_day_task.task
    assert task.due_date.isoformat() == "2026-02-05"
    assert result.decision.decided_at == decision_time
    assert result.decision.created_at == clock[0]
    assert TaskOwnership.objects.get(task=task).courier_id == field.batch.user.pk
    assert result.next_day_task.proposal_id == source.pk
    with pytest.raises(GeographyDecisionConflictError):
        decide_relocation(field.actor, source.pk, RelocationDecisionRequest("rejected", REASON, 0))
    assert (
        ScheduledTask.objects.count()
        == NextDayTask.objects.count()
        == RelocationDecision.objects.count()
        == 1
    )
    change = CourierChange.objects.get(
        kind="assignments", resource_type="task", resource_id=str(task.pk)
    )
    assert change.payload["is_completed"] is False
    assert change.courier_id == field.batch.user.pk
    assert change.payload["due_date"] == task.due_date.isoformat()
    first = sync_batch(field.batch, [], ChangesCursor())
    replay = sync_batch(field.batch, [], ChangesCursor())
    assert first.changes.history == replay.changes.history
    delivered = [
        row["data"] for row in first.changes.history if row["data"]["id"] == str(source.pk)
    ]
    assert [row["status"] for row in delivered] == ["pending", "rejected"]
    assert delivered[-1]["decision"]["reason"] == REASON
    advanced = decode_cursor(first.changes.cursor, field.batch.organization.pk, field.batch.user.pk)
    assert not sync_batch(field.batch, [], advanced).changes.history
    assert bootstrap_bundle(field.batch)["history"] == [delivered[-1]]
    field.profile.scope = {**all_scope(), "centers": {"mode": "none", "ids": []}}
    field.profile.save()
    assert not sync_batch(field.batch, [], ChangesCursor()).changes.history
    assert not bootstrap_bundle(field.batch)["history"]


def test_stale_point_cannot_be_approved_and_failure_rolls_back_all_effects(field, monkeypatch):
    source = proposal(field)
    PointVersion.objects.create(
        organization=field.batch.organization,
        created_by=field.batch.user,
        point=field.point,
        version=2,
        location=source.old_location,
        effective_from=CAPTURED,
    )
    with pytest.raises(GeographyDecisionConflictError):
        decide_relocation(field.actor, source.pk, RelocationDecisionRequest("approved", REASON, 0))
    assert not RelocationDecision.objects.exists()
    assert PointVersion.objects.filter(point=field.point).count() == 2

    def fail_publication(*args, **kwargs):
        raise RuntimeError("deliberate atomic rollback probe")

    monkeypatch.setattr("geography.decisions.producers.publish_proposal", fail_publication)
    with pytest.raises(RuntimeError, match="atomic rollback"):
        decide_relocation(field.actor, source.pk, RelocationDecisionRequest("rejected", REASON, 0))
    from scheduling.models import ScheduledTask

    assert not RelocationDecision.objects.exists()
    assert not NextDayTask.objects.exists()
    assert not ScheduledTask.objects.exists()


def test_readiness_distinguishes_live_physical_unrecovered_and_pending_source(field):
    assert ingest(field, envelope(field)).status == "accepted"
    assert "removal_unconfirmed" in {
        row["reason"] for row in readiness(field.actor, field.quadrant)["blockers"]
    }
    retained = lifecycle(field, "remove")
    original_batch = field.batch
    field.batch = replace(original_batch, is_final_upload=True)
    assert ingest(field, retained).status == "in_review"
    assert not RemovalAttempt.objects.exists()
    assert "removal_review_pending" in {
        row["reason"] for row in readiness(field.actor, field.quadrant)["blockers"]
    }
    field.batch = original_batch
    assert ingest(field, lifecycle(field, "remove")).status == "accepted"
    reasons = {row["reason"] for row in readiness(field.actor, field.quadrant)["blockers"]}
    assert "removal_unrecovered" in reasons
    assert "removal_unconfirmed" not in reasons
    with pytest.raises(GeographyDecisionConflictError):
        close_quadrant(field.actor, field.quadrant.pk, 1)
    assert not QuadrantClosure.objects.exists()


@pytest.mark.parametrize("hold_kind", ["dispatch", "quadrant_closure"])
def test_only_actual_owned_closure_hold_survives_its_separate_217_resolution(field, hold_kind):
    from incidents.configuration import write_type
    from incidents.services import report
    from ovitraps.lifecycle.services import RemovalResolutionRequest, resolve_removal
    from tests.test_incidents_b_06 import configured

    assert ingest(field, envelope(field)).status == "accepted"
    assert ingest(field, lifecycle(field, "remove")).status == "accepted"
    removal = RemovalAttempt.objects.get()
    case = configured(field)
    version = write_type(
        case.actor, {"expected_revision": 1, "blocker_kinds": [hold_kind]}, case.version.item_id
    )
    incident = report(
        case.actor,
        {
            **case.data,
            "type_id": version.pk,
            "resource_ref": {"kind": "ovitrap_marker", "id": removal.incident_link_id},
        },
    )
    resolve_removal(
        field.membership, removal.pk, RemovalResolutionRequest("unrecovered", "written_off", REASON)
    )
    state = readiness(field.actor, field.quadrant)
    assert (not state["can_close"]) is (hold_kind == "quadrant_closure")
    if hold_kind == "quadrant_closure":
        assert state["blockers"][0]["id"] == str(incident.pk)
        field.profile.permission_codes.remove("incident.read")
        field.profile.save()
        opaque = readiness(field.actor, field.quadrant)["blockers"]
        assert opaque == [
            {"reason": "incident_quadrant_closure", "permission": "incident.close", "link": ""}
        ]
    else:
        assert (
            close_quadrant(field.actor, field.quadrant.pk, 1).quadrant_version_id == field.epoch.pk
        )


def test_unadopted_legacy_recovered_row_does_not_confirm_physical_retirement(field, monkeypatch):
    from tests import test_ovitraps_lifecycle_b_15 as lifecycle_tests
    from tests.test_review_legacy_113 import _legacy_capture

    make_legacy = lifecycle_tests.lifecycle
    monkeypatch.setattr(
        lifecycle_tests,
        "lifecycle",
        lambda field, kind: make_legacy(field, kind, payload={"is_recovered": True}),
    )
    item = _legacy_capture(field, "remove")
    assert RemovalAttempt.objects.get().is_recovered is True
    from reviews.effect_receipts import is_effective

    assert not is_effective(item.field_event)
    assert "removal_unconfirmed" in {
        row["reason"] for row in readiness(field.actor, field.quadrant)["blockers"]
    }
    with pytest.raises(GeographyDecisionConflictError):
        close_quadrant(field.actor, field.quadrant.pk, 1)


@pytest.mark.parametrize("postclose", [False, True])
def test_late_source_has_no_effects_and_only_proven_preclose_work_applies_once(
    field, monkeypatch, postclose
):
    from field_sync.models import FieldEvent
    from ovitraps.models import Ovitrap
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError, ReviewConflictError
    from reviews.models import ReviewEffectReceipt, ReviewItem, ReviewSourceSnapshot
    from scheduling.models import ScheduledTask

    monkeypatch.setattr(timezone, "now", lambda: CAPTURED + timedelta(hours=1))
    closure = close_quadrant(field.actor, field.quadrant.pk, 1)
    original = envelope(field, device_time=CAPTURED + timedelta(hours=1) if postclose else CAPTURED)
    field.batch = replace(
        field.batch,
        sent_at=CAPTURED + timedelta(hours=2),
        received_at=CAPTURED + timedelta(hours=2),
    )
    monkeypatch.setattr(timezone, "now", lambda: field.batch.received_at)
    result = ingest(field, original)
    expected = "captured_after_quadrant_close" if postclose else "late_work_after_quadrant_close"
    assert result.status == "in_review"
    assert result.code == expected
    assert not Ovitrap.objects.exists()
    assert not ScheduledTask.objects.exists()
    source = FieldEvent.objects.get(pk=original.id)
    observed = ReviewSourceSnapshot.objects.get(source_event=source).facts["owner"]
    assert observed["ovitrap"]["point_version_id"] == str(field.point.versions.first().pk)
    assert observed["ovitrap"]["rules"]
    assert observed["ovitrap"]["rule_version_ids"]
    assert observed["geography_epoch"]["quadrant_version_id"] == str(field.epoch.pk)
    assert observed["geography_epoch"]["assignment_version_id"] == str(field.assignment.pk)
    assert observed["geography_epoch"]["closure_id"] == str(closure.pk)
    item = ReviewItem.objects.get(field_event=source)
    request = ReviewDecisionRequest("accept", 0, REASON)
    if postclose:
        with pytest.raises(ReviewBlockedError):
            decide_review(field.actor, item.pk, request)
        assert not Ovitrap.objects.exists()
        assert not ReviewEffectReceipt.objects.exists()
    else:
        decide_review(field.actor, item.pk, request)
        assert Ovitrap.objects.get().event_id == source.pk
        assert ReviewEffectReceipt.objects.get().source_event_id == source.pk
        with pytest.raises(ReviewConflictError):
            decide_review(field.actor, item.pk, request)
    source.refresh_from_db()
    assert source.status == "in_review"
    assert source.status_code == expected
    assert source.device_time == original.device_time
    assert source.payload == original.payload
    assert ingest(field, original).code == expected
    assert QuadrantClosure.objects.get().pk == closure.pk
    assert QuadrantVersion.objects.count() == PointVersion.objects.count() == 1
    assert not ScheduledTask.objects.exists()
    if not postclose:
        from geography.decisions.retirements import closure_dependency
        from tests.test_ovitraps_lifecycle_b_15 import void_event

        removed = replace(
            lifecycle(field, "remove", is_recovered=True),
            device_time=CAPTURED + timedelta(seconds=10),
        )
        assert ingest(field, removed).code == "late_work_after_quadrant_close"
        removal_item = ReviewItem.objects.get(field_event_id=removed.id)
        decide_review(field.actor, removal_item.pk, ReviewDecisionRequest("accept", 0, REASON))
        assert RemovalAttempt.objects.get().event_id == removed.id
        assert (
            closure_dependency(closure.readiness_snapshot, removed.id, field.epoch.revision)
            is False
        )
        correction = replace(void_event(field, removed), device_time=field.batch.received_at)
        assert ingest(field, correction).status == "accepted"
        assert QuadrantClosure.objects.get().pk == closure.pk


def test_closed_epoch_void_retains_real_removal_and_closure_dependency(
    field, monkeypatch, api_client, make_member
):
    from core.snapshots import snapshot_hash
    from field_sync.cursor import ChangesCursor, decode_cursor
    from field_sync.models import CourierChange
    from field_sync.services import bootstrap_bundle, sync_batch
    from geography.decisions import closure as closure_services
    from geography.models import Quadrant
    from geography.services import QuadrantPublication, publish_quadrant
    from organizations.models import all_scope
    from tests.factories import DeviceFactory
    from tests.test_ovitraps_lifecycle_b_15 import void_event

    field.profile.permission_codes.append("quadrant.publish")
    field.profile.save(update_fields=["permission_codes"])
    observer, observer_member = make_member(field.batch.organization, ("quadrant.close",))
    observer_member.scope = all_scope()
    observer_member.save()
    observer_member.profiles.update(scope=all_scope())
    hidden = Quadrant.objects.create(
        organization=field.batch.organization,
        center=field.quadrant.center,
        code="Q-outside-download",
        created_by=field.batch.user,
    )
    other, other_member = make_member(
        field.batch.organization, ("field_event.sync", "field.bootstrap")
    )
    other_member.scope = {**all_scope(), "quadrants": {"mode": "selected", "ids": [str(hidden.pk)]}}
    other_member.save()
    other_member.profiles.update(scope=all_scope())
    other_batch = replace(
        field.batch, user=other, device=DeviceFactory(organization=field.batch.organization)
    )
    assert ingest(field, envelope(field)).status == "accepted"
    removal = lifecycle(field, "remove", is_recovered=True)
    assert ingest(field, removal).status == "accepted"
    monkeypatch.setattr(timezone, "now", lambda: CAPTURED + timedelta(hours=1))
    initial = bootstrap_bundle(field.batch)["quadrants"]
    opened = next(row for row in initial if row["resource_type"] == "quadrant")
    assert opened["is_closed"] is False
    assert opened["closure_id"] is None
    block = next(row for row in initial if row["resource_type"] == "block")
    assert "is_closed" not in block
    assert "closure_id" not in block
    before = sync_batch(field.batch, [], ChangesCursor())
    cursor = decode_cursor(before.changes.cursor, field.batch.organization.pk, field.batch.user.pk)
    count = CourierChange.objects.count()
    publish = closure_services.emit_geography_reference

    def interrupted_publication(*args):
        publish(*args)
        raise RuntimeError("deliberate closure publication interruption")

    with monkeypatch.context() as fault:
        fault.setattr(closure_services, "emit_geography_reference", interrupted_publication)
        with pytest.raises(RuntimeError, match="publication interruption"):
            close_quadrant(field.actor, field.quadrant.pk, 1)
    assert not QuadrantClosure.objects.exists()
    assert CourierChange.objects.count() == count
    closure = close_quadrant(field.actor, field.quadrant.pk, 1)
    pulled = sync_batch(field.batch, [], cursor)
    assert len(pulled.changes.quadrants) == 1
    change = pulled.changes.quadrants[0]
    closed = next(
        row
        for row in bootstrap_bundle(field.batch)["quadrants"]
        if row["resource_type"] == "quadrant"
    )
    assert change["data"] == closed
    assert closed["is_closed"] is True
    assert closed["closure_id"] == str(closure.pk)
    assert change["resource_version"] == snapshot_hash(closed)
    assert change["resource_version"] != snapshot_hash(opened)
    assert not sync_batch(other_batch, [], ChangesCursor()).changes.quadrants
    assert not bootstrap_bundle(other_batch)["quadrants"]
    result = ingest(field, void_event(field, removal))
    assert result.code == "ovitrap_void_blocked"
    assert {"resource": "quadrant_closure", "id": str(closure.pk)} in result.params["blocked_by"]
    assert RemovalAttempt.objects.get().event.voided_at is None
    api_client.force_authenticate(observer)
    response = api_client.get(f"/api/v1/quadrants/{field.quadrant.pk}/closure/")
    assert response.status_code == 200, response.data
    assert "readiness_snapshot" not in response.data["closure"]
    assert str(removal.id) not in str(response.data)
    assert "retirements" not in str(response.data)
    advanced = decode_cursor(
        pulled.changes.cursor, field.batch.organization.pk, field.batch.user.pk
    )
    publish_quadrant(
        field.quadrant, QuadrantPublication(field.membership, 1, field.epoch.geometry, ())
    )
    refreshed = sync_batch(field.batch, [], advanced).changes.quadrants
    reopened = next(
        row
        for row in bootstrap_bundle(field.batch)["quadrants"]
        if row["resource_type"] == "quadrant"
    )
    assert [row["data"] for row in refreshed] == [reopened]
    assert reopened["revision"] == 2
    assert reopened["is_closed"] is False
    assert reopened["closure_id"] is None
    assert QuadrantClosure.objects.get().pk == closure.pk


def test_current_grant_cannot_replace_missing_original_authority_for_late_work(field, monkeypatch):
    from ovitraps.models import Ovitrap
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewItem
    from tests.ovitrap_support import second_courier

    monkeypatch.setattr(timezone, "now", lambda: CAPTURED + timedelta(hours=1))
    close_quadrant(field.actor, field.quadrant.pk, 1)
    field.batch = replace(
        second_courier(field),
        sent_at=CAPTURED + timedelta(hours=2),
        received_at=CAPTURED + timedelta(hours=2),
    )
    captured = envelope(field)
    assert ingest(field, captured).code == "late_work_after_quadrant_close"
    item = ReviewItem.objects.get(field_event_id=captured.id)
    with pytest.raises(ReviewBlockedError) as denied:
        decide_review(field.actor, item.pk, ReviewDecisionRequest("accept", 0, REASON))
    assert "authority_history_unavailable" in {row["reason"] for row in denied.value.blocked_by}
    assert not Ovitrap.objects.exists()


def test_intervention_other_scope_and_real_block_vector_are_atomic(field):
    from datetime import date

    from django.http import Http404

    from catalogs.models import CatalogItem
    from core.exceptions import FieldValidationError
    from geography.decisions.interventions import (
        InterventionRequest,
        create_intervention,
        visible_interventions,
    )
    from geography.decisions.models import ThirdPartyIntervention

    other = CatalogItem.objects.get(
        organization=field.batch.organization, catalog__slug="intervention-type", code="other"
    )
    request = InterventionRequest(
        other.pk,
        "External treatment",
        "Third-party report",
        (field.point.block_id,),
        date(2026, 2, 1),
        date(2026, 2, 2),
    )
    with pytest.raises(FieldValidationError):
        create_intervention(field.actor, request)
    request = replace(request, other_text=REASON)
    with pytest.raises(Http404):
        create_intervention(field.actor, replace(request, blocks=(*request.blocks, uuid4())))
    assert not ThirdPartyIntervention.objects.exists()
    row = create_intervention(field.actor, request)
    assert row.type_code == "other"
    assert row.blocks.get().block_id == field.point.block_id
    assert list(visible_interventions(field.actor)) == [row]
    assert not QuadrantClosure.objects.exists()
    assert not RelocationDecision.objects.exists()


def test_one_endpoint_default_deny_foreign_org_and_paired_scope(field, api_client, make_member):
    from organizations.models import all_scope
    from tests.factories import OrganizationFactory

    source = proposal(field)
    route = f"/api/v1/relocations/{source.pk}/approve/"
    payload = {"reason": REASON, "expected_revision": 0}
    denied, _ = make_member(field.batch.organization, ())
    api_client.force_authenticate(denied)
    assert api_client.post(route, payload).status_code == 403
    foreign, _ = make_member(OrganizationFactory(), ("relocation.decide",))
    api_client.force_authenticate(foreign)
    assert api_client.post(route, payload).status_code == 404
    api_client.force_authenticate(field.batch.user)
    for dimension, identifier in (("centers", uuid4()), ("quadrants", uuid4())):
        scoped = all_scope()
        scoped[dimension] = {"mode": "selected", "ids": [str(identifier)]}
        field.profile.scope = scoped
        field.profile.save()
        assert api_client.post(route, payload).status_code == 404
    field.profile.scope = all_scope()
    field.profile.save()
    response = api_client.post(route, payload)
    assert response.status_code == 201, response.data
    assert response.data["point_version"]["version"] == 2


@pytest.mark.django_db(transaction=True)
def test_decision_barrier_one_winner_then_stale_conflict(field, monkeypatch):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection

    from field_sync.exceptions import SyncInProgressError
    from geography.decisions import services
    from reviews.models import HistoryPublicationReceipt

    source = proposal(field)
    entered, release = threading.Event(), threading.Event()
    append = services._append_decision

    def held_append(*args):
        entered.set()
        assert release.wait(timeout=10)
        return append(*args)

    monkeypatch.setattr(services, "_append_decision", held_append)

    def winner():
        try:
            return decide_relocation(
                field.actor, source.pk, RelocationDecisionRequest("approved", REASON, 0)
            )
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(winner)
        try:
            assert entered.wait(timeout=10)
            with pytest.raises(SyncInProgressError):
                decide_relocation(
                    field.actor, source.pk, RelocationDecisionRequest("rejected", REASON, 0)
                )
        finally:
            release.set()
        result = job.result(timeout=10)
    with pytest.raises(GeographyDecisionConflictError):
        decide_relocation(field.actor, source.pk, RelocationDecisionRequest("rejected", REASON, 0))
    assert RelocationDecision.objects.count() == 1
    assert PointVersion.objects.filter(point=field.point).count() == 2
    assert HistoryPublicationReceipt.objects.filter(cause_id=result.decision.pk).count() == 1
    assert not NextDayTask.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_closure_and_removal_void_share_arbiter_and_preserve_the_winning_epoch(field, monkeypatch):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection

    from field_sync.exceptions import SyncInProgressError
    from geography.decisions import closure as services
    from tests.test_ovitraps_lifecycle_b_15 import void_event

    assert ingest(field, envelope(field)).status == "accepted"
    removed = lifecycle(field, "remove", is_recovered=True)
    assert ingest(field, removed).status == "accepted"
    entered, release = threading.Event(), threading.Event()
    inspect = services._readiness

    def held_readiness(*args):
        entered.set()
        assert release.wait(timeout=10)
        return inspect(*args)

    monkeypatch.setattr(services, "_readiness", held_readiness)

    def winner():
        try:
            return close_quadrant(field.actor, field.quadrant.pk, 1)
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(winner)
        try:
            assert entered.wait(timeout=10)
            with pytest.raises(SyncInProgressError):
                ingest(field, void_event(field, removed))
        finally:
            release.set()
        closed = job.result(timeout=10)
    assert ingest(field, void_event(field, removed)).code == "ovitrap_void_blocked"
    assert QuadrantClosure.objects.get().pk == closed.pk
    assert RemovalAttempt.objects.get().event.voided_at is None


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", ["close", "ingest"])
def test_closure_and_incoming_removal_share_real_organization_arbiter(field, monkeypatch, first):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection
    from rest_framework.test import APIClient

    from accounts.services import DeviceInfo, start_device_session
    from field_sync.exceptions import SyncInProgressError
    from field_sync.models import FieldEvent
    from geography.decisions.retirements import closure_physical
    from organizations.models import all_scope
    from ovitraps.models import Ovitrap
    from reviews.models import ReviewEffectReceipt
    from tests.factories import MembershipFactory, ProfileFactory
    from tests.sync_support import Phone, event

    field.profile.permission_codes.remove("field.bootstrap")
    field.profile.save(update_fields=["permission_codes"])
    member = MembershipFactory(organization=field.batch.organization, scope=all_scope())
    member.profiles.add(
        ProfileFactory(
            organization=field.batch.organization,
            scope=all_scope(),
            permission_codes=["quadrant.close"],
        )
    )
    closer = UploadActor(member.user, field.batch.organization)
    assert closer.user.pk != field.batch.user.pk
    now = CAPTURED + timedelta(hours=2)
    monkeypatch.setattr(timezone, "now", lambda: now)
    issued = start_device_session(
        field.batch.user, field.batch.organization, DeviceInfo(field.batch.device.pk)
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    phone = Phone(client, field.batch.user, field.batch.organization, field.batch.device.pk, issued)
    captured = [
        envelope(field),
        replace(lifecycle(field, "remove"), device_time=CAPTURED + timedelta(seconds=1)),
    ]
    wire = [
        event(
            id=str(sent.id),
            type=sent.type,
            device_time=sent.device_time.isoformat(),
            payload=sent.payload,
            rules_version=sent.rules_version,
            catalog_version=sent.catalog_version,
            gps={"lat": sent.gps.lat, "lng": sent.gps.lng, "accuracy_m": sent.gps.accuracy_m},
        )
        for sent in captured
    ]
    before_org, held, release = threading.Event(), threading.Event(), threading.Event()

    def hold_actual_arbiter(execute, sql, params, many, context):
        if (
            'FROM "organizations_organization"' in sql
            and "FOR NO KEY UPDATE NOWAIT" in sql
            and not held.is_set()
        ):
            before_org.set()
            result = execute(sql, params, many, context)
            held.set()
            assert release.wait(timeout=10), "The real organization arbiter was not released."
            return result
        return execute(sql, params, many, context)

    def winner():
        try:
            with connection.execute_wrapper(hold_actual_arbiter):
                return (
                    close_quadrant(closer, field.quadrant.pk, 1)
                    if first == "close"
                    else phone.sync(wire, sent_at=now.isoformat())
                )
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(winner)
        try:
            assert before_org.wait(timeout=10)
            assert held.wait(timeout=10)
            if first == "close":
                busy = phone.sync(wire, sent_at=now.isoformat())
                assert busy.status_code == 429, busy.data
            else:
                with pytest.raises(SyncInProgressError):
                    close_quadrant(closer, field.quadrant.pk, 1)
            assert not FieldEvent.objects.filter(pk__in=[sent.id for sent in captured]).exists()
        finally:
            release.set()
        outcome = job.result(timeout=10)

    if first == "close":
        outcome = phone.sync(wire, sent_at=now.isoformat())  # One retry of the identical batch.
        assert outcome.status_code == 200, outcome.data
        assert [row["code"] for row in outcome.data["results"]] == [
            "late_work_after_quadrant_close",
            "causal_parent_pending",
        ]
        assert not Ovitrap.objects.exists()
        assert not RemovalAttempt.objects.exists()
        assert not ReviewEffectReceipt.objects.exists()
        closed = QuadrantClosure.objects.get()
        assert closed.readiness_snapshot["retirements"] == []
        assert closed.quadrant_version_id == field.epoch.pk
        assert closed.closed_at == now
        expected = ["in_review", "in_review"]
    else:
        assert outcome.status_code == 200, outcome.data
        with pytest.raises(GeographyDecisionConflictError) as blocked:
            close_quadrant(
                closer, field.quadrant.pk, 1
            )  # One retry after the actual removal commit.
        assert "removal_unrecovered" in {row["reason"] for row in blocked.value.blocked_by}
        assert not QuadrantClosure.objects.exists()
        removal = RemovalAttempt.objects.get()
        assert removal.event_id == captured[1].id
        assert removal.is_recovered is False
        active, proof = closure_physical(field.quadrant)
        assert active == []
        assert [row["event_id"] for row in proof] == [str(captured[1].id)]
        expected = ["accepted", "accepted"]
    for sent, status in zip(captured, expected, strict=True):
        original = FieldEvent.objects.get(pk=sent.id)
        assert original.status == status
        assert original.payload == sent.payload
        assert original.payload_sha256 == sent.payload_info.sha256
        assert original.device_time == sent.device_time
        assert original.server_received_at == now
        assert original.rules_version == sent.rules_version
        assert original.catalog_version == sent.catalog_version
        assert original.clock_skew_seconds == 0
