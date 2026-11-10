"""Actual PG legacy upgrade, raw Lab guards, empty reverse and populated refusal."""

from uuid import uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader

from lab.commands import execute_lab_command
from lab.models import EggCountAttempt, LabCommand, LabMethod, LabMethodVersion, LabResultRevision
from tests.lab_support import capture_bag, count_input, lab_context, receive
from tests.test_geography_decisions_b_33 import field as geography_field_fixture
from tests.test_lab_recounts_b_19 import allocation as allocation

field = geography_field_fixture  # Reuse the canonical authored fixture without another setup.

# Approved #107 additions, independent of the restored database or migration implementation.
SUPPLY_ADDITIVE_TABLES = (
    "bagdisposition",
    "couriertransitpolicyversion",
    "inventoryintent",
    "inventoryintentexecution",
    "lotwriteoff",
    "originreleaseline",
    "originreleaseproof",
    "reconciliation",
    "reconciliationline",
    "reconciliationversion",
    "releasecancellation",
    "releasecancellationline",
    "returnacceptance",
    "returndeclaration",
    "supplyassignment",
    "supplyassignmentcommandreceipt",
    "supplyassignmentline",
    "supplyassignmentversion",
    "supplydiscrepancy",
    "supplydiscrepancydecision",
    "supplyevent",
    "supplyledgersource",
    "supplymaterialmappingversion",
    "supplyreceipt",
    "supplyreceiptline",
    "supplyshrinkage",
    "supplystockeffect",
    "supplysourcelink",
    "supplysourceresult",
    "supplyuse",
    "supplyvoidaudit",
    "supplyvoidsourcelink",
)
SUPPLY_ADDITIVE_TRIGGERS = (
    {
        (f"inventory_{name}", f"inventory_{name}_{suffix}")
        for name in SUPPLY_ADDITIVE_TABLES
        for suffix in ("guard", "supply_complete")
    }
    | {
        (f"inventory_{name}", f"inventory_{name}_reservation_complete")
        for name in ("originreleaseline", "releasecancellationline", "supplyreceiptline")
    }
    | {
        (f"inventory_{name}", f"inventory_{name}_source_complete")
        for name in (
            "supplyevent",
            "supplyreceipt",
            "supplyuse",
            "supplyshrinkage",
            "returndeclaration",
        )
    }
    | {
        ("inventory_stockmovement", "inventory_supply_stock_lock"),
        ("inventory_stockmovement", "inventory_supply_movement_complete"),
        ("inventory_inventoryintentexecution", "inventory_supply_execution_complete"),
        ("inventory_supplyassignment", "inventory_assignment_plan_complete"),
        ("inventory_supplyassignmentversion", "inventory_assignment_version_complete"),
        ("inventory_reconciliationversion", "inventory_supply_frame_complete"),
        ("inventory_supplyvoidaudit", "inventory_supply_void_complete"),
        ("uploads_attachmentlink", "uploads_inventory_intent_parent_guard"),
    }
)


# Canonical #127 additions; keep exact identities independent of the restored DB.
COMMUNITY_ADDITIVE_TRIGGERS = {
    (table, f"{table}_{suffix}")
    for table in (
        "community_communityactivity",
        "community_communityactivityevent",
        "community_communitycommandreceipt",
        "community_communitysourcelink",
        "community_complaintincidentlink",
        "community_communitysourcecancellation",
    )
    for suffix in ("guard", "complete")
} | {
    ("field_sync_fieldevent", "community_source_complete"),
    ("reviews_revieweffectreceipt", "community_review_complete"),
}

# Independent #115 additions, explicit identities rather than a discovered allowlist.
QA_ADDITIVE_TRIGGERS = {
    ("inventory_paddlestockreturn", "inventory_paddlestockreturn_guard"),
    ("inventory_paddlestockreturn", "inventory_paddle_return_complete"),
    ("inventory_stockoperation", "inventory_paddle_operation_guard"),
    ("inventory_stockoperation", "inventory_paddle_operation_complete"),
    ("inventory_stockmovement", "inventory_paddle_movement_complete"),
    ("uploads_attachmentlink", "uploads_lab_paddle_parent_guard"),
    ("uploads_attachmentlink", "uploads_lab_paddle_parent_complete"),
}

