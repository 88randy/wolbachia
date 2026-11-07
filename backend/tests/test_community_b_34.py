"""B34 owns aggregate capture, exact replay and scoped lifecycle wiring once."""

from uuid import uuid4

import pytest

from community.payloads import CommunityActivityPayload


def activity_payload() -> dict:
    return {
        "type_id": str(uuid4()),
        "zone_id": str(uuid4()),
        "attendance": 0,
        "agreements": "Nonidentifying aggregate agreement",
    }


def test_community_wire_preserves_explicit_zero_and_refuses_identity_or_unsafe_counts():
    original = activity_payload()
    accepted = CommunityActivityPayload(data=original)
    assert accepted.is_valid(), accepted.errors
    assert accepted.validated_data["attendance"] == 0
    for invalid in (True, 1.0, "1", [], {}, -1, 2**53):
        body = {**original, "attendance": invalid}
        captured = CommunityActivityPayload(data=body)
        assert not captured.is_valid(), body
        assert "attendance" in captured.errors
    for forbidden in (
        "resident_name",
        "phone",
        "residents",
        "organization_id",
        "author",
        "unknown",
    ):
        captured = CommunityActivityPayload(data={**original, forbidden: "not accepted"})
        assert not captured.is_valid(), forbidden
        assert forbidden in captured.errors
    for unsafe in ("hidden\x00control", "bidi\u202ereordered", "x" * 1001):
        captured = CommunityActivityPayload(data={**original, "agreements": unsafe})
        assert not captured.is_valid(), unsafe
        assert "agreements" in captured.errors


def test_community_other_link_wording_and_command_origin_are_exact(settings):
    from rest_framework.exceptions import ValidationError

    from community.policy import command_hash, validate_words

    payload = {**activity_payload(), "other_text": "Named aggregate outreach", "incident_id": None}
    validate_words(payload, {"is_other": True, "code": "other"})
    with pytest.raises(ValidationError):
        validate_words({**payload, "other_text": "\u200b "}, {"is_other": True})
    with pytest.raises(ValidationError):
        validate_words(payload, {"is_other": False, "code": "configured"})
    with pytest.raises(ValidationError):
        validate_words(
            {**payload, "incident_id": uuid4(), "agreements": "\u200b "}, {"is_other": True}
        )
    actor = uuid4()
    frame = {"origin": "http", "target": uuid4(), "body": payload}
    original = command_hash(actor, "create", frame)
    assert command_hash(actor, "create", dict(reversed(list(frame.items())))) == original
    assert command_hash(actor, "create", {**frame, "origin": "field"}) != original
    assert command_hash(uuid4(), "create", frame) != original
    assert command_hash(actor, "void", frame) != original
    assert command_hash(actor, "create", {**frame, "target": uuid4()}) != original
    from community.policy import normalize_void_reason

    settings.VOID_REASON_MIN_LENGTH = 1
    for insufficient in ("", "short", "ninechars", "a\u200b \u0301"):
        with pytest.raises(ValidationError):
            normalize_void_reason(insufficient)
    assert normalize_void_reason("  e\u0301abcdefghi\r\n  ") == "éabcdefghi"
    with pytest.raises(ValidationError):
        normalize_void_reason("a" * 1001)
    from community.review import _source_void_reason

    with pytest.raises(ValidationError):
        _source_void_reason({"reason_code": "other", "reason": 12345})
    assert _source_void_reason({"reason_code": "other", "reason": 1234567890}) == "1234567890"
    for structured in ([], {}):
        with pytest.raises(ValidationError):
            _source_void_reason({"reason_code": "other", "reason": structured})
    from community.review import _snapshot_choices
    from field_sync.exceptions import EventNeedsReview

    identifier = uuid4()
    retained = {
        "id": str(identifier),
        "code": "other",
        "label_es": "Otro",
        "label_en": "Other",
        "is_other": True,
        "requires_photo": False,
    }
    content = {"catalogs": [{"slug": "community-activity-type", "items": [retained]}]}
    assert _snapshot_choices(content, identifier) == [retained]
    with pytest.raises(EventNeedsReview):
        _snapshot_choices(
            {"catalogs": [{"slug": "community-activity-type", "items": [{"id": str(identifier)}]}]},
            identifier,
        )


