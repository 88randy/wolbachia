"""B-06 behavior, compatibility and publication; one proof per invariant (§9)."""

import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from django.db import close_old_connections, connection, transaction
from django.http import Http404
from rest_framework.test import APIClient

from catalogs.models import CatalogItem
from core.exceptions import FieldValidationError
from field_sync.envelope import describe_payload
from field_sync.models import FieldEvent
from fleet.models import InspectionClearance
from geography.models import Quadrant
from incidents.configuration import write_type
from incidents.exceptions import (
    IncidentConfigurationUnavailableError,
    IncidentConflictError,
    IncidentInProgressError,
)
from incidents.models import (
    Incident,
    IncidentEvent,
    IncidentNoticeIntent,
    IncidentOrigin,
    IncidentTypeVersion,
    NoticePublicationReceipt,
)
from incidents.notices import publish, recover_publication_page, recover_publications
from incidents.permissions import MANAGEMENT_CODES
from incidents.policy import next_stage, reminder_due
from incidents.selectors import active_blockers, current_event
from incidents.services import Decision, decide, escalate, report
from organizations.models import Center, all_scope
from organizations.services import (
    MembershipChange,
    ProfileChange,
    assign_profiles,
    update_membership,
    update_profile_permissions,
)
from tests.factories import MembershipFactory, MotorcycleFactory, ShiftFactory
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from tests.test_fleet_b_05 import make_fault
from tests.test_uploads_b_04 import image_bytes
from tests.uploads_support import verified_upload
from uploads.access import UploadActor
from uploads.models import AttachmentLink
from uploads.services import (
    LEASE_HEADER,
    UploadBody,
    UploadRequest,
    authorize_upload,
    download_attachment,
    finalize_upload,
    receive_upload,
)
from uploads.targets import AttachmentTarget

AT = datetime(2026, 11, 6, 23, 59, tzinfo=UTC)


@pytest.mark.parametrize(
    ("elapsed", "due"),
    [
        (timedelta(minutes=1), False),
        (timedelta(seconds=3599), False),
        (timedelta(hours=1), True),
        (timedelta(hours=4), True),
        (timedelta(seconds=-1), False),
    ],
)
def test_terminal_reminder_requires_a_rolling_hour_even_across_calendar_buckets(elapsed, due):
    assert reminder_due(AT + elapsed, AT) is due


@pytest.mark.parametrize(
    ("current", "eligible", "expected"),
    [
        (-1, (False, True, True), 1),
        (-1, (False, False, True), 2),
        (0, (True, False, True), 2),
        (2, (True, True, True), 2),
    ],
)
def test_owner_chain_skips_missing_intermediates_and_never_loops(current, eligible, expected):
    assert next_stage(current, eligible) == expected


def test_a_chain_without_an_eligible_terminal_is_unusable():
    with pytest.raises(IncidentConfigurationUnavailableError):
        next_stage(-1, (True, True, False))


def configured(field):
    field.profile.permission_codes += [
        *MANAGEMENT_CODES,
        "organization.update",
        "role.update",
        "review_item.read",
        "motorcycle.read",
    ]
    field.profile.slug = "supervisor"
    field.profile.save(update_fields=["permission_codes", "slug"])
    actor = UploadActor(field.batch.user, field.batch.organization)
    version = write_type(
        actor,
        {
            "code": "site-problem",
            "label": "Site problem",
            "severity": "high",
            "terminal_id": field.membership.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
            "blocker_kinds": ["dispatch"],
        },
    )
    return SimpleNamespace(
        field=field,
        actor=actor,
        version=version,
        data={
            "type_id": version.pk,
            "description": "Synthetic reported problem",
            "evidence_ids": [],
            "scope": {"center_id": field.point.center_id, "quadrant_id": field.point.quadrant_id},
        },
    )


@pytest.fixture
def case(monkeypatch, settings, tmp_path):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    monkeypatch.setattr("incidents.services.server_now", lambda: CAPTURED)
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    return configured(setup_field())


