"""Real additive upgrade, raw integrity and protected reverse; PostgreSQL owner only."""

from uuid import uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.executor import MigrationExecutor

from tests.test_community_b_34 import community_context


@pytest.mark.django_db(transaction=True)
def test_community_upgrade_preserves_canonical_facts_and_refuses_populated_reverse(
    org_a, org_b, make_member, monkeypatch
):
    from community.models import (
        CommunityActivity,
        CommunityActivityEvent,
        CommunityCommandReceipt,
        CommunitySourceCancellation,
        CommunitySourceLink,
        ComplaintIncidentLink,
    )
    from community.services import ActivityCommand, create_activity, void_activity
    from geography.models import BlockVersion
    from tests.test_community_b_34 import community_source

    context = community_context(org_a, make_member, monkeypatch)
    retained = list(
        BlockVersion.objects.order_by("pk").values_list(
            "pk", "block_id", "geometry", "effective_from"
        )
    )
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    try:
        executor.migrate([("community", None)])
        assert retained == list(
            BlockVersion.objects.order_by("pk").values_list(
                "pk", "block_id", "geometry", "effective_from"
            )
        )
        MigrationExecutor(connection).migrate(leaves)
        receipt = create_activity(ActivityCommand(context.actor, uuid4(), context.values))
        activity = CommunityActivity.objects.get(pk=receipt["activity_id"])
        event = CommunityActivityEvent.objects.get(pk=receipt["event_id"])
        command = CommunityCommandReceipt.objects.get(event=event)
        for statement, identifier in (
            ("DELETE FROM community_communityactivity WHERE id=%s", activity.pk),
            ("DELETE FROM community_communityactivityevent WHERE id=%s", event.pk),
            ("DELETE FROM community_communitycommandreceipt WHERE id=%s", command.pk),
        ):
            with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(statement, [identifier])
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "UPDATE community_communityactivity SET attendance=99 WHERE id=%s", [activity.pk]
            )
        fields = {
            field.attname: getattr(activity, field.attname)
            for field in activity._meta.concrete_fields
            if field.name not in {"id", "created_at"}
        }
        with pytest.raises(DatabaseError), transaction.atomic():
            CommunityActivity.objects.create(
                **{
                    **fields,
                    "id": uuid4(),
                    "organization_id": org_b.pk,
                    "sequence": 2,
                    "code": "A-000002",
                }
            )
        with pytest.raises(DatabaseError), transaction.atomic():  # noqa: PT012 -- real insert plus owning deferred-constraint flush
            CommunityActivityEvent.objects.create(
                organization=org_a,
                created_by=context.actor.user,
                activity=activity,
                action="void",
                revision=2,
                command_id=uuid4(),
                origin="http",
                server_received_at=context.clock["now"],
                body_hash="a" * 64,
                reason="Refuse incomplete command without its actual receipt",
                reason_code="other",
                source_identity={},
                source_payload_hash="",
            )
            connection.check_constraints()
        assert not CommunityActivityEvent.objects.filter(action="void").exists()
        insert_receipt = CommunityCommandReceipt.objects.create

        def null_response(**values):
            values["response"] = {key: None for key in values["response"]}
            values["response"]["revision"] = values["event"].revision
            return insert_receipt(**values)

        invalid_id = uuid4()
        with monkeypatch.context() as corrupt:
            corrupt.setattr(CommunityCommandReceipt.objects, "create", null_response)
            with pytest.raises(DatabaseError) as null_receipt:
                create_activity(ActivityCommand(context.actor, invalid_id, context.values))
        assert null_receipt.value.__cause__.sqlstate == "23514"
        assert not CommunityActivity.objects.filter(pk=invalid_id).exists()
        control = create_activity(ActivityCommand(context.actor, uuid4(), context.values))
        assert (
            CommunityCommandReceipt.objects.get(command_id=control["command_id"]).response
            == control
        )

        def missing_void_command(**values):
            values["command"] = {}
            return insert_receipt(**values)

        correction = ActivityCommand(
            context.actor,
            uuid4(),
            {
                "expected_revision": 1,
                "reason_code": "other",
                "reason": "Correct this genuine HTTP aggregate",
            },
        )
        with monkeypatch.context() as corrupt:
            corrupt.setattr(CommunityCommandReceipt.objects, "create", missing_void_command)
            with pytest.raises(DatabaseError) as empty_command:
                void_activity(correction, control["activity_id"])
        assert empty_command.value.__cause__.sqlstate == "23514"
        assert not CommunityActivityEvent.objects.filter(
            activity_id=control["activity_id"], action="void"
        ).exists()
        assert void_activity(correction, control["activity_id"])["revision"] == 2
        captures = [community_source(context), community_source(context)]
        received = context.phone.sync(captures)
        assert [result["status"] for result in received.data["results"]] == [
            "accepted",
            "accepted",
        ]
        original_link = CommunitySourceLink.objects.select_related("event").get(
            source_event_id=captures[0]["id"]
        )
        with pytest.raises(DatabaseError) as crossed, transaction.atomic():
            CommunitySourceLink.objects.create(
                organization=org_a,
                created_by=context.actor.user,
                event=original_link.event,
                source_event_id=captures[1]["id"],
            )
        assert (
            crossed.value.__cause__.sqlstate == "23514"
        )  # Parent guard, not duplicate uniqueness.
        assert CommunitySourceLink.objects.get(pk=original_link.pk).source_event_id == (
            original_link.source_event_id
        )
        from datetime import timedelta

        from core.services import void_locked_record
        from core.void_reason import resolve_void_reason
        from field_sync.models import FieldEvent
        from tests.sync_support import event as source_event

        pending = community_source(context)
        pending["catalog_version"] = "f" * 64
        assert context.phone.sync([pending]).data["results"][0]["status"] == "in_review"
        reason = "Cancel the source without inventing an accepted correction"
        deferred_correction = source_event(
            type="record.void",
            voids_event_id=pending["id"],
            payload={"reason_code": "other", "reason": reason},
        )
        deferred_result = context.phone.sync(
            [deferred_correction],
            sent_at=(context.clock["now"] - timedelta(hours=1)).isoformat(),
        )
        assert deferred_result.data["results"][0]["status"] == "in_review"
        corrector = FieldEvent.objects.get(pk=deferred_correction["id"])
        with pytest.raises(DatabaseError) as not_effective, transaction.atomic():  # noqa: PT012 -- real mutation/INSERT plus deferred completion flush
            target = FieldEvent.objects.select_for_update().get(pk=pending["id"])
            void_locked_record(
                target, context.actor.user, resolve_void_reason(org_a.pk, reason, "other")
            )
            CommunitySourceCancellation.objects.create(
                organization=org_a,
                created_by=context.actor.user,
                source_event=corrector,
                target_event=target,
                source_payload_hash=corrector.payload_sha256,
                reason=reason,
                reason_code="other",
            )
            connection.check_constraints()
        assert not_effective.value.__cause__.sqlstate == "23514"
        assert FieldEvent.objects.get(pk=pending["id"]).voided_at is None
        assert not CommunitySourceCancellation.objects.filter(
            target_event_id=pending["id"]
        ).exists()
        effective = {**deferred_correction, "id": str(uuid4())}
        assert context.phone.sync([effective]).data["results"][0]["status"] == "accepted"
        assert CommunitySourceCancellation.objects.filter(source_event_id=effective["id"]).exists()
        assert not CommunityActivity.objects.filter(pk=pending["id"]).exists()
        with pytest.raises(DatabaseError):
            MigrationExecutor(connection).migrate([("community", None)])
        assert CommunityActivity.objects.get(pk=activity.pk).attendance == 7
        assert CommunityCommandReceipt.objects.filter(pk=command.pk).exists()
        assert not ComplaintIncidentLink.objects.exists()
        assert retained == list(
            BlockVersion.objects.order_by("pk").values_list(
                "pk", "block_id", "geometry", "effective_from"
            )
        )
    finally:
        MigrationExecutor(connection).migrate(leaves)