def community_context(organization, make_member, monkeypatch):
    from datetime import UTC, datetime, timedelta
    from types import SimpleNamespace

    from catalogs.history import remember_catalog_snapshot
    from catalogs.models import CatalogItem
    from catalogs.seeds import seed_default_catalogs
    from catalogs.selectors import build_catalog_snapshot
    from geography.models import Block, BlockVersion, Quadrant
    from organizations.models import Center, Membership, all_scope
    from tests.review_support import audit_current_membership
    from tests.sync_support import configure_clock_skew, make_phone
    from uploads.access import UploadActor

    clock = {"now": datetime(2026, 6, 4, 23, 59, tzinfo=UTC)}
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock["now"])
    codes = (
        "community_activity.read",
        "community_activity.create",
        "community_activity.void",
        "field_event.sync",
        "field.bootstrap",
        "incident.read",
        "incident.create",
        "incident.close",
        "incident.manage_type",
        "organization.update",
        "role.update",
        "review_item.read",
        "review_item.decide",
    )
    phone = make_phone(make_member, organization, codes=codes)
    member = Membership.objects.get(organization=organization, user=phone.user)
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    seed_default_catalogs(organization)
    configure_clock_skew(organization)
    center = Center.objects.create(
        organization=organization,
        created_by=phone.user,
        code="C-127",
        name="Synthetic community center",
    )
    quadrant = Quadrant.objects.create(
        organization=organization, created_by=phone.user, center=center, code="Q-127"
    )
    block = Block.objects.create(
        organization=organization, created_by=phone.user, quadrant=quadrant, code="B-127"
    )
    version = BlockVersion.objects.create(
        organization=organization,
        created_by=phone.user,
        block=block,
        revision=1,
        effective_from=clock["now"] - timedelta(days=1),
        geometry={
            "type": "Polygon",
            "coordinates": [[[-100, 20], [-99.99, 20], [-99.99, 20.01], [-100, 20.01], [-100, 20]]],
        },
    )
    snapshot = remember_catalog_snapshot(
        organization, phone.user, build_catalog_snapshot(organization)
    )
    type_item = CatalogItem.objects.get(
        organization=organization, catalog__slug="community-activity-type", is_other=True
    )
    audit_current_membership(member)
    clock["now"] += timedelta(minutes=1)
    values = {
        "type_id": type_item.pk,
        "zone_id": block.pk,
        "attendance": 7,
        "agreements": "Anonymous aggregate agreement",
        "other_text": "Community aggregate outreach",
        "incident_id": None,
    }
    return SimpleNamespace(
        phone=phone,
        actor=UploadActor(phone.user, organization),
        member=member,
        profile=profile,
        block=block,
        version=version,
        type=type_item,
        snapshot=snapshot,
        values=values,
        clock=clock,
        codes=codes,
    )


def community_source(context, **overrides):
    from community.policy import json_value
    from tests.sync_support import event

    return event(
        type="community.activity",
        catalog_version=context.snapshot.version,
        payload=json_value(context.values),
        device_time=context.clock["now"].isoformat(),
        **overrides,
    )