def source(case, event_type="incident.report", **changes):
    payload = {**case.data, **changes}
    payload["type_id"] = str(payload["type_id"])
    payload["scope"] = {name: str(value) for name, value in payload["scope"].items()}
    if event_type == "emergency.accident":
        payload.pop("type_id")
    sent = envelope(case.field, event_type)
    return replace(sent, payload=payload, payload_info=describe_payload(payload))


@pytest.mark.django_db
def test_type_is_pinned_other_is_protected_and_terminal_revocation_rolls_back(case):
    incident = report(case.actor, case.data)
    revised = write_type(
        case.actor, {"expected_revision": 1, "supervisor_sla_seconds": 600}, case.version.item_id
    )
    assert revised.pk != incident.type_version_id
    assert incident.type_version.supervisor_sla_seconds == 60
    with pytest.raises(FieldValidationError) as duplicate:
        write_type(
            case.actor,
            {"expected_revision": 2, "blocker_kinds": ["dispatch", "dispatch"]},
            case.version.item_id,
        )
    assert duplicate.value.fields == {
        "blocker_kinds": [{"code": "duplicate_blocker_kind", "params": {}}]
    }
    assert IncidentTypeVersion.objects.filter(item=case.version.item).count() == 2
    unscoped = MembershipFactory(organization=case.actor.organization)
    unscoped.profiles.add(case.field.profile)
    with pytest.raises(IncidentConfigurationUnavailableError):
        write_type(
            case.actor, {"expected_revision": 2, "terminal_id": unscoped.pk}, case.version.item_id
        )
    other = CatalogItem.objects.get(
        organization=case.actor.organization, catalog__slug="incident-type", is_other=True
    )
    config = {
        "severity": "low",
        "terminal_id": case.field.membership.pk,
        "supervisor_sla_seconds": 30,
        "coordinator_sla_seconds": 60,
    }
    other_version = write_type(case.actor, config, other.pk)
    with pytest.raises(IncidentConflictError, match="cannot make"):
        write_type(case.actor, {"expected_revision": 1, "is_active": False}, other.pk)
    with pytest.raises(IncidentConflictError):
        report(case.actor, {**case.data, "type_id": other_version.pk, "description": "   "})
    with pytest.raises(IncidentConflictError):
        update_profile_permissions(
            case.field.profile,
            ProfileChange(
                case.actor.user,
                case.field.profile.revision,
                [code for code in case.field.profile.permission_codes if code != "incident.close"],
                all_scope(),
            ),
        )
    case.field.profile.refresh_from_db()
    assert "incident.close" in case.field.profile.permission_codes
    assert incident.events.count() == 1


@pytest.mark.django_db(transaction=True)
def test_actual_private_finalize_unblocks_only_linked_incident_and_keeps_foreign_holds(case):
    motorcycle = MotorcycleFactory(
        organization=case.actor.organization, center_id=case.field.point.center_id
    )
    fault = make_fault(motorcycle, case.actor.user)
    data = {
        **case.data,
        "resource_ref": {"kind": "motorcycle", "id": motorcycle.pk},
        "scope": {"center_id": motorcycle.center_id},
    }
    first, second = report(case.actor, data), report(case.actor, data)
    content = image_bytes(metadata=True)
    authorization = authorize_upload(
        case.actor,
        UploadRequest(
            "image/png",
            len(content),
            hashlib.sha256(content).hexdigest(),
            context=AttachmentTarget("incident", first.pk),
        ),
    )
    identifier = UUID(authorization["upload_id"])
    with pytest.raises(IncidentConflictError):
        decide(
            case.actor,
            first.pk,
            Decision("close", 1, "Resolved with verified evidence", (identifier,)),
        )
    receive_upload(
        case.actor, UploadBody(identifier, authorization["headers"][LEASE_HEADER], BytesIO(content))
    )
    finalize_upload(case.actor, identifier)
    closed = decide(
        case.actor, first.pk, Decision("close", 1, "Resolved with verified evidence", (identifier,))
    )
    assert closed.state == "closed"
    assert set(closed.resolved_blocker_ids) == {
        str(pk) for pk in first.blockers.values_list("pk", flat=True)
    }
    assert list(active_blockers(case.actor.organization).values_list("incident_id", flat=True)) == [
        second.pk
    ]
    assert not InspectionClearance.objects.filter(fault=fault).exists()
    with pytest.raises(IncidentConflictError):
        decide(
            case.actor,
            second.pk,
            Decision("close", 1, "Attempted evidence from another case", (identifier,)),
        )
    downloaded, kind = download_attachment(case.actor, identifier)
    assert downloaded
    assert kind == "image/png"
    profile = case.field.profile
    profile.permission_codes.remove("incident.read")
    profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        download_attachment(case.actor, identifier)


