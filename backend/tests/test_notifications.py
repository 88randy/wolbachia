"""W5 contracts: tenant/owner isolation, stable cursors and required-channel policy."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event
from time import monotonic

import pytest
from django.db import DatabaseError, close_old_connections, connection, transaction
from rest_framework.test import APIClient

from core.exceptions import FieldValidationError
from notifications.models import Notification, NotificationRead, PreferenceVersion
from notifications.services import NotificationDraft, mark_read, publish_notification
from organizations.models import all_scope
from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory

pytestmark = pytest.mark.django_db
BASE = "/api/v1/notifications/"
PREFERENCES = "/api/v1/me/notification-preferences/"


@pytest.fixture
def inbox():
    organization = OrganizationFactory()
    user = UserFactory()
    profile = ProfileFactory(
        organization=organization,
        scope=all_scope(),
        permission_codes=["notification.read", "notification_preference.update"],
    )
    member = MembershipFactory(user=user, organization=organization, scope=all_scope())
    member.profiles.add(profile)
    client = APIClient()
    client.force_authenticate(user)
    return client, member, profile


def notice(member, **changes):
    return publish_notification(NotificationDraft(recipient=member, **changes))


def test_list_and_read_actions_are_scoped_to_current_owner_and_organization(inbox):
    client, member, _profile = inbox
    own = notice(member)
    colleague = MembershipFactory(organization=member.organization)
    foreign = MembershipFactory(user=member.user)
    hidden = [notice(colleague), notice(foreign)]
    headers = {"HTTP_X_ORGANIZATION": member.organization.slug}

    page = client.get(BASE, **headers)
    assert [row["id"] for row in page.data["results"]] == [str(own.pk)]
    assert page.data["unread_total"] == 1
    for identifier in [*(row.pk for row in hidden), uuid.uuid4()]:
        assert client.post(f"{BASE}{identifier}/read/", **headers).status_code == 404
    assert client.post(f"{BASE}{own.pk}/read/", **headers).status_code == 204
    first_read = NotificationRead.objects.get(notification=own).created_at
    assert client.post(f"{BASE}{own.pk}/read/", **headers).status_code == 204
    assert NotificationRead.objects.get(notification=own).created_at == first_read
    assert client.get(BASE, **headers).data["unread_total"] == 0
    assert NotificationRead.objects.count() == 1


def test_read_all_only_marks_current_visible_unread_rows(inbox):
    client, member, _profile = inbox
    own = [notice(member) for _index in range(2)]
    hidden = notice(MembershipFactory(organization=member.organization))
    assert client.post(f"{BASE}read-all/").status_code == 204
    assert client.post(f"{BASE}read-all/").status_code == 204
    assert set(NotificationRead.objects.values_list("notification_id", flat=True)) == {
        row.pk for row in own
    }
    assert not NotificationRead.objects.filter(notification=hidden).exists()


def test_cursor_keeps_snapshot_rank_after_read_and_excludes_new_arrivals(inbox):
    client, member, _profile = inbox
    rows = [notice(member) for _index in range(3)]
    first = client.get(BASE, {"page_size": 1})
    assert first.status_code == 200
    first_id = first.data["results"][0]["id"]
    client.post(f"{BASE}{first_id}/read/")
    client.post(f"{BASE}{rows[0].pk}/read/")
    new = notice(member)
    seen = [first_id]
    next_url = first.data["next"]
    while next_url:
        page = client.get(next_url)
        assert page.status_code == 200
        seen.extend(row["id"] for row in page.data["results"])
        next_url = page.data["next"]
    assert set(seen) == {str(row.pk) for row in rows}
    assert len(seen) == len(set(seen))
    assert str(new.pk) not in seen
    assert client.get(BASE).data["unread_total"] == 2


def test_cursor_rejects_changed_filters_scope_owner_and_tampering(inbox):
    client, member, profile = inbox
    notice(member)
    notice(member)
    next_url = client.get(BASE, {"page_size": 1}).data["next"]
    assert client.get(f"{next_url}&kind=critical").status_code == 400
    assert client.get(f"{next_url}broken").status_code == 400
    profile.scope = {
        "centers": {"mode": "selected", "ids": [str(uuid.uuid4())]},
        "quadrants": {"mode": "all", "ids": []},
    }
    profile.save(update_fields=["scope"])
    assert client.get(next_url).status_code == 400
    other = MembershipFactory(organization=member.organization, scope=all_scope())
    other.profiles.add(profile)
    client.force_authenticate(other.user)
    assert client.get(next_url).status_code == 400


def test_preferences_are_partial_durable_scoped_and_required_policy_is_atomic(inbox):
    client, member, _profile = inbox
    initial = client.get(PREFERENCES)
    critical = next(row for row in initial.data["preferences"] if row["kind"] == "critical")
    assert critical == {
        "kind": "critical",
        "in_app": True,
        "email": True,
        "required_in_app": True,
        "required_email": True,
    }
    payload = {"preferences": [{"kind": "incident", "email": True, "in_app": False}]}
    assert client.patch(PREFERENCES, payload, format="json").status_code == 200
    assert client.get(PREFERENCES).data == client.patch(PREFERENCES, payload, format="json").data
    before = PreferenceVersion.objects.count()
    blocked = {
        "preferences": [{"kind": "system", "email": True}, {"kind": "critical", "email": False}]
    }
    response = client.patch(PREFERENCES, blocked, format="json")
    assert response.status_code == 400
    assert "required_channel" in str(response.data)
    assert PreferenceVersion.objects.count() == before
    assert PreferenceVersion.objects.filter(recipient=member).exists()
    for payload in [
        {"organization_id": str(uuid.uuid4()), "preferences": []},
        {"preferences": [{"kind": "system", "recipient": str(uuid.uuid4())}]},
    ]:
        rejected = client.patch(PREFERENCES, payload, format="json")
        assert rejected.status_code == 400
        assert "unknown_field" in str(rejected.data)


def test_permissions_and_empty_scope_fail_closed(inbox):
    client, _member, profile = inbox
    profile.permission_codes = ["notification.read"]
    profile.save(update_fields=["permission_codes"])
    assert client.patch(PREFERENCES, {"preferences": []}, format="json").status_code == 403
    profile.scope = {
        "centers": {"mode": "none", "ids": []},
        "quadrants": {"mode": "none", "ids": []},
    }
    profile.save(update_fields=["scope"])
    assert client.get(BASE).status_code == 403
    profile.permission_codes = []
    profile.scope = all_scope()
    profile.save(update_fields=["permission_codes", "scope"])
    assert client.get(BASE).status_code == 403
    assert client.post(f"{BASE}read-all/").status_code == 403


def test_safe_reference_redacts_foreign_unknown_and_revoked_objects(inbox):
    from shifts.models import Motorcycle

    client, member, profile = inbox
    target = Motorcycle.objects.create(organization=member.organization, code="M-NOTICE")
    foreign = Motorcycle.objects.create(organization=OrganizationFactory(), code="M-FOREIGN")
    for identifier in [target.pk, foreign.pk, uuid.uuid4()]:
        notice(
            member,
            code="incident.severe_fault",
            params={"fault_id": str(uuid.uuid4())},
            object_kind="motorcycle",
            object_id=identifier,
        )
    unavailable = client.get(BASE).data["results"]
    assert all(
        row["object_ref"]["available"] is False and row["params"] == {} for row in unavailable
    )
    assert all(
        row["object_ref"]["id"] is None and row["object_ref"]["code"] is None for row in unavailable
    )
    profile.permission_codes += ["motorcycle.read"]
    profile.save(update_fields=["permission_codes"])
    available = [row for row in client.get(BASE).data["results"] if row["object_ref"]["available"]]
    assert len(available) == 1
    assert available[0]["object_ref"]["code"] == "M-NOTICE"
    assert available[0]["params"] == {}
    profile.permission_codes.remove("motorcycle.read")
    profile.save(update_fields=["permission_codes"])
    assert not any(row["object_ref"]["available"] for row in client.get(BASE).data["results"])


def test_object_permission_cannot_borrow_scope_from_notification_grant(inbox):
    from shifts.models import Motorcycle

    client, member, _profile = inbox
    target = Motorcycle.objects.create(organization=member.organization, code="M-NONE")
    denied = ProfileFactory(organization=member.organization, permission_codes=["motorcycle.read"])
    member.profiles.add(denied)
    notice(member, code="incident.severe_fault", object_kind="motorcycle", object_id=target.pk)
    reference = client.get(BASE).data["results"][0]["object_ref"]
    assert reference["available"] is False
    assert reference["id"] is None


def test_incident_reference_keeps_current_event_void_state_and_matching_params(inbox, monkeypatch):
    from incidents.models import Incident
    from notifications import references
    from notifications.serializers import NotificationSerializer

    _client, member, _profile = inbox
    target = Incident(pk=uuid.uuid4(), code="I-NOTICE")
    target.state = "voided"
    row = Notification(
        id=uuid.uuid4(),
        kind="incident",
        code="incident.closed",
        object_kind="incident",
        object_id=target.pk,
        params={"incident_id": str(uuid.uuid4()), "event_id": str(uuid.uuid4())},
    )
    monkeypatch.setattr(references, "_target", lambda *_args: target)
    serializer = NotificationSerializer(context={"member": member})
    assert serializer.get_object_ref(row)["is_voided"] is True
    assert serializer.get_params(row) == {}
    matching = Notification(
        id=uuid.uuid4(),
        object_kind="incident",
        object_id=target.pk,
        params={"incident_id": str(target.pk), "event_id": str(uuid.uuid4())},
    )
    assert serializer.get_params(matching) == {"incident_id": str(target.pk)}
    monkeypatch.setattr(references, "_target", lambda *_args: None)
    assert serializer.get_object_ref(matching)["available"] is True


def test_preference_values_are_isolated_by_owner_and_active_organization(inbox):
    client, member, profile = inbox
    payload = {"preferences": [{"kind": "incident", "in_app": False, "email": True}]}
    assert client.patch(PREFERENCES, payload, format="json").status_code == 200
    colleague = MembershipFactory(organization=member.organization, scope=all_scope())
    colleague.profiles.add(profile)
    client.force_authenticate(colleague.user)
    defaults = client.get(PREFERENCES).data["preferences"]
    assert next(row for row in defaults if row["kind"] == "incident")["email"] is False
    foreign = MembershipFactory(user=member.user, scope=all_scope())
    foreign_profile = ProfileFactory(
        organization=foreign.organization,
        scope=all_scope(),
        permission_codes=profile.permission_codes,
    )
    foreign.profiles.add(foreign_profile)
    client.force_authenticate(member.user)
    other = client.get(PREFERENCES, HTTP_X_ORGANIZATION=foreign.organization.slug).data[
        "preferences"
    ]
    assert next(row for row in other if row["kind"] == "incident")["email"] is False


def test_producer_rejects_user_text_and_history_cannot_be_modified(inbox):
    _client, member, _profile = inbox
    for changes in [
        {"code": "unregistered.user.text"},
        {"params": {"text": "private text"}},
        {"code": "incident.created", "params": {"incident_id": "user text"}},
    ]:
        with pytest.raises(FieldValidationError):
            notice(member, **changes)
    row = notice(member)
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(
            "UPDATE notifications_notification SET code = %s WHERE id = %s",
            ["incident.created", row.pk],
        )


def test_filters_validate_and_unread_first_order_is_explicit(inbox):
    client, member, _profile = inbox
    old = notice(member)
    client.post(f"{BASE}{old.pk}/read/")
    fresh = notice(member, code="incident.created")
    assert [row["id"] for row in client.get(BASE).data["results"]] == [str(fresh.pk), str(old.pk)]
    assert client.get(BASE, {"unread": "true"}).data["results"][0]["id"] == str(fresh.pk)
    assert client.get(BASE, {"kind": "system"}).data["results"][0]["id"] == str(old.pk)
    for query in [{"unread": "yes"}, {"kind": "other"}, {"page_size": 101}]:
        assert client.get(BASE, query).status_code == 400


@pytest.mark.django_db(transaction=True)
def test_cursor_snapshot_serializes_with_receipt_committing_after_reader_starts(inbox):
    client, member, _profile = inbox
    rows = [notice(member) for _index in range(3)]
    receipt_pending, release_writer = Event(), Event()
    reader_pid = Queue()

    def write_pending_receipt():
        close_old_connections()
        try:
            with transaction.atomic():
                mark_read(member, rows[-1].pk)
                receipt_pending.set()
                assert release_writer.wait(10)
        finally:
            close_old_connections()

    def read_first_page():
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                reader_pid.put(cursor.fetchone()[0])
            reader = APIClient()
            reader.force_authenticate(member.user)
            return reader.get(BASE, {"page_size": 1})
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        writer = executor.submit(write_pending_receipt)
        assert receipt_pending.wait(10)
        reader = executor.submit(read_first_page)
        identifier = reader_pid.get(timeout=10)
        try:
            _observe_reader_or_membership_lock(reader, identifier)
        finally:
            release_writer.set()
        writer.result(timeout=10)
        first = reader.result(timeout=10)

    assert first.status_code == 200
    seen = [row["id"] for row in first.data["results"]]
    next_url = first.data["next"]
    while next_url:
        page = client.get(next_url)
        assert page.status_code == 200
        seen.extend(row["id"] for row in page.data["results"])
        next_url = page.data["next"]
    assert set(seen) == {str(row.pk) for row in rows}
    assert len(seen) == len(rows)


def _observe_reader_or_membership_lock(reader, identifier):
    """Release the writer only after the reader finished or is observably blocked."""
    deadline = monotonic() + 10
    while not reader.done() and monotonic() < deadline:
        with connection.cursor() as cursor:
            cursor.execute("SELECT cardinality(pg_blocking_pids(%s))", [identifier])
            if cursor.fetchone()[0]:
                return
    assert reader.done(), "Reader neither completed nor reached the inbox membership lock."