@pytest.mark.django_db
def test_dual_transport_replay_retains_original_clock_type_and_one_activity(
    org_a, make_member, monkeypatch
):
    from dataclasses import replace
    from datetime import timedelta

    from community.exceptions import CommunityConflictError
    from community.models import CommunityActivity, CommunityActivityEvent, CommunityCommandReceipt
    from community.services import ActivityCommand, create_activity
    from field_sync.models import FieldEvent

    context = community_context(org_a, make_member, monkeypatch)
    identifier = uuid4()
    command = ActivityCommand(context.actor, identifier, context.values)
    receipt = create_activity(command)
    stored = CommunityActivity.objects.get(pk=identifier)
    context.clock["now"] += timedelta(days=1)
    assert create_activity(command) == receipt
    assert stored.activity_date == CommunityActivity.objects.get(pk=identifier).activity_date
    assert stored.type_snapshot == CommunityActivity.objects.get(pk=identifier).type_snapshot
    with pytest.raises(CommunityConflictError):
        create_activity(replace(command, values={**command.values, "attendance": 8}))
    from tests.sync_support import second_device_of

    context.phone = second_device_of(context.phone)  # Genuine current bearer after the day change.
    conflict = community_source(context, id=str(identifier))
    response = context.phone.sync([conflict])
    assert response.status_code == 200
    assert response.data["results"][0]["code"] == "community_command_conflict"
    capture = community_source(context)
    first = context.phone.sync([capture])
    second = context.phone.sync([capture])
    assert first.status_code == second.status_code == 200
    assert first.data["results"] == second.data["results"]
    assert first.data["results"][0]["status"] == "accepted"
    assert CommunityActivity.objects.count() == 2
    assert CommunityActivityEvent.objects.count() == CommunityCommandReceipt.objects.count() == 2
    assert FieldEvent.objects.get(pk=capture["id"]).status == "accepted"
    changed = {**capture, "manual_capture": True}
    assert context.phone.sync([changed]).data["results"][0]["code"] == "event_id_conflict"
    original_codes = context.profile.permission_codes
    context.profile.permission_codes = [
        code for code in original_codes if code != "community_activity.create"
    ]
    context.profile.save(update_fields=["permission_codes"])
    assert context.phone.sync([capture]).data["results"][0]["code"] == "community_inaccessible"
    context.profile.permission_codes = original_codes
    context.profile.save(update_fields=["permission_codes"])
    from catalogs.services import (
        CatalogItemSpec,
        create_catalog_item,
        deactivate_catalog_item,
        update_catalog_item,
    )

    configured = create_catalog_item(
        context.type.catalog,
        CatalogItemSpec("configured-outreach", "Original outreach", "Original outreach"),
        context.actor.user,
    )
    captured = create_activity(
        ActivityCommand(
            context.actor,
            uuid4(),
            {**context.values, "type_id": configured.pk, "other_text": ""},
        )
    )
    update_catalog_item(configured, {"label_es": "Updated wording"})
    deactivate_catalog_item(configured)
    assert CommunityActivity.objects.get(pk=captured["activity_id"]).type_snapshot["label_es"] == (
        "Original outreach"
    )