@pytest.mark.django_db
@pytest.mark.parametrize("finalized_first", [False, True])
def test_both_source_arrival_orders_link_same_uuid_without_accepting_review(case, finalized_first):
    version = write_type(
        case.actor, {"expected_revision": 1, "report_evidence_min": 1}, case.version.item_id
    )
    case.data["type_id"] = version.pk
    identifier = uuid4()
    if finalized_first:
        verified_upload(
            case.actor.organization,
            case.actor.user,
            device=case.field.batch.device,
            public_id=identifier,
        )
    sent = source(case, evidence_ids=[str(identifier)])
    shift = ShiftFactory(
        organization=case.actor.organization,
        courier=case.actor.user,
        device=case.field.batch.device,
        motorcycle__center_id=case.field.point.center_id,
        opened_at_device=CAPTURED,
    )
    payload = {key: value for key, value in sent.payload.items() if key != "scope"}
    sent = replace(sent, shift_id=shift.pk, payload=payload, payload_info=describe_payload(payload))
    result = ingest(case.field, sent)
    assert result.status == ("accepted" if finalized_first else "in_review")
    stored = FieldEvent.objects.get(pk=sent.id)
    if not finalized_first:
        upload = verified_upload(
            case.actor.organization,
            case.actor.user,
            device=case.field.batch.device,
            public_id=identifier,
        )
        # Later metadata authorization uses the existing declared event, not a rewritten source.
        finalize_upload(
            UploadActor(case.actor.user, case.actor.organization, case.field.batch.device.pk),
            upload.public_id,
            AttachmentTarget("field_event", stored.pk),
        )
    link = AttachmentLink.objects.get(upload__public_id=identifier)
    assert link.field_event_id == sent.id
    assert stored.status == result.status
    assert stored.device_time == CAPTURED
    assert stored.server_received_at == CAPTURED
    assert stored.shift_id == shift.pk
    foreign_shift = ShiftFactory(
        organization=case.actor.organization,
        device=case.field.batch.device,
        motorcycle__center_id=case.field.point.center_id,
        opened_at_device=CAPTURED,
    )
    for shift_id in (foreign_shift.pk, uuid4()):
        assert (
            ingest(case.field, replace(sent, id=uuid4(), shift_id=shift_id)).code
            == "shift_not_open"
        )
    assert Incident.objects.count() == int(finalized_first)