# Approved #101 additions, independent of the restored database or migration implementation.
PEOPLE_ADDITIVE_TRIGGERS = {
    (table, f"{table}_{suffix}")
    for table in (
        "people_training",
        "people_trainingversion",
        "people_actiontrainingrequirementversion",
        "people_certification",
        "people_certificationrevocation",
        "people_evaluationrubric",
        "people_evaluationrubricversion",
        "people_evaluation",
        "people_evaluationattempt",
        "people_evaluationvoid",
        "people_evaluationcompletion",
        "people_evaluationnoticepolicyversion",
        "people_trainingnoticecause",
        "people_trainingnoticeintent",
        "people_trainingnoticepublication",
        "people_trainingnoticeroute",
        "people_eligibilityassessmentreceipt",
        "people_peoplecommand",
    )
    for suffix in ("guard", "complete_guard")
} | {("uploads_attachmentlink", "uploads_certification_parent_guard")}


# Explicit #116 additions; preserve every independent legacy-trigger assertion.
RELEASE_ADDITIVE_TRIGGERS = {
    (table, f"{table}_guard")
    for table in (
        "releases_permit",
        "releases_permittype",
        "releases_permitversion",
        "releases_permitsuspension",
        "releases_permitsuspensionnotice",
        "releases_releasedevice",
        "releases_releasedevicestatus",
        "releases_releaseschedule",
        "releases_release",
    )
} | {
    ("releases_release", "releases_release_source_guard"),
    ("releases_release", "inventory_release_stock_complete"),
    ("inventory_stockoperation", "inventory_release_operation_guard"),
    ("inventory_stockoperation", "inventory_release_operation_complete"),
    ("inventory_stockmovement", "inventory_release_movement_complete"),
}


def insert_genuine_legacy_lab_observation(apps, context, bag):
    """Construct a real source/pins/command chain in the supplied model state.

    No new115 writer runs against the old schema and no source/actor is fabricated.
    Commit before upgrading, so the new forward-only boundary cannot certify it.
    The current-state raw-bypass case reuses these constructors without forward
    proof; its deferred guard must reject the same chain after upgrading.
    """
    from core.snapshots import snapshot_hash
    from lab.access import reading_source_proof
    from lab.commands import canonical_values
    from lab.counting import capture_lab_rules, count_projection
    from lab.queue import next_queue_snapshot
    from lab.reception import receipt_projection

    shared = {
        "organization_id": context.actor.organization.pk,
        "created_by_id": context.actor.user.pk,
    }

    def model(name):
        return apps.get_model("lab", name)

    def command(action, values, command_id):
        canonical = canonical_values(values)
        return model("LabCommand").objects.create(
            **shared,
            command_id=command_id,
            action=action,
            target_id=bag.pk,
            canonical_input=canonical,
            source_id=bag.event_id,
            input_hash=snapshot_hash(
                {"action": action, "target": str(bag.pk), "values": canonical}
            ),
        )

    with transaction.atomic():
        received = command("receive", {}, uuid4())
        receipt = model("BagReceipt").objects.create(
            **shared,
            command=received,
            bag_id=bag.pk,
            reading_id=bag.reading_id,
            source_id=bag.event_id,
            kind="bag",
        )
        receive_body = {
            "bag": {"id": str(bag.pk), "code": bag.code},
            "reading": {"id": str(bag.reading_id), "paddle_present": True},
            "receipt": receipt_projection(receipt),
        }
        model("LabCommandResult").objects.create(
            **shared,
            command=received,
            status=200,
            body=canonical_values(receive_body),
            content_hash=snapshot_hash(canonical_values(receive_body)),
            subjects=[{"reading_id": str(bag.reading_id), "permission": "bag.receive"}],
        )
        request = count_input(context, bag, 0)
        counted = command("count", request.values, request.command_id)
        first = model("EggCountAttempt").objects.create(
            **shared,
            command=counted,
            bag_id=bag.pk,
            receipt=receipt,
            ordinal=1,
            value=0,
            rules=capture_lab_rules(context.actor.organization),
            source_proof=reading_source_proof(bag.reading),
            viability_reason="not_requested",
        )
        model("LabResultRevision").objects.create(
            **shared, command=counted, bag_id=bag.pk, revision=1, count=first
        )
        actual = EggCountAttempt.objects.get(pk=first.pk)
        body = canonical_values(
            {
                "count": count_projection(actual),
                **next_queue_snapshot(context.actor, bag, request.values),
            }
        )
        model("LabCommandResult").objects.create(
            **shared,
            command=counted,
            status=201,
            body=body,
            content_hash=snapshot_hash(body),
            subjects=[{"reading_id": str(bag.reading_id), "permission": "egg_count.create"}],
        )
    return request, body


