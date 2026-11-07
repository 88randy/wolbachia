"""Whole PostgreSQL owner: real legacy upgrade, B10 guards and protected reverse."""

from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader

from tests.test_geography_decisions_b_33 import field as field_fixture
from tests.test_inventory_transfers_106 import custody as custody_fixture

field = field_fixture
custody = custody_fixture


def test_supply_guard_plan_declares_actual_source_and_evidence_table_dependencies():
    loader = MigrationLoader(None)
    guard = ("inventory", "0006_courier_supply_guards")
    plan = loader.graph.forwards_plan(guard)
    for predecessor in (
        ("inventory", "0005_courier_supplies"),
        ("lab", "0002_append_only_guards"),
        ("uploads", "0006_inventory_intent_parent"),
        ("reviews", "0005_supply_source_dependency"),
    ):
        assert predecessor in plan
        assert plan.index(predecessor) < plan.index(guard)


@pytest.mark.django_db(transaction=True)
def test_supply_upgrade_keeps_actual_legacy_admission_and_reading_audit(
    custody, field, make_member, monkeypatch, org_b
):
    from inventory.allocations.commands import AssignmentWrite
    from inventory.allocations.models import SupplyAssignment, SupplyAssignmentVersion
    from inventory.allocations.services import write_assignment
    from inventory.models import StockMovement, StockOperation
    from inventory.transfers.models import TransferEvent
    from inventory.transfers.services import dispatch_transfer
    from tests.inventory_support import AT
    from tests.lab_support import capture_bag, lab_context
    from tests.review_support import audit_current_membership
    from tests.test_inventory_transfers_106 import dispatch_request, prepared
    from tests.test_lab_migrations_114 import legacy_decision_rows
    from uploads.models import AttachmentLink

    stock, _ = custody
    transfer = prepared(custody)
    dispatched = dispatch_transfer(dispatch_request(stock.actor, transfer))
    assert dispatched.event.kind == "dispatch"
    lab = lab_context(monkeypatch)
    bag = capture_bag(lab)
    geographic = legacy_decision_rows(field)
    durable = [
        *geographic,
        bag,
        bag.reading,
        bag.event,
        stock.version,
        stock.lot,
        *TransferEvent.objects.all(),
        *StockOperation.objects.all(),
        *AttachmentLink.objects.all(),
    ]
    rows_before = [
        (type(row), row.pk, type(row).objects.filter(pk=row.pk).values().get()) for row in durable
    ]
    old_legs = list(
        StockMovement.objects.order_by("pk").values_list(
            "pk", "operation_id", "lot_id", "location_id", "piece_id", "unit_version_id", "quantity"
        )
    )
    original = (
        stock.version.pk,
        stock.lot.pk,
        bag.pk,
        bag.reading_id,
        bag.event_id,
        bag.collector_id,
        bag.event.payload_sha256,
        bag.event.status,
        bag.event.device_time,
        bag.event.server_received_at,
    )
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    previous = [
        ("inventory", "0004_signed_custody_guards"),
        ("uploads", "0005_remove_attachmentlink_attachment_exactly_one_parent_and_more"),
        ("reviews", "0004_transfer_source_dependency"),
        ("lab", "0002_append_only_guards"),
    ]
    try:
        executor.migrate(previous)
        MigrationExecutor(connection).migrate(leaves)
        stock.version.refresh_from_db()
        bag.refresh_from_db()
        assert original == (
            stock.version.pk,
            stock.lot.pk,
            bag.pk,
            bag.reading_id,
            bag.event_id,
            bag.collector_id,
            bag.event.payload_sha256,
            bag.event.status,
            bag.event.device_time,
            bag.event.server_received_at,
        )
        assert rows_before == [
            (model, identity, model.objects.filter(pk=identity).values().get())
            for model, identity, _ in rows_before
        ]
        assert old_legs == list(
            StockMovement.objects.order_by("pk").values_list(
                "pk",
                "operation_id",
                "lot_id",
                "location_id",
                "piece_id",
                "unit_version_id",
                "quantity",
            )
        )
        stock.profile.permission_codes = [
            *stock.profile.permission_codes,
            "inventory.allocate",
            "field_event.sync",
        ]
        stock.profile.save(update_fields=["permission_codes"])
        audit_current_membership(stock.member)
        planned = write_assignment(
            AssignmentWrite(
                stock.actor,
                {
                    "command_id": uuid4(),
                    "courier_id": stock.actor.user.pk,
                    "origin_id": stock.location.pk,
                    "date": AT.date(),
                    "shift_id": None,
                    "lines": [
                        {
                            "id": uuid4(),
                            "lot_id": stock.lot.pk,
                            "piece_id": None,
                            "unit_version_id": stock.supply_version.pk,
                            "quantity": Decimal(1),
                        }
                    ],
                },
            )
        )
        assignment_id = UUID(planned.body["assignment"]["id"])
        version = SupplyAssignmentVersion.objects.get(assignment_id=assignment_id)
        immutable = SupplyAssignmentVersion.objects.filter(pk=version.pk).values().get()
        for sql in (
            "UPDATE inventory_supplyassignmentversion SET revision=99 WHERE id=%s",
            "DELETE FROM inventory_supplyassignmentversion WHERE id=%s",
        ):
            with (
                pytest.raises(DatabaseError, match="insert-only"),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(sql, [version.pk])
        with (  # noqa: PT012 -- raw insert and deferred completion are one transaction invariant.
            pytest.raises(DatabaseError, match="organization mismatch"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "INSERT INTO inventory_supplyassignment(id,created_at,created_by_id,organization_id,courier_id,origin_id,date,shift_id) "
                "SELECT %s,created_at,created_by_id,%s,courier_id,origin_id,date,shift_id FROM inventory_supplyassignment WHERE id=%s",
                [uuid4(), org_b.pk, assignment_id],
            )
            connection.check_constraints()
        with (  # noqa: PT012 -- missing receipt must fail at deferred completion, not row construction.
            pytest.raises(DatabaseError, match="complete actual plan"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "INSERT INTO inventory_supplyassignmentversion(id,created_at,created_by_id,organization_id,assignment_id,revision,previous_id,planning_proof) "
                "SELECT %s,created_at,created_by_id,organization_id,assignment_id,revision+1,id,planning_proof FROM inventory_supplyassignmentversion WHERE id=%s",
                [uuid4(), version.pk],
            )
            connection.check_constraints()
        movement = StockMovement.objects.filter(location=stock.location, quantity__gt=0).first()
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO inventory_stockmovement(id,created_at,created_by_id,organization_id,operation_id,line_number,lot_id,location_id,assignment_id,piece_id,unit_version_id,quantity) "
                "SELECT %s,created_at,created_by_id,organization_id,operation_id,99,lot_id,location_id,%s,piece_id,unit_version_id,quantity FROM inventory_stockmovement WHERE id=%s",
                [uuid4(), assignment_id, movement.pk],
            )
        assert SupplyAssignmentVersion.objects.filter(pk=version.pk).values().get() == immutable
        assert SupplyAssignment.objects.filter(pk=assignment_id).exists()
        with pytest.raises(IrreversibleError):
            MigrationExecutor(connection).migrate(previous)
        assert SupplyAssignmentVersion.objects.filter(pk=version.pk).values().get() == immutable
        assert rows_before == [
            (model, identity, model.objects.filter(pk=identity).values().get())
            for model, identity, _ in rows_before
        ]
    finally:
        MigrationExecutor(connection).migrate(leaves)
    assert SupplyAssignmentVersion.objects.filter(pk=version.pk).values().get() == immutable
    assert rows_before == [
        (model, identity, model.objects.filter(pk=identity).values().get())
        for model, identity, _ in rows_before
    ]
