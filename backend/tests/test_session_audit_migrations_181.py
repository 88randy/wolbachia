"""Real legacy upgrade and irreversible privacy boundary, only executed by PostgreSQL CI."""

from datetime import UTC, datetime, timedelta

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.executor import MigrationExecutor

from tests.factories import DeviceFactory, MembershipFactory, UserFactory, WidgetFactory


@pytest.mark.django_db(transaction=True)
def test_session_audit_upgrade_keeps_unknown_end_honest_and_cannot_restore_people(
    org_a, monkeypatch
):
    from accounts.models import DeviceSession
    from accounts.session_audit_retention import dissociate_ended_sessions
    from tests.testapp.models import Widget

    now = datetime(2026, 11, 4, 12, tzinfo=UTC)
    clock = {"now": now - timedelta(days=500)}
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock["now"])
    user = UserFactory()
    device = DeviceFactory(organization=org_a, created_by=user, last_user=user)
    business = WidgetFactory(organization=org_a, created_by=user)
    business_before = Widget.objects.filter(pk=business.pk).values().get()
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    previous = [("accounts", "0002_device_session_and_token_pair")]
    head_state = None
    try:
        legacy_state = executor.migrate(previous)
        old_apps = legacy_state.apps
        sessions = old_apps.get_model("accounts", "DeviceSession")
        pairs = old_apps.get_model("accounts", "TokenPair")
        common = {
            "organization_id": org_a.pk,
            "device_id": device.pk,
            "user_id": user.pk,
            "created_by_id": user.pk,
        }
        known = sessions.objects.create(
            **common, revoked_at=clock["now"], revoked_by_id=user.pk, revoke_reason="logout"
        )
        unknown = sessions.objects.create(**common)
        clock["now"] = now
        live = sessions.objects.create(**common)
        pairs.objects.create(
            organization_id=org_a.pk,
            created_by_id=user.pk,
            session_id=live.pk,
            access_hash="a" * 64,
            refresh_hash="b" * 64,
            access_expires_at=now + timedelta(days=1),
            refresh_expires_at=now + timedelta(days=30),
        )
        retained = {
            row.pk: sessions.objects.filter(pk=row.pk).values().get()
            for row in (known, unknown, live)
        }
        executor = MigrationExecutor(connection)
        head_state = executor.migrate(leaves, state=legacy_state)
        for identifier, values in retained.items():
            current = DeviceSession.objects.filter(pk=identifier).values().get()
            assert {key: current[key] for key in values} == values
        known = DeviceSession.objects.get(pk=known.pk)
        unknown = DeviceSession.objects.get(pk=unknown.pk)
        live = DeviceSession.objects.get(pk=live.pk)
        assert (
            known.ended_at
            == known.retention_anchor
            == now - timedelta(days=500) + timedelta(hours=72)
        )
        assert known.end_basis == "revocation_window"
        assert known.end_reason == "logout"
        assert unknown.ended_at is None
        assert unknown.retention_anchor == now
        assert unknown.end_basis == "legacy_empty"
        assert unknown.end_reason == "unknown"
        assert live.end_basis == ""
        assert live.retention_anchor is None
        # Before any identity is removed, schema reversal is allowed and preserves original fields.
        executor = MigrationExecutor(connection)
        legacy_state = executor.migrate(previous)
        executor = MigrationExecutor(connection)
        head_state = executor.migrate(leaves, state=legacy_state)
        assert dissociate_ended_sessions().sessions_dissociated == 1
        known.refresh_from_db()
        assert known.user_id is known.created_by_id is known.revoked_by_id is None
        for sql in (
            "UPDATE accounts_devicesession SET user_id=%s WHERE id=%s",
            "UPDATE accounts_devicesession SET created_by_id=%s WHERE id=%s",
            "UPDATE accounts_devicesession SET revoked_by_id=%s WHERE id=%s",
        ):
            with (
                pytest.raises(DatabaseError) as blocked,
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(sql, [user.pk, known.pk])
            assert blocked.value.__cause__.sqlstate == "23514"
        executor = MigrationExecutor(connection)
        applied = set(executor.recorder.applied_migrations())
        with pytest.raises(IrreversibleError, match="cannot be restored"), transaction.atomic():
            executor.migrate(previous)
        assert set(executor.recorder.applied_migrations()) == applied
        assert Widget.objects.filter(pk=business.pk).values().get() == business_before
        device.refresh_from_db()
        assert device.last_user_id == user.pk
        assert DeviceSession.objects.count() == len(retained)
    finally:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(leaves)
        executor.migrate(leaves, plan=plan, state=head_state if not plan else None)


@pytest.mark.django_db(transaction=True)
def test_personnel_guards_cannot_be_reversed_after_private_facts_are_stored(org_a, make_member):
    from accounts.models import AccessLog, Personnel
    from organizations.models import Center

    actor, _ = make_member(org_a)
    member = MembershipFactory(organization=org_a)
    center = Center.objects.create(
        organization=org_a, created_by=actor, code="SYNTHETIC", name="Synthetic center"
    )
    person = Personnel.objects.create(
        organization=org_a,
        created_by=actor,
        membership=member,
        center=center,
        display_name="Synthetic retained employee",
    )
    receipt = AccessLog.objects.create(
        organization=org_a,
        created_by=actor,
        target=person,
        center=center,
        action=AccessLog.Action.CREATE,
        origin=AccessLog.Origin.INTERNAL,
        revision=person.revision,
    )
    retained_person = Personnel.objects.filter(pk=person.pk).values().get()
    retained_receipt = AccessLog.objects.filter(pk=receipt.pk).values().get()
    leaves = MigrationExecutor(connection).loader.graph.leaf_nodes()
    try:
        with pytest.raises(IrreversibleError, match="Retain personnel"):
            MigrationExecutor(connection).migrate(
                [("accounts", "0004_personnel_accesslog_and_more")]
            )
        assert Personnel.objects.filter(pk=person.pk).values().get() == retained_person
        assert AccessLog.objects.filter(pk=receipt.pk).values().get() == retained_receipt
    finally:
        MigrationExecutor(connection).migrate(leaves)