@pytest.mark.django_db(transaction=True)
def test_review_emergency_publishes_only_scoped_audit_and_unknown_scope_stays_pending(
    case, monkeypatch
):
    from tests.factories import ProfileFactory

    monkeypatch.setattr("django.utils.timezone.now", lambda: CAPTURED)
    hidden = MembershipFactory(organization=case.actor.organization)
    hidden.profiles.add(case.field.profile)
    foreign = MembershipFactory(scope=all_scope())
    foreign.profiles.add(
        ProfileFactory(
            organization=foreign.organization,
            slug="supervisor",
            scope=all_scope(),
            permission_codes=["incident.read", "review_item.read"],
        )
    )
    sent = source(case, "emergency.accident")
    assert ingest(case.field, sent).status == "in_review"
    assert Incident.objects.count() == IncidentEvent.objects.count() == 0
    assert publish("critical_source", sent.id)
    assert publish("critical_source", sent.id)
    notice = IncidentNoticeIntent.objects.get()
    assert notice.recipient_id == case.actor.user.pk
    assert notice.kind == "incident.critical_review"
    assert notice.params == {
        "review_item_id": str(FieldEvent.objects.get(pk=sent.id).review_item.pk),
        "event_id": str(sent.id),
    }
    unknown = source(case, "emergency.accident")
    payload = {"description": "Synthetic no scope", "evidence_ids": []}
    unknown = replace(
        unknown, id=UUID(int=1), payload=payload, payload_info=describe_payload(payload)
    )
    assert ingest(case.field, unknown).code == "incident_scope_unavailable"
    assert not publish("critical_source", unknown.id)
    assert NoticePublicationReceipt.objects.count() == 1
    other_case = configured(setup_field())
    later = replace(source(other_case, "emergency.accident"), id=UUID(int=2))
    assert ingest(other_case.field, later).status == "in_review"
    continuation = []

    def enqueue_continuation(*args):
        assert not connection.in_atomic_block
        continuation.append(args)

    monkeypatch.setattr("incidents.tasks.recover_incident_notices.delay", enqueue_continuation)
    assert recover_publication_page("critical_source", None, 1) == 0
    kind, at, identifier = continuation.pop()
    assert recover_publication_page(kind, (datetime.fromisoformat(at), UUID(identifier)), 1) == 1
    assert NoticePublicationReceipt.objects.count() == 2
    busy = replace(source(case, "emergency.accident"), id=UUID(int=4))
    assert ingest(case.field, busy).status == "in_review"
    for identifier in (5, 6):
        assert (
            ingest(
                other_case.field,
                replace(source(other_case, "emergency.accident"), id=UUID(int=identifier)),
            ).status
            == "in_review"
        )
    reached, release = threading.Event(), threading.Event()

    def hold_organization():
        from organizations.models import Organization

        close_old_connections()
        try:
            with transaction.atomic():
                Organization.objects.select_for_update(no_key=True).get(
                    pk=case.actor.organization.pk
                )
                reached.set()
                assert release.wait(timeout=10)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(hold_organization)
        try:
            assert reached.wait(timeout=10)
            assert recover_publication_page("critical_source", (CAPTURED, UUID(int=2)), 2) == 1
            assert not NoticePublicationReceipt.objects.filter(cause_id=busy.id).exists()
            assert NoticePublicationReceipt.objects.filter(cause_id=UUID(int=5)).exists()
            kind, at, identifier = continuation.pop()
            assert identifier == str(UUID(int=5))
        finally:
            release.set()
        pending.result(timeout=10)
    assert recover_publication_page(kind, (datetime.fromisoformat(at), UUID(identifier)), 2) == 1
    assert NoticePublicationReceipt.objects.filter(cause_id=UUID(int=6)).exists()
    assert publish("critical_source", busy.id)