def assert_lab_sql_dependencies_precede_empty_plan_guard(loader):
    plan = loader.graph.forwards_plan(("lab", "0002_append_only_guards"))
    rules = ("rules", "0004_void_reason_code")
    assert rules in plan, (
        "Lab SQL rule functions require Rules tables and void columns on an empty database"
    )
    assert plan.index(rules) < plan.index(("lab", "0002_append_only_guards"))


def old_trigger_definitions():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND c.relname NOT LIKE 'lab_%' AND t.tgname NOT LIKE 'lab_%' ORDER BY c.relname,t.tgname"
        )
        return cursor.fetchall()


def legacy_decision_rows(field):
    from geography.decisions.closure import close_quadrant
    from geography.decisions.services import RelocationDecisionRequest, decide_relocation
    from geography.models import Quadrant, QuadrantVersion
    from tests.test_geography_decisions_b_33 import REASON, proposal

    source = proposal(field)
    result = decide_relocation(
        field.actor, source.pk, RelocationDecisionRequest("rejected", REASON, 0)
    )
    assert result.next_day_task is not None
    empty = Quadrant.objects.create(
        organization=field.batch.organization,
        center=field.quadrant.center,
        code="LAB-LEGACY-EMPTY-Q",
    )
    QuadrantVersion.objects.create(
        organization=field.batch.organization,
        created_by=field.batch.user,
        quadrant=empty,
        revision=1,
        effective_from=field.epoch.effective_from,
        geometry=field.epoch.geometry,
    )
    closure = close_quadrant(field.actor, empty.pk, 1)
    return (source, result.decision, result.next_day_task, result.next_day_task.task, closure)


