"""Additive PostgreSQL upgrade, immutable raw writes and guarded reversal."""

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.executor import MigrationExecutor

from tests.test_geography_decisions_b_33 import REASON, field, lifecycle, proposal  # noqa: F401 -- shared authored fixture is collected here


@pytest.mark.django_db
@pytest.mark.parametrize("decision", ["approved", "rejected"])
def test_raw_bare_decision_cannot_commit_without_its_effect_and_publication(field, decision):  # noqa: F811 -- imported pytest fixture
    from geography.decisions.models import NextDayTask
    from geography.models import PointVersion
    from ovitraps.lifecycle.models import RelocationDecision
    from tests.ovitrap_support import CAPTURED

    source = proposal(field)
    with pytest.raises(DatabaseError, match="complete B33"), transaction.atomic():  # noqa: PT012 -- effect rows and deferred flush are the same atomic obligation
        version = None
        if decision == "approved":
            version = PointVersion.objects.create(
                organization=field.batch.organization,
                created_by=field.batch.user,
                point=field.point,
                version=2,
                location=source.new_location,
                effective_from=CAPTURED,
            )
        RelocationDecision.objects.create(
            organization=field.batch.organization,
            created_by=field.batch.user,
            event=source.event,
            proposal=source,
            decision=decision,
            reason=REASON,
            revision=1,
            decided_at=CAPTURED,
            published_point_version=version,
        )
        connection.check_constraints()
    assert not RelocationDecision.objects.exists()
    assert not NextDayTask.objects.exists()
    assert PointVersion.objects.filter(point=field.point).count() == 1


@pytest.mark.django_db(transaction=True)
def test_additive_upgrade_keeps_legacy_decision_unknown_audit_and_protects_new_provenance(field):  # noqa: F811 -- pytest injects the imported shared fixture by name
    from geography.decisions.models import NextDayTask
    from geography.decisions.services import RelocationDecisionRequest, decide_relocation
    from ovitraps.lifecycle.models import RelocationDecision
    from tests.factories import OrganizationFactory

    source = proposal(field)
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    previous = [("geography", "0002_insert_only_guards"), ("ovitraps", "0004_removal_resolution")]
    head_state = None
    try:
        legacy_state = executor.migrate(previous)
        old = legacy_state.apps.get_model("ovitraps", "RelocationDecision")
        legacy = old.objects.create(
            organization_id=field.batch.organization.pk,
            created_by_id=field.batch.user.pk,
            event_id=source.event_id,
            proposal_id=source.pk,
            decision="rejected",
        )
        executor = MigrationExecutor(connection)
        head_state = executor.migrate(leaves, state=legacy_state)
        retained = RelocationDecision.objects.get(pk=legacy.pk)
        assert retained.reason is None
        assert retained.decided_at is None
        assert retained.revision is None
        assert retained.published_point_version_id is None
        assert retained.created_at == legacy.created_at
        assert retained.event_id == source.event_id
        assert not NextDayTask.objects.exists()
        from ovitraps.lifecycle.models import RelocationProposal
        from tests.ovitrap_support import ingest

        sent = lifecycle(field, "relocate")
        assert ingest(field, sent).status == "accepted"
        current = RelocationProposal.objects.get(event_id=sent.id)
        result = decide_relocation(
            field.actor, current.pk, RelocationDecisionRequest("rejected", REASON, 0)
        )
        with (
            pytest.raises(DatabaseError, match="real decision and task provenance"),
            transaction.atomic(),
        ):
            NextDayTask.objects.create(
                organization=OrganizationFactory(),
                created_by=field.batch.user,
                proposal=current,
                decision=result.decision,
                task=result.next_day_task.task,
            )
        with (
            pytest.raises(DatabaseError, match="insert-only"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "UPDATE geography_nextdaytask SET created_at=created_at WHERE id=%s",
                [result.next_day_task.pk],
            )
        executor = MigrationExecutor(connection)
        applied = set(executor.recorder.applied_migrations())
        with (
            pytest.raises(DatabaseError, match="retained B33 relocation audit"),
            transaction.atomic(),
        ):
            executor.migrate(previous)
        assert set(executor.recorder.applied_migrations()) == applied
        assert NextDayTask.objects.filter(pk=result.next_day_task.pk).exists()
    finally:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(leaves)
        executor.migrate(leaves, plan=plan, state=head_state if not plan else None)