@pytest.mark.django_db
def test_clock_fallback_terminal_rolling_reminder_and_publication_recovery_are_idempotent(case):
    supervisor = MembershipFactory(organization=case.actor.organization, scope=all_scope())
    supervisor.profiles.add(case.field.profile)
    version = write_type(
        case.actor, {"expected_revision": 1, "supervisor_id": supervisor.pk}, case.version.item_id
    )
    incident = report(case.actor, {**case.data, "type_id": version.pk})
    assert current_event(incident).stage == 0
    assert escalate(incident, CAPTURED + timedelta(seconds=59)) is None
    update_membership(
        supervisor,
        MembershipChange(
            case.actor.user, supervisor.revision, [case.field.profile], all_scope(), is_active=False
        ),
    )
    case.field.profile.slug = "incident-owners"
    case.field.profile.save(update_fields=["slug"])
    initial = incident.events.get(revision=1)
    assert publish("incident_event", initial.pk)
    assert IncidentNoticeIntent.objects.get().recipient_id == case.actor.user.pk
    final = escalate(incident, CAPTURED + timedelta(seconds=59))
    assert final.stage == 2
    assert final.owner_id == case.field.membership.pk
    assert escalate(incident, CAPTURED + timedelta(seconds=60)) is None
    assert escalate(incident, CAPTURED + timedelta(hours=1)) is None
    reminder = escalate(incident, CAPTURED + timedelta(hours=5))
    assert reminder.action == "reminder"
    assert reminder.owner_id == final.owner_id
    assert escalate(incident, CAPTURED + timedelta(hours=5)) is None
    assert incident.escalations.count() == 2
    successor = MembershipFactory(organization=case.actor.organization, scope=all_scope())
    successor.profiles.add(case.field.profile)
    reassigned = decide(
        case.actor, incident.pk, Decision("reassign", reminder.revision, owner_id=successor.pk)
    )
    successor_actor = UploadActor(successor.user, case.actor.organization)
    write_type(
        successor_actor, {"expected_revision": 2, "terminal_id": successor.pk}, case.version.item_id
    )
    update_membership(
        case.field.membership,
        MembershipChange(
            successor.user,
            case.field.membership.revision,
            [case.field.profile],
            all_scope(),
            is_active=False,
        ),
    )
    assert recover_publications() == 3
    assert recover_publications() == 0
    assert NoticePublicationReceipt.objects.count() == 4
    assert IncidentNoticeIntent.objects.count() == 4
    assert set(
        IncidentNoticeIntent.objects.filter(
            publication__cause_id__in=[final.pk, reminder.pk, reassigned.pk]
        ).values_list("recipient_id", flat=True)
    ) == {successor.user_id}