@pytest.mark.django_db(transaction=True)
def test_lab_upgrade_preserves_real_legacy_sources_and_reverse_never_deletes_audit(
    monkeypatch, field, make_member
):
    assert_lab_sql_dependencies_precede_empty_plan_guard(MigrationLoader(None))
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    legacy = legacy_decision_rows(field)
    legacy_before = [type(row).objects.filter(pk=row.pk).values().get() for row in legacy]
    before = (
        bag.pk,
        bag.code,
        bag.reading_id,
        bag.event_id,
        bag.collector_id,
        bag.reading.point_version_id,
        bag.event.payload_sha256,
        bag.event.status,
        bag.event.device_time,
        bag.event.server_received_at,
    )
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    old = [
        ("lab", None),
        ("uploads", "0004_remove_attachmentlink_attachment_exactly_one_parent_and_more"),
        ("incidents", "0002_automaticincidentorigin"),
    ]
    try:
        executor.migrate(old)
        triggers = old_trigger_definitions()
        MigrationExecutor(connection).migrate(leaves)
        retained = {(table, name): definition for table, name, definition in triggers}
        restored = {
            (table, name): definition for table, name, definition in old_trigger_definitions()
        }
        assert {key: restored[key] for key in retained} == retained
        assert (
            restored.keys() - retained.keys()
            == SUPPLY_ADDITIVE_TRIGGERS
            | COMMUNITY_ADDITIVE_TRIGGERS
            | QA_ADDITIVE_TRIGGERS
            | PEOPLE_ADDITIVE_TRIGGERS
            | RELEASE_ADDITIVE_TRIGGERS
        )
        assert legacy_before == [
            type(row).objects.filter(pk=row.pk).values().get() for row in legacy
        ]
        bag.refresh_from_db()
        assert before == (
            bag.pk,
            bag.code,
            bag.reading_id,
            bag.event_id,
            bag.collector_id,
            bag.reading.point_version_id,
            bag.event.payload_sha256,
            bag.event.status,
            bag.event.device_time,
            bag.event.server_received_at,
        )
        assert not LabCommand.objects.exists()
        assert not LabMethod.objects.exists()
        # Exercise a populated released114 ->115 upgrade separately from the empty reverse.
        released = [("lab", "0003_material_disposition_guard")]
        MigrationExecutor(connection).migrate(released)
        old_apps = MigrationExecutor(connection).loader.project_state(released).apps
        request, saved = insert_genuine_legacy_lab_observation(old_apps, context, bag)
        original = LabCommand.objects.filter(command_id=request.command_id).values().get()
        MigrationExecutor(connection).migrate(leaves)
        from datetime import timedelta
        from zoneinfo import ZoneInfo

        from lab.models import LabBlindObservation, LabNumericDisclosure, RecountRequest
        from lab.recounts import ClosedDayInput, close_lab_day
        from tests.lab_support import AT, actor_with_codes
        from tests.test_lab_recounts_b_19 import configure_qa, qa_command

        assert not LabBlindObservation.objects.exists()
        replay = execute_lab_command(context.actor, request)
        assert replay.replayed
        assert replay.body == saved
        assert LabCommand.objects.filter(command_id=request.command_id).values().get() == original
        assert (
            not LabBlindObservation.objects.exists()
        )  # A legacy cached reply creates no forward proof.
        qa_method = configure_qa(context)
        closed_at = AT + timedelta(days=1)
        monkeypatch.setattr("lab.recounts.server_now", lambda: closed_at)
        monkeypatch.setattr("django.utils.timezone.now", lambda: closed_at)
        close_lab_day(
            ClosedDayInput(
                context.actor.organization,
                AT.astimezone(ZoneInfo(context.actor.organization.timezone)).date(),
            )
        )
        obligation = RecountRequest.objects.get(count_id=saved["count"]["id"])
        counter = actor_with_codes(context, make_member, ["recount.create"])
        attester = actor_with_codes(context, make_member, ["recount.adjudicate", "egg_count.read"])
        _, denied = qa_command(
            counter, obligation, "recount_claim", {"expected_revision": 0, "role": "second"}
        )
        assert denied.body["code"] == "lab_independence_unproven"
        attestation_values = {
            "expected_revision": 0,
            "expected_result_revision": 1,
            "counter_id": counter.user.pk,
            "role": "second",
            "external_reference": uuid4(),
            "reason_code": "other",
            "reason": "External synthetic operational declaration, not offline knowledge certification",
        }
        attestation_command, attested = qa_command(
            attester, obligation, "recount_attest", attestation_values
        )
        assert attested.status == 201
        assert execute_lab_command(attester, attestation_command).body == attested.body
        assert not LabNumericDisclosure.objects.filter(created_by=counter.user).exists()
        _, claimed = qa_command(
            counter, obligation, "recount_claim", {"expected_revision": 1, "role": "second"}
        )
        assert claimed.status == 201
        from lab.selectors import published_result_projection

        counter_profile = counter.user.memberships.get(
            organization=context.actor.organization
        ).profiles.get()
        counter_profile.permission_codes = ["egg_count.read"]
        counter_profile.save(update_fields=["permission_codes"])
        assert published_result_projection(counter, obligation.count)["value"] == 0
        counter_profile.permission_codes += ["recount.create"]
        counter_profile.save(update_fields=["permission_codes"])
        _, exposed_attempt = qa_command(
            counter,
            obligation,
            "recount",
            {
                "request_id": obligation.pk,
                "expected_revision": 2,
                "expected_result_revision": 1,
                "value": 0,
                "method_version": qa_method.pk,
                "confirmed_implausible": False,
            },
        )
        assert exposed_attempt.body["code"] == "lab_recount_disclosed"
        assert execute_lab_command(attester, attestation_command).body == attested.body
        with pytest.raises(IrreversibleError):
            MigrationExecutor(connection).migrate(released)
        assert EggCountAttempt.objects.get(pk=saved["count"]["id"]).value == 0
        assert legacy_before == [
            type(row).objects.filter(pk=row.pk).values().get() for row in legacy
        ]
    finally:
        MigrationExecutor(connection).migrate(leaves)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("allocation", ["piece"], indirect=True)
