"""Actual legacy upgrade, custody SQL completeness and protected reversal (PostgreSQL only)."""

from uuid import uuid4

import pytest
from django.db import DatabaseError, connection, transaction
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.executor import MigrationExecutor

from tests.test_inventory_transfers_106 import (
    custody as custody_fixture,
)
from tests.test_inventory_transfers_106 import (
    dispatch_request,
    prepared,
    verified_upload,
)

custody = custody_fixture  # One authored setup; no transfer exists before the upgrade test.


@pytest.mark.django_db(transaction=True)
def test_legacy_upgrade_preserves_signed_inventory_and_all_four_evidence_parents(
    custody,
    make_member,
    monkeypatch,
    org_b,
):
    from inventory.conditions import record_condition
    from inventory.models import ConditionReading, StockMovement, StockOperation
    from inventory.transfers.models import Transfer, TransferEvent
    from inventory.transfers.services import dispatch_transfer
    from shifts.models import MotorcycleBlockEvent
    from tests.factories import FieldEventFactory, MotorcycleFactory, ReviewItemFactory
    from tests.inventory_support import AT, biological_context, capture
    from uploads.models import AttachmentLink, Upload

    context, _ = custody
    biological = biological_context(context.actor.organization, make_member, monkeypatch)
    reading = record_condition(capture(biological, AT, "21", "35"))
    incident = reading.breach.incident_link.incident
    source = FieldEventFactory(
        organization=context.actor.organization, created_by=context.actor.user
    )
    fault = MotorcycleBlockEvent.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        motorcycle=MotorcycleFactory(organization=context.actor.organization),
        action="block",
        blocked_reason="severe_check",
        reason="Synthetic immutable fault",
        field_event=source,
    )
    item = ReviewItemFactory(field_event=source)
    for parent in (
        {"field_event": source},
        {"fault": fault},
        {"incident": incident},
        {"review_item": item},
    ):
        upload_id = verified_upload(context.actor)
        AttachmentLink.objects.create(
            organization=context.actor.organization,
            created_by=context.actor.user,
            upload=Upload.objects.get(public_id=upload_id),
            **parent,
        )
    old_legs = list(
        StockMovement.objects.order_by("pk").values_list("pk", "quantity", "operation_id")
    )
    old_hashes = list(
        StockOperation.objects.order_by("pk").values_list("pk", "content_hash", "source_id")
    )
    old_links = list(
        AttachmentLink.objects.order_by("pk").values_list(
            "pk", "upload_id", "field_event_id", "fault_id", "incident_id", "review_item_id"
        )
    )
    original = (
        reading.pk,
        reading.content_hash,
        reading.location_version_id,
        reading.lot_version_id,
    )
    executor = MigrationExecutor(connection)
    leaves = executor.loader.graph.leaf_nodes()
    previous = [
        ("inventory", "0002_fact_guards"),
        ("uploads", "0003_append_only_reviews"),
        ("reviews", "0003_append_only_reviews"),
    ]
    try:
        executor.migrate(previous)
        MigrationExecutor(connection).migrate(leaves)
        assert old_legs == list(
            StockMovement.objects.order_by("pk").values_list("pk", "quantity", "operation_id")
        )
        assert old_hashes == list(
            StockOperation.objects.order_by("pk").values_list("pk", "content_hash", "source_id")
        )
        assert old_links == list(
            AttachmentLink.objects.order_by("pk").values_list(
                "pk", "upload_id", "field_event_id", "fault_id", "incident_id", "review_item_id"
            )
        )
        retained = ConditionReading.objects.get(pk=reading.pk)
        assert original == (
            retained.pk,
            retained.content_hash,
            retained.location_version_id,
            retained.lot_version_id,
        )
        assert (retained.capture_mode, retained.capture_location_id) == ("legacy_initial", None)
        first = prepared(custody)
        sent = dispatch_transfer(dispatch_request(context.actor, first))
        for statement in (
            "UPDATE inventory_transferevent SET manifest='{}'::jsonb WHERE id=%s",
            "DELETE FROM inventory_transferevent WHERE id=%s",
        ):
            with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(statement, [sent.event.pk])
        with pytest.raises(DatabaseError), transaction.atomic():
            StockOperation.objects.create(
                organization=org_b,
                created_by=context.actor.user,
                transfer_event=sent.event,
                source_kind="transfer_dispatch",
                source_id=sent.event.pk,
                content_hash=sent.event.manifest_hash,
            )
        evidence = Upload.objects.get(public_id=verified_upload(context.actor))
        with pytest.raises(DatabaseError), transaction.atomic():
            AttachmentLink.objects.create(
                organization=org_b,
                created_by=context.actor.user,
                upload=evidence,
                transfer_event=sent.event,
            )
        fields = {
            field.attname: getattr(retained, field.attname)
            for field in retained._meta.concrete_fields
            if field.name not in {"id", "created_at"}
        }
        with pytest.raises(DatabaseError), transaction.atomic():
            ConditionReading.objects.create(
                **{
                    **fields,
                    "capture_mode": "explicit_location",
                    "capture_location_id": custody[1].pk,
                }
            )
        unreceived = prepared(custody)
        with pytest.raises(DatabaseError), transaction.atomic():
            ConditionReading.objects.create(
                **{
                    **fields,
                    "capture_mode": "explicit_location",
                    "capture_location_id": retained.location_version.location_id,
                    "temperature_c": retained.temperature_c + 1,
                }
            )
        with pytest.raises(DatabaseError), transaction.atomic():  # noqa: PT012 -- exact incomplete write plus deferred flush is the owning boundary
            TransferEvent.objects.create(
                organization=context.actor.organization,
                created_by=context.actor.user,
                transfer=unreceived.event.transfer,
                kind="receive",
                revision=2,
                manifest={"lines": [], "evidence": []},
                manifest_hash="a" * 64,
                command_id=uuid4(),
                device_time=AT,
                server_received_at=AT,
            )
            connection.check_constraints()
        assert not unreceived.event.transfer.events.filter(kind="receive").exists()
        with pytest.raises(IrreversibleError):
            MigrationExecutor(connection).migrate(previous)
        assert Transfer.objects.filter(pk=sent.event.transfer_id).exists()
        assert AttachmentLink.objects.filter(transfer_event=sent.event).exists()
    finally:
        MigrationExecutor(connection).migrate(leaves)