@pytest.mark.django_db
def test_public_read_totals_link_redaction_and_void_preserve_independent_incident(
    org_a, org_b, make_member, monkeypatch
):
    from django.middleware.csrf import get_token
    from django.test import RequestFactory
    from rest_framework.test import APIClient

    from community.models import CommunityActivity, ComplaintIncidentLink
    from community.services import ActivityCommand, create_activity
    from incidents.configuration import write_type
    from incidents.services import report
    from organizations.models import all_scope

    context = community_context(org_a, make_member, monkeypatch)
    _terminal_user, terminal = make_member(
        org_a, ("incident.read", "incident.close", "organization.update", "role.update")
    )
    terminal.scope = all_scope()
    terminal.save(update_fields=["scope"])
    terminal_profile = terminal.profiles.get()
    terminal_profile.scope = all_scope()
    terminal_profile.save(update_fields=["scope"])
    type_version = write_type(
        context.actor,
        {
            "code": "community-case",
            "label": "Community case",
            "severity": "low",
            "terminal_id": terminal.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
            "blocker_kinds": [],
        },
    )
    incident = report(
        context.actor,
        {
            "type_id": type_version.pk,
            "description": "Nonidentifying complaint",
            "evidence_ids": [],
            "scope": {
                "center_id": context.block.quadrant.center_id,
                "quadrant_id": context.block.quadrant_id,
            },
        },
    )
    foreign = community_context(org_b, make_member, monkeypatch)
    foreign_type = write_type(
        foreign.actor,
        {
            "code": "foreign-community-case",
            "label": "Foreign community case",
            "severity": "low",
            "terminal_id": foreign.member.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
            "blocker_kinds": [],
        },
    )
    foreign_incident = report(
        foreign.actor,
        {
            "type_id": foreign_type.pk,
            "description": "Foreign nonidentifying complaint",
            "evidence_ids": [],
            "scope": {
                "center_id": foreign.block.quadrant.center_id,
                "quadrant_id": foreign.block.quadrant_id,
            },
        },
    )
    from geography.models import Quadrant

    other_quadrant = Quadrant.objects.create(
        organization=org_a,
        created_by=context.actor.user,
        center_id=context.block.quadrant.center_id,
        code="Q-OTHER-127",
    )
    other_pair_incident = report(
        context.actor,
        {
            "type_id": type_version.pk,
            "description": "Same organization, different real pair",
            "evidence_ids": [],
            "scope": {
                "center_id": other_quadrant.center_id,
                "quadrant_id": other_quadrant.pk,
            },
        },
    )
    values = {**context.values, "incident_id": incident.pk}
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(context.actor.user)
    request = RequestFactory().get("/")
    token = get_token(request)
    client.cookies["csrftoken"] = request.META["CSRF_COOKIE"]
    body = {**values, "command_id": uuid4()}
    assert client.post("/api/v1/community-activities/", body, format="json").status_code == 403
    created = client.post(
        "/api/v1/community-activities/", body, format="json", HTTP_X_CSRFTOKEN=token
    )
    assert created.status_code == 201, created.data
    identifier = created.data["activity_id"]
    create_activity(ActivityCommand(context.actor, uuid4(), {**context.values, "attendance": 3}))
    page = client.get("/api/v1/community-activities/?page_size=1")
    assert page.status_code == 200
    assert page.data["count"] == 2
    assert len(page.data["results"]) == 1
    assert page.data["totals"] == {"active_activity_count": 2, "attendance": "10"}
    exact = client.get(f"/api/v1/community-activities/?code={created.data['code']}&page_size=1")
    assert exact.data["count"] == 1
    assert exact.data["totals"] == {"active_activity_count": 1, "attendance": "7"}
    options = client.get("/api/v1/community-activities/zone-options/?action=create")
    assert options.status_code == 200
    assert [row["id"] for row in options.data["results"]] == [str(context.block.pk)]
    assert "center.read" not in context.profile.permission_codes
    before = CommunityActivity.objects.count()
    for inaccessible in (uuid4(), foreign_incident.pk, other_pair_incident.pk):
        denied = client.post(
            "/api/v1/community-activities/",
            {**body, "command_id": uuid4(), "incident_id": inaccessible},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        assert denied.status_code == 404
    assert CommunityActivity.objects.count() == before
    context.profile.permission_codes.remove("incident.read")
    context.profile.save(update_fields=["permission_codes"])
    detail = client.get(f"/api/v1/community-activities/{identifier}/")
    assert detail.status_code == 200
    assert detail.data["incident"] is None
    assert ComplaintIncidentLink.objects.get(activity_id=identifier).incident_id == incident.pk
    correction = {
        "command_id": uuid4(),
        "expected_revision": 1,
        "reason_code": "other",
        "reason": "Correct the aggregate without altering the complaint",
    }
    voided = client.post(
        f"/api/v1/community-activities/{identifier}/void/",
        correction,
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert voided.status_code == 200, voided.data
    assert (
        client.post(
            f"/api/v1/community-activities/{identifier}/void/",
            correction,
            format="json",
            HTTP_X_CSRFTOKEN=token,
        ).data
        == voided.data
    )
    page = client.get("/api/v1/community-activities/?include_voided=true&page_size=1")
    assert page.data["count"] == 2
    assert page.data["totals"] == {"active_activity_count": 1, "attendance": "3"}
    from incidents.selectors import current_event

    assert current_event(incident).state == "open"
    assert CommunityActivity.objects.count() == 2
    assert ComplaintIncidentLink.objects.count() == 1
    context.profile.scope = {
        "centers": {"mode": "none", "ids": []},
        "quadrants": {"mode": "all", "ids": []},
    }
    context.profile.save(update_fields=["scope"])
    assert client.get(f"/api/v1/community-activities/{identifier}/").status_code == 404
    denied_page = client.get("/api/v1/community-activities/?include_voided=true")
    assert denied_page.data["count"] == 0
    assert denied_page.data["totals"] == {"active_activity_count": 0, "attendance": "0"}


@pytest.mark.django_db
def test_pending_source_current_pair_gate_denies_hidden_foreign_or_missing_actions(
    org_a, org_b, make_member, monkeypatch
):
    from community.models import CommunityActivity
    from field_sync.models import FieldEvent
    from organizations.models import all_scope
    from tests.factories import ProfileFactory

    context = community_context(org_a, make_member, monkeypatch)
    original = list(context.profile.permission_codes)
    hidden = {
        "centers": {"mode": "selected", "ids": [str(uuid4())]},
        "quadrants": {"mode": "all", "ids": []},
    }
    for denied in ("field_event.sync", "community_activity.create"):
        context.profile.permission_codes = [code for code in original if code != denied]
        context.profile.save(update_fields=["permission_codes"])
        other = ProfileFactory(organization=org_a, permission_codes=[denied], scope=hidden)
        context.member.profiles.add(other)
        capture = community_source(context, shift_id=str(uuid4()))
        answer = context.phone.sync([capture])
        assert answer.status_code == 200, answer.data
        assert answer.data["results"][0]["code"] == "community_inaccessible"
        assert not CommunityActivity.objects.exists()
        context.member.profiles.remove(other)
    context.profile.permission_codes = original
    context.profile.scope = all_scope()
    context.profile.save(update_fields=["permission_codes", "scope"])
    foreign = community_context(org_b, make_member, monkeypatch)
    capture = community_source(context)
    capture["payload"]["zone_id"] = str(foreign.block.pk)
    assert context.phone.sync([capture]).data["results"][0]["code"] == "community_inaccessible"
    capture = community_source(context)
    capture["payload"]["zone_id"] = str(uuid4())
    assert context.phone.sync([capture]).data["results"][0]["code"] == "community_inaccessible"
    import reviews.boundaries as boundaries

    retain_sources = boundaries.lock_source_references
    retained = []

    def revoke_before_organization(ctx):
        retain_sources(ctx)
        if ctx.envelope.type == "community.activity":
            retained.append(ctx.envelope.id)
            context.profile.permission_codes = [
                code for code in original if code != "community_activity.create"
            ]
            context.profile.save(update_fields=["permission_codes"])

    with monkeypatch.context() as gate:
        gate.setattr(boundaries, "lock_source_references", revoke_before_organization)
        pending = community_source(context, shift_id=str(uuid4()))
        denied = context.phone.sync([pending])
    assert retained == [FieldEvent.objects.get(pk=pending["id"]).pk]
    assert denied.data["results"][0]["code"] == "community_inaccessible"
    assert not CommunityActivity.objects.exists()
    context.profile.permission_codes = original
    context.profile.save(update_fields=["permission_codes"])
    valid_pending = community_source(context, shift_id=str(uuid4()))
    answer = context.phone.sync([valid_pending])
    assert answer.data["results"][0]["status"] == "in_review"
    assert not CommunityActivity.objects.exists()
    assert FieldEvent.objects.get(pk=valid_pending["id"]).status == "in_review"


@pytest.mark.django_db
def test_review_acceptance_and_unapplied_source_cancel_preserve_real_effect_planes(
    org_a, make_member, monkeypatch, settings
):
    from datetime import timedelta

    from community.models import (
        CommunityActivity,
        CommunityActivityEvent,
        CommunitySourceCancellation,
        CommunitySourceLink,
    )
    from field_sync.models import CourierChange, FieldEvent
    from incidents.configuration import write_type
    from incidents.services import report
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.evaluation import inspect_review
    from reviews.exceptions import ReviewBlockedError, ReviewConflictError
    from reviews.models import ReviewEffectReceipt, ReviewItem, ReviewSourceSnapshot

    context = community_context(org_a, make_member, monkeypatch)
    settings.VOID_REASON_MIN_LENGTH = 1
    incident_type = write_type(
        context.actor,
        {
            "code": "review-community-case",
            "label": "Retained complaint",
            "severity": "low",
            "terminal_id": context.member.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
            "blocker_kinds": [],
        },
    )
    complaint = report(
        context.actor,
        {
            "type_id": incident_type.pk,
            "description": "Nonidentifying complaint retained for review",
            "evidence_ids": [],
            "scope": {
                "center_id": context.block.quadrant.center_id,
                "quadrant_id": context.block.quadrant_id,
            },
        },
    )
    context.values["incident_id"] = complaint.pk
    from organizations.models import all_scope
    from uploads.access import UploadActor

    reviewer_user, reviewer_member = make_member(
        org_a, ("review_item.read", "review_item.decide", "incident.read")
    )
    reviewer_member.scope = all_scope()
    reviewer_member.save(update_fields=["scope"])
    reviewer_profile = reviewer_member.profiles.get()
    reviewer_profile.scope = all_scope()
    reviewer_profile.save(update_fields=["scope"])
    reviewer_actor = UploadActor(reviewer_user, org_a)
    source = community_source(context)
    response = context.phone.sync(
        [source], sent_at=(context.clock["now"] - timedelta(hours=1)).isoformat()
    )
    assert response.data["results"][0]["status"] == "in_review"
    assert not CommunityActivity.objects.exists()
    assert not CourierChange.objects.filter(resource_type="history.community_activity").exists()
    item = ReviewItem.objects.get(field_event_id=source["id"])
    context.clock["now"] += timedelta(days=1)
    assert inspect_review(FieldEvent.objects.get(pk=source["id"])).can_accept
    reviewer_profile.permission_codes.remove("incident.read")
    reviewer_profile.save(update_fields=["permission_codes"])
    with pytest.raises(ReviewBlockedError) as inaccessible:
        decide_review(
            reviewer_actor,
            item.pk,
            ReviewDecisionRequest(
                "accept", 0, "Current case read must precede any accepted effect"
            ),
        )
    assert inaccessible.value.blocked_by[0]["reason"] == "community_inaccessible"
    assert not CommunityActivity.objects.exists()
    assert not item.decisions.exists()
    assert not ReviewEffectReceipt.objects.filter(source_event_id=source["id"]).exists()
    reviewer_profile.permission_codes.append("incident.read")
    reviewer_profile.save(update_fields=["permission_codes"])
    decision = decide_review(
        reviewer_actor,
        item.pk,
        ReviewDecisionRequest(
            "accept", 0, "Verified the retained aggregate capture and original authority"
        ),
    )
    assert ReviewEffectReceipt.objects.get(source_event_id=source["id"]).decision_id == decision.pk
    record = CommunityActivity.objects.get(pk=source["id"])
    assert (
        record.activity_date.isoformat() == "2026-06-04"
    )  # UTC midnight was local prior day in Mexico City.
    assert FieldEvent.objects.get(pk=source["id"]).status == "in_review"
    assert CommunityActivityEvent.objects.count() == CommunitySourceLink.objects.count() == 1
    assert CourierChange.objects.filter(resource_type="history.community_activity").count() == 1
    with pytest.raises(ReviewConflictError):
        decide_review(
            reviewer_actor,
            item.pk,
            ReviewDecisionRequest(
                "accept", 0, "Same original acceptance cannot be automatically replayed"
            ),
        )
    from tests.sync_support import second_device_of

    context.phone = second_device_of(
        context.phone
    )  # A genuine fresh session after the next-day decision.
    from tests.sync_support import event

    too_short = event(
        type="record.void",
        voids_event_id=source["id"],
        payload={"reason_code": "other", "reason": "short"},
    )
    refusal = context.phone.sync([too_short]).data["results"][0]
    assert refusal["status"] == "rejected"
    assert refusal["code"] == "invalid_payload"
    assert FieldEvent.objects.get(pk=source["id"]).voided_at is None
    assert CommunityActivityEvent.objects.count() == 1
    applied_correction = event(
        type="record.void",
        voids_event_id=source["id"],
        payload={
            "reason_code": "other",
            "reason": "Correct the accepted materialization without rewriting its ingest verdict",
        },
        device_time=context.clock["now"].isoformat(),
    )
    assert context.phone.sync([applied_correction]).data["results"][0]["status"] == "accepted"
    assert CommunityActivityEvent.objects.get(activity=record, revision=2).action == "void"
    assert CommunitySourceLink.objects.count() == 2
    original = FieldEvent.objects.get(pk=source["id"])
    assert original.status == "in_review"
    assert original.voided_at is not None
    pending = community_source(context)
    assert (
        context.phone.sync(
            [pending], sent_at=(context.clock["now"] - timedelta(hours=1)).isoformat()
        ).data["results"][0]["status"]
        == "in_review"
    )
    for insufficient in ("", "short", 12345):
        refused = event(
            type="record.void",
            voids_event_id=pending["id"],
            payload={"reason_code": "other", "reason": insufficient},
        )
        refusal = context.phone.sync([refused]).data["results"][0]
        assert refusal["status"] == "rejected"
        assert refusal["code"] == "invalid_payload"
        assert FieldEvent.objects.get(pk=pending["id"]).voided_at is None
        assert not CommunitySourceCancellation.objects.filter(
            target_event_id=pending["id"]
        ).exists()
    correction = event(
        type="record.void",
        voids_event_id=pending["id"],
        payload={
            "reason_code": "other",
            "reason": "Cancel the unmaterialized aggregate without inventing attendance",
        },
        device_time=context.clock["now"].isoformat(),
    )
    assert context.phone.sync([correction]).data["results"][0]["status"] == "accepted"
    assert (
        CommunitySourceCancellation.objects.get(source_event_id=correction["id"]).target_event_id
        == FieldEvent.objects.get(pk=pending["id"]).pk
    )
    assert not CommunityActivity.objects.filter(pk=pending["id"]).exists()
    assert CommunityActivity.objects.count() == 1

    missing_catalog = community_source(context)
    missing_catalog["catalog_version"] = "f" * 64
    missing_result = context.phone.sync([missing_catalog]).data["results"][0]
    assert missing_result["status"] == "in_review"
    assert missing_result["code"] == "community_catalog_unavailable"
    unavailable_source = FieldEvent.objects.get(pk=missing_catalog["id"])
    assert (
        ReviewSourceSnapshot.objects.get(source_event=unavailable_source).facts["owner"][
            "community"
        ]["available"]
        is False
    )
    assert not inspect_review(unavailable_source).can_accept
    cancel_missing = event(
        type="record.void",
        voids_event_id=missing_catalog["id"],
        payload={
            "reason_code": "other",
            "reason": "Cancel without fabricating missing capture facts",
        },
    )
    assert context.phone.sync([cancel_missing]).data["results"][0]["status"] == "accepted"
    assert CommunitySourceCancellation.objects.filter(
        source_event_id=cancel_missing["id"], target_event=unavailable_source
    ).exists()
    assert not CommunityActivity.objects.filter(pk=unavailable_source.pk).exists()

    unproved = community_source(context)
    unproved["device_time"] = (context.clock["now"] - timedelta(days=1, minutes=2)).isoformat()
    assert (
        context.phone.sync(
            [unproved], sent_at=(context.clock["now"] - timedelta(hours=1)).isoformat()
        ).data["results"][0]["status"]
        == "in_review"
    )
    unavailable = inspect_review(FieldEvent.objects.get(pk=unproved["id"]))
    assert "authority_history_unavailable" in unavailable.blockers
    assert not unavailable.can_accept
    assert not CommunityActivity.objects.filter(pk=unproved["id"]).exists()


@pytest.mark.django_db
def test_source_history_current_read_and_latest_void_are_shared_by_bootstrap_and_changes(
    org_a, make_member, monkeypatch
):
    from community.models import CommunityActivity
    from community.services import ActivityCommand, void_activity
    from field_sync.models import CourierChange
    from field_sync.producers import ProducerContext
    from reviews.history import build_history
    from reviews.history_scope import visible_history_contexts
    from uploads.access import current_scope

    context = community_context(org_a, make_member, monkeypatch)
    capture = community_source(context)
    assert context.phone.sync([capture]).data["results"][0]["status"] == "accepted"
    record = CommunityActivity.objects.get(pk=capture["id"])
    first = CourierChange.objects.get(resource_type="history.community_activity")
    assert "agreements" not in first.payload
    assert "other_text" not in first.payload
    assert "incident_id" not in first.payload
    correction = ActivityCommand(
        context.actor,
        uuid4(),
        {
            "expected_revision": 1,
            "reason_code": "other",
            "reason": "Correct this aggregate while retaining its original source",
        },
    )
    void_activity(correction, record.pk)
    void_activity(correction, record.pk)
    assert CourierChange.objects.filter(resource_type="history.community_activity").count() == 2
    latest = CourierChange.objects.filter(resource_type="history.community_activity").latest(
        "sequence"
    )
    current = ProducerContext(
        org_a,
        context.actor.user,
        current_scope(context.actor),
        context.clock["now"],
        "field.bootstrap",
    )
    downloaded = [row for row in build_history(current) if row["kind"] == "community_activity"]
    assert len(downloaded) == 1
    assert downloaded[0]["is_voided"] is True
    assert all(downloaded[0][key] == value for key, value in latest.payload.items())
    context.profile.permission_codes.remove("community_activity.read")
    context.profile.save(update_fields=["permission_codes"])
    denied = ProducerContext(
        org_a,
        context.actor.user,
        current_scope(context.actor),
        context.clock["now"],
        "field.bootstrap",
    )
    assert latest.pk not in visible_history_contexts(denied)
    context.profile.permission_codes.append("community_activity.read")
    context.profile.save(update_fields=["permission_codes"])
    restored = ProducerContext(
        org_a,
        context.actor.user,
        current_scope(context.actor),
        context.clock["now"],
        "field.bootstrap",
    )
    assert [row for row in build_history(restored) if row["kind"] == "community_activity"][0][
        "is_voided"
    ] is True


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", [0, 1], ids=["original-first", "contender-first"])
def test_command_race_keeps_one_complete_effect_after_one_postcommit_retry(
    org_a, make_member, monkeypatch, first
):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    from contextlib import contextmanager

    from django.db import connection

    import community.services as services
    from community.exceptions import CommunityConflictError
    from community.models import CommunityActivity, CommunityActivityEvent, CommunityCommandReceipt
    from field_sync.exceptions import SyncInProgressError
    from organizations.models import all_scope
    from uploads.access import UploadActor

    context = community_context(org_a, make_member, monkeypatch)
    user, member = make_member(org_a, context.codes)
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    identifier = uuid4()
    actors = [context.actor, UploadActor(user, org_a)]
    entered, release = threading.Event(), threading.Event()
    original = services.community_transaction

    @contextmanager
    def held(actor, activity=None):
        with original(actor, activity) as organization:
            if actor.user.pk == actors[first].user.pk:
                entered.set()
                assert release.wait(10)
            yield organization

    monkeypatch.setattr(services, "community_transaction", held)

    def winner():
        try:
            return services.create_activity(
                services.ActivityCommand(actors[first], identifier, context.values)
            )
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as executor:
        result = executor.submit(winner)
        try:
            assert entered.wait(10)
            with pytest.raises(SyncInProgressError):
                services.create_activity(
                    services.ActivityCommand(actors[1 - first], identifier, context.values)
                )
        finally:
            release.set()
        receipt = result.result(timeout=10)
    with pytest.raises(CommunityConflictError):
        services.create_activity(
            services.ActivityCommand(actors[1 - first], identifier, context.values)
        )
    assert CommunityActivity.objects.get(pk=identifier).created_by_id == actors[first].user.pk
    assert CommunityActivityEvent.objects.count() == CommunityCommandReceipt.objects.count() == 1
    assert str(identifier) == receipt["activity_id"]