def test_raw_lab_bypasses_cannot_mutate_fork_cross_tenant_or_commit_incomplete(
    monkeypatch, org_b, make_member, allocation
):
    from django.apps import apps

    from lab.models import BagReceipt, LabBlindObservation, LabCommandResult

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    execute_lab_command(context.actor, count_input(context, bag, 0))
    count = EggCountAttempt.objects.get()
    unproven_bag = capture_bag(context, "RAW-BLIND-115", new_source=True)
    with pytest.raises(DatabaseError, match="forward policy boundary"), transaction.atomic():  # noqa: PT012 -- isolate genuine first-count proof at its actual deferred boundary.
        insert_genuine_legacy_lab_observation(apps, context, unproven_bag)
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS lab_eggcountattempt_qa_complete IMMEDIATE")
    assert not LabCommand.objects.filter(source_id=unproven_bag.event_id).exists()
    assert not BagReceipt.objects.filter(bag=unproven_bag).exists()
    assert not EggCountAttempt.objects.filter(bag=unproven_bag).exists()
    assert not LabCommandResult.objects.filter(command__source_id=unproven_bag.event_id).exists()
    assert not LabBlindObservation.objects.filter(count__bag=unproven_bag).exists()
    receive(context, unproven_bag)
    accepted = execute_lab_command(context.actor, count_input(context, unproven_bag, 0))
    assert accepted.status == 201
    assert LabBlindObservation.objects.filter(count_id=accepted.body["count"]["id"]).exists()
    for sql in (
        "UPDATE lab_eggcountattempt SET value=99 WHERE id=%s",
        "DELETE FROM lab_eggcountattempt WHERE id=%s",
    ):
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(sql, [count.pk])
    with pytest.raises(DatabaseError, match="exact result"), transaction.atomic():  # noqa: PT012 -- commit-time completion is the invariant.
        LabCommand.objects.create(
            organization=context.actor.organization,
            created_by=context.actor.user,
            command_id=uuid4(),
            action="count",
            target_id=bag.pk,
            input_hash="0" * 64,
            canonical_input={},
            source_id=bag.event_id,
        )
        connection.check_constraints()
    # Same authored method identity cannot be inserted under another tenant.
    method = LabMethod.objects.create(
        organization=context.actor.organization, created_by=context.actor.user, code="RAW-METHOD"
    )
    with pytest.raises(DatabaseError, match="tenant mismatch"), transaction.atomic():
        LabMethodVersion.objects.create(
            organization=org_b,
            created_by=None,
            method=method,
            revision=1,
            name="Synthetic",
            procedure="Synthetic",
            reference="Synthetic",
            effective_from=count.created_at,
            supports_viability=True,
            supports_rejection=True,
            content_hash="1" * 64,
        )
    current = LabResultRevision.objects.get(bag=bag)
    with pytest.raises(DatabaseError, match="revision fork"), transaction.atomic():
        LabResultRevision.objects.create(
            organization=context.actor.organization,
            created_by=context.actor.user,
            bag=bag,
            revision=3,
            previous=current,
            command=current.command,
            count=count,
        )
    with (
        pytest.raises(DatabaseError, match="active Lab dependents"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE field_sync_fieldevent SET voided_at=%s,voided_by_id=%s,void_reason=%s,void_reason_code=%s WHERE id=%s",
            [
                count.created_at,
                context.actor.user.pk,
                "Preserve active lab result",
                "other",
                bag.event_id,
            ],
        )
    assert EggCountAttempt.objects.get(pk=count.pk).value == 0
    from core.snapshots import snapshot_hash
    from lab.commands import canonical_values
    from lab.counting import capture_lab_rules
    from lab.independent_qa.selectors import cause_ids
    from lab.models import RecountAttempt, RecountClaim, RecountRequest
    from tests.lab_support import actor_with_codes
    from tests.test_lab_recounts_b_19 import configure_qa, qa_command

    method = configure_qa(context)
    observed_bag = capture_bag(context, "RAW-QA-115", new_source=True, has_eggs=False)
    receive(context, observed_bag)
    execute_lab_command(context.actor, count_input(context, observed_bag, 100))
    request = RecountRequest.objects.get(count__bag=observed_bag)
    counter = actor_with_codes(context, make_member, ["recount.create"])
    _, claimed = qa_command(
        counter, request, "recount_claim", {"expected_revision": 0, "role": "second"}
    )
    assert claimed.status == 201
    claim = RecountClaim.objects.get(request=request)
    for verb in (
        "UPDATE lab_recountclaim SET independence_proof='{}' WHERE id=%s",
        "DELETE FROM lab_recountclaim WHERE id=%s",
    ):
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(verb, [claim.pk])
    raw_values = canonical_values(
        {
            "request_id": request.pk,
            "expected_revision": 1,
            "expected_result_revision": 1,
            "value": 105,
            "confirmed_implausible": False,
            "method_version": method.pk,
        }
    )
    # A real current claim cannot lend its identity to a forged source/blind proof.
    with pytest.raises(DatabaseError, match="Independent observation"), transaction.atomic():  # noqa: PT012 -- the real command/fact must roll back together.
        command = LabCommand.objects.create(
            organization=counter.organization,
            created_by=counter.user,
            command_id=uuid4(),
            action="recount",
            target_id=observed_bag.pk,
            source_id=observed_bag.event_id,
            canonical_input=raw_values,
            input_hash=snapshot_hash(
                {"action": "recount", "target": str(observed_bag.pk), "values": raw_values}
            ),
        )
        RecountAttempt.objects.create(
            organization=counter.organization,
            created_by=counter.user,
            request=request,
            claim=claim,
            receipt=request.count.receipt,
            bag=observed_bag,
            command=command,
            role="second",
            value=105,
            viability_reason="not_requested",
            method_version=method,
            verification=method.verifications.first(),
            rules=capture_lab_rules(counter.organization),
            source_proof={
                "first_source": request.count.source_proof,
                "first_result_id": str(claim.first_result_id),
                "independence": {
                    **claim.independence_proof,
                    "counter_id": str(context.actor.user.pk),
                },
            },
        )
    assert not RecountAttempt.objects.exists()
    assert claim.independence_proof["cause_ids"] == cause_ids(request)
    from dataclasses import replace

    from inventory.models import PaddleStockReturn, StockMovement, StockOperation
    from lab.models import PaddleBagBinding, PaddleReuse
    from tests.test_lab_recounts_b_19 import prepared_physical_reuse
    from uploads.models import AttachmentLink, Upload

    physical = prepared_physical_reuse(allocation, make_member, monkeypatch)
    operations, movements = StockOperation.objects.count(), StockMovement.objects.count()
    unverified = Upload.objects.create(
        organization=physical.context.actor.organization,
        created_by=physical.context.actor.user,
        uploader=physical.context.actor.user,
        content_type="image/png",
        size_bytes=1,
        sha256="0" * 64,
    )
    forged_evidence = replace(
        physical.request,
        command_id=uuid4(),
        values={
            **physical.request.values,
            "evidence_ids": [unverified.public_id],
        },
    )
    # Skip only our evidence precheck; the real source, command, stock and parent commit remain.
    from lab.independent_qa import paddles

    real_kernel = paddles.execute_prepared_command

    def flush_real_private_parent(*args):
        result = real_kernel(*args)
        assert result.status == 201
        # Flush this actual parent before publication_context checks every deferred guard.
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS uploads_lab_paddle_parent_complete IMMEDIATE")
        return result

    with monkeypatch.context() as bypass:
        bypass.setattr(
            "lab.independent_qa.paddles.verified_paddle_evidence", lambda *_args: (unverified,)
        )
        bypass.setattr(
            "lab.independent_qa.paddles.execute_prepared_command", flush_real_private_parent
        )
        with (
            pytest.raises(DatabaseError, match="completed genuine command and verified evidence"),
            transaction.atomic(),
        ):
            execute_lab_command(physical.context.actor, forged_evidence)
    assert not PaddleReuse.objects.exists()
    assert not PaddleStockReturn.objects.exists()
    assert not AttachmentLink.objects.filter(upload=unverified).exists()
    assert not LabCommand.objects.filter(command_id=forged_evidence.command_id).exists()
    assert StockOperation.objects.count() == operations
    assert StockMovement.objects.count() == movements
    completed = execute_lab_command(physical.context.actor, physical.request)
    assert completed.status == 201
    returned = PaddleStockReturn.objects.get(reuse_id=completed.body["reuse"]["id"])
    binding = PaddleBagBinding.objects.get(pk=physical.request.values["binding_id"])

    def copied_fact(row, **overrides):
        return {
            **{
                field.attname: getattr(row, field.attname)
                for field in row._meta.concrete_fields
                if field.name not in {"id", "created_at"}
            },
            **overrides,
        }

    with pytest.raises(DatabaseError, match="exact genuine consumed debit"), transaction.atomic():
        PaddleStockReturn.objects.create(
            **copied_fact(returned, consumed_debit_id=physical.origin.pk)
        )
    with pytest.raises(DatabaseError, match="forward real issue"), transaction.atomic():
        PaddleBagBinding.objects.create(
            **copied_fact(binding, source_id=physical.bag.reading.ovitrap.event_id)
        )
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("DELETE FROM inventory_paddlestockreturn WHERE id=%s", [returned.pk])
    assert PaddleStockReturn.objects.get(pk=returned.pk).consumed_debit_id == physical.debit.pk
    assert StockOperation.objects.count() == operations + 1
    assert StockMovement.objects.count() == movements + 1