@pytest.mark.django_db
def test_unique_facade_preserves_fleet_default_and_rich_scoped_contract(case, make_member):
    first = report(case.actor, case.data)
    center_only = report(
        case.actor, {**case.data, "scope": {"center_id": case.field.point.center_id}}
    )
    other_center = Center.objects.create(
        organization=case.actor.organization, code="C-OTHER", name="Other"
    )
    other_quadrant = Quadrant.objects.create(
        organization=case.actor.organization, center_id=case.field.point.center_id, code="Q-OTHER"
    )
    hidden_center = report(case.actor, {**case.data, "scope": {"center_id": other_center.pk}})
    hidden_quadrant = report(
        case.actor,
        {
            **case.data,
            "scope": {"center_id": case.field.point.center_id, "quadrant_id": other_quadrant.pk},
        },
    )
    foreign_case = configured(setup_field())
    foreign = report(foreign_case.actor, foreign_case.data)
    user, member = make_member(case.actor.organization)
    client = APIClient()
    client.force_authenticate(user)
    url = "/api/v1/incidents/"
    assert client.get(url, {"kind": "reported"}).status_code == 403
    assert client.options(url).status_code == 403
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.permission_codes = ["incident.read", "motorcycle.read"]
    profile.scope = {
        "centers": {"mode": "selected", "ids": [str(case.field.point.center_id)]},
        "quadrants": {"mode": "selected", "ids": [str(case.field.point.quadrant_id)]},
    }
    profile.save(update_fields=["permission_codes", "scope"])
    rich = client.get(url, {"kind": "reported"})
    assert rich.status_code == 200
    assert [row["id"] for row in rich.data["results"]] == [str(center_only.pk), str(first.pk)]
    foreign_motorcycle = MotorcycleFactory(organization=foreign_case.actor.organization)
    for reference in ("", "not-a-uuid", str(foreign_motorcycle.pk)):
        ignored = client.get(url, {"kind": "reported", "motorcycle": reference})
        assert ignored.status_code == 200
        assert ignored.data == rich.data
    assert client.get(url, {"kind": "reported", "code": first.code}).data["count"] == 1
    assert client.get(url, {"kind": "reported", "code": "\x00"}).status_code == 400
    for incident in (hidden_center, hidden_quadrant, foreign):
        assert client.get(f"{url}{incident.pk}/").status_code == 404
    # A second unrelated grant cannot lend its quadrant to the first action grant.
    profile.scope["quadrants"] = {"mode": "none", "ids": []}
    profile.save(update_fields=["scope"])
    from tests.factories import ProfileFactory

    member.profiles.add(
        ProfileFactory(
            organization=case.actor.organization,
            scope=all_scope(),
            permission_codes=["catalog.read"],
        )
    )
    assert [row["id"] for row in client.get(url, {"kind": "reported"}).data["results"]] == [
        str(center_only.pk)
    ]
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    motorcycle = MotorcycleFactory(
        organization=case.actor.organization, center_id=case.field.point.center_id
    )
    fault = make_fault(motorcycle, case.actor.user)
    legacy = client.get(url)
    assert legacy.status_code == 200
    assert legacy.data == client.get(url, {"kind": "fleet"}).data
    assert [row["id"] for row in legacy.data["results"]] == [str(fault.pk)]
    assert "timeline" not in legacy.data["results"][0]
    second_motorcycle = MotorcycleFactory(
        organization=case.actor.organization, center_id=case.field.point.center_id
    )
    make_fault(second_motorcycle, case.actor.user)
    fleet = client.get(url, {"kind": "fleet", "motorcycle": str(motorcycle.pk), "page_size": 1})
    assert fleet.status_code == 200
    assert fleet.data["count"] == 1
    assert [row["id"] for row in fleet.data["results"]] == [str(fault.pk)]
    client.force_authenticate(case.actor.user)
    invalid = client.patch(
        f"/api/v1/incident-types/{case.version.item_id}/",
        {"expected_revision": 1, "blocker_kinds": ["dispatch", "dispatch"]},
        format="json",
    )
    assert invalid.status_code == 400
    assert invalid.data["code"] == "validation_error"
    assert invalid.data["fields"] == {
        "blocker_kinds": [{"code": "duplicate_blocker_kind", "params": {}}]
    }


@pytest.mark.django_db(transaction=True)
def test_close_reassign_contender_rolls_back_then_stale_revision_preserves_winner(
    case, monkeypatch
):
    from incidents import services

    incident = report(case.actor, case.data)
    upload = verified_upload(case.actor.organization, case.actor.user)
    other = MembershipFactory(organization=case.actor.organization, scope=all_scope())
    other.profiles.add(case.field.profile)
    contender = UploadActor(other.user, case.actor.organization)
    reached, release = threading.Event(), threading.Event()
    original = services.append_event

    def parked(*args):
        if threading.current_thread().name.startswith("incident-winner"):
            reached.set()
            assert release.wait(timeout=10)
        return original(*args)

    monkeypatch.setattr(services, "append_event", parked)

    def winner():
        close_old_connections()
        try:
            return decide(
                case.actor,
                incident.pk,
                Decision("close", 1, "Resolved with verified evidence", (upload.public_id,)),
            ).pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="incident-winner") as pool:
        pending = pool.submit(winner)
        try:
            assert reached.wait(timeout=10)
            with pytest.raises(IncidentInProgressError):
                decide(contender, incident.pk, Decision("reassign", 1, owner_id=other.pk))
        finally:
            release.set()
        winner_id = pending.result(timeout=10)
    with pytest.raises(IncidentConflictError) as stale:
        decide(contender, incident.pk, Decision("reassign", 1, owner_id=other.pk))
    assert stale.value.blocked_by == [
        {"reason": "revision", "unblocked_by_role": "supervisor", "link": "", "current_revision": 2}
    ]
    assert current_event(incident).pk == winner_id
    assert incident.events.count() == 2


