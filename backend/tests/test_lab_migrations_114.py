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
    monkeypatch, field
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
        assert restored.keys() - retained.keys() == SUPPLY_ADDITIVE_TRIGGERS
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
        receive(context, bag)
        counted = execute_lab_command(context.actor, count_input(context, bag, 0))
        with pytest.raises(IrreversibleError):
            MigrationExecutor(connection).migrate(old)
        assert EggCountAttempt.objects.get(pk=counted.body["count"]["id"]).value == 0
        assert legacy_before == [
            type(row).objects.filter(pk=row.pk).values().get() for row in legacy
        ]
    finally:
        MigrationExecutor(connection).migrate(leaves)


@pytest.mark.django_db(transaction=True)
def test_raw_lab_bypasses_cannot_mutate_fork_cross_tenant_or_commit_incomplete(monkeypatch, org_b):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    execute_lab_command(context.actor, count_input(context, bag, 0))
    count = EggCountAttempt.objects.get()
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