@pytest.mark.django_db
def test_void_keeps_source_and_history_and_refuses_owned_blocker_loss(case):
    sent = source(case)
    assert ingest(case.field, sent).status == "accepted"
    incident = Incident.objects.get(source_event_id=sent.id)
    void_payload = {
        "reason_code": "data-entry-error",
        "reason": "Synthetic original source correction",
    }
    void = envelope(case.field, "record.void", voids_event_id=sent.id)
    void = replace(void, payload=void_payload, payload_info=describe_payload(void_payload))
    assert ingest(case.field, void).status == "accepted"
    incident.refresh_from_db()
    assert FieldEvent.objects.get(pk=sent.id).status == "accepted"
    assert incident.source_event_id == sent.id
    assert incident.events.count() == 1
    motorcycle = MotorcycleFactory(
        organization=case.actor.organization, center_id=case.field.point.center_id
    )
    held = report(
        case.actor,
        {
            **case.data,
            "resource_ref": {"kind": "motorcycle", "id": motorcycle.pk},
            "scope": {"center_id": motorcycle.center_id},
        },
    )
    with pytest.raises(IncidentConflictError):
        decide(case.actor, held.pk, Decision("void", 1, "Synthetic preserved owned hold"))
    assert current_event(held).state == "open"


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["profile", "assignment", "membership"])
def test_terminal_configuration_changes_preserve_open_incident_paired_scope(case, path):
    from tests.factories import ProfileFactory

    incident = report(case.actor, case.data)
    other_center = Center.objects.create(
        organization=case.actor.organization, code="OTHER", name="Other"
    )
    restricted = {
        "centers": {"mode": "selected", "ids": [str(other_center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    profile, member = case.field.profile, case.field.membership
    if path == "profile":

        def change():
            return update_profile_permissions(
                profile,
                ProfileChange(
                    case.actor.user, profile.revision, profile.permission_codes, restricted
                ),
            )
    elif path == "membership":

        def change():
            return update_membership(
                member, MembershipChange(case.actor.user, member.revision, [profile], restricted)
            )
    else:
        administrator = ProfileFactory(
            organization=case.actor.organization,
            scope=all_scope(),
            permission_codes=["organization.update", "role.update"],
        )

        def change():
            return assign_profiles(member, [administrator])

    with pytest.raises(IncidentConflictError):
        change()
    member.refresh_from_db()
    profile.refresh_from_db()
    assert member.scope == profile.scope == all_scope()
    assert list(member.profiles.values_list("pk", flat=True)) == [profile.pk]
    assert current_event(incident).owner_id == member.pk


@pytest.mark.django_db(transaction=True)
def test_publication_dispatch_is_after_commit_and_rollback_keeps_no_cause(case, monkeypatch):
    dispatched = []

    def dispatch(kind, identifier):
        assert not connection.in_atomic_block
        dispatched.append((kind, identifier))
        raise ConnectionRefusedError("Synthetic unavailable incident broker")

    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", dispatch)
    with transaction.atomic():
        report(case.actor, case.data)
        transaction.set_rollback(True)
    assert not dispatched
    assert Incident.objects.count() == 0
    sent = source(case)
    result = ingest(case.field, sent)
    assert result.status == "accepted"
    assert result.code == "accepted"
    assert FieldEvent.objects.get(pk=sent.id).status == "accepted"
    incident = Incident.objects.get(source_event_id=sent.id)
    assert dispatched == [("incident_event", str(current_event(incident).pk))]
    assert not NoticePublicationReceipt.objects.exists()
    assert not IncidentNoticeIntent.objects.exists()
    assert recover_publications() == 1
    assert recover_publications() == 0
    assert NoticePublicationReceipt.objects.count() == IncidentNoticeIntent.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_escalation_and_lost_callback_retry_do_not_duplicate_receipt_or_notice(
    case, monkeypatch
):
    from incidents import services

    supervisor = MembershipFactory(organization=case.actor.organization, scope=all_scope())
    supervisor.profiles.add(case.field.profile)
    version = write_type(
        case.actor, {"expected_revision": 1, "supervisor_id": supervisor.pk}, case.version.item_id
    )
    incident = report(case.actor, {**case.data, "type_id": version.pk})
    reached, release = threading.Event(), threading.Event()
    original = services.append_event

    def parked(*args):
        if threading.current_thread().name.startswith("escalation-winner"):
            reached.set()
            assert release.wait(timeout=10)
        return original(*args)

    monkeypatch.setattr(services, "append_event", parked)
    due = CAPTURED + timedelta(seconds=60)

    def winner():
        close_old_connections()
        try:
            return escalate(incident, due).pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="escalation-winner") as pool:
        pending = pool.submit(winner)
        try:
            assert reached.wait(timeout=10)
            with pytest.raises(IncidentInProgressError):
                escalate(incident, due)
        finally:
            release.set()
        winner_id = pending.result(timeout=10)
    assert escalate(incident, due) is None
    assert incident.escalations.count() == 1
    assert current_event(incident).pk == winner_id
    assert publish("incident_event", winner_id)
    assert publish("incident_event", winner_id)
    assert NoticePublicationReceipt.objects.count() == 1
    assert IncidentNoticeIntent.objects.count() == 2


@pytest.mark.django_db
def test_explicit_marker_adoption_retains_removal_identity_and_refuses_second_case(case):
    from ovitraps.lifecycle.models import OvitrapIncidentLink
    from ovitraps.lifecycle.selectors import has_unresolved_removal
    from ovitraps.models import Ovitrap
    from tests.test_ovitraps_lifecycle_b_15 import lifecycle

    placed = envelope(case.field)
    assert ingest(case.field, placed).status == "accepted"
    trap = Ovitrap.objects.get(event_id=placed.id)
    removed = lifecycle(case.field, "remove")
    assert ingest(case.field, removed).status == "accepted"
    marker = OvitrapIncidentLink.objects.get(ovitrap=trap)
    data = {**case.data, "resource_ref": {"kind": "ovitrap_marker", "id": marker.pk}}
    incident = report(case.actor, data)
    assert incident.pk != marker.pk
    assert IncidentOrigin.objects.get(marker=marker).incident_id == incident.pk
    with pytest.raises(IncidentConflictError):
        report(case.actor, data)
    assert Incident.objects.count() == 1
    marker.refresh_from_db()
    assert marker.ovitrap_id == trap.pk
    evidence = verified_upload(case.actor.organization, case.actor.user)
    decide(
        case.actor,
        incident.pk,
        Decision(
            "close", 1, "Incident resolved without removal compensation", (evidence.public_id,)
        ),
    )
    assert has_unresolved_removal(case.actor.organization)


@pytest.mark.django_db
def test_new_type_terminal_can_retire_unused_old_owner_and_old_offline_pin_reviews(case):
    successor = MembershipFactory(organization=case.actor.organization, scope=all_scope())
    successor.profiles.add(case.field.profile)
    updated = write_type(
        case.actor, {"expected_revision": 1, "terminal_id": successor.pk}, case.version.item_id
    )
    update_membership(
        case.field.membership,
        MembershipChange(
            successor.user,
            case.field.membership.revision,
            [case.field.profile],
            all_scope(),
            is_active=False,
        ),
    )
    case.field.batch = replace(case.field.batch, user=successor.user)
    old_pin = source(case)
    assert ingest(case.field, old_pin).code == "incident_configuration_unavailable"
    assert Incident.objects.count() == 0
    case.version.refresh_from_db()
    assert case.version.terminal_id == case.field.membership.pk
    assert updated.terminal_id == successor.pk
