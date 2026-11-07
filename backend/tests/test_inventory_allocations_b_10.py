"""Full B10 owners: credited custody, actual sources and current action boundaries."""

from decimal import Decimal

import pytest

from tests.test_inventory_transfers_106 import custody as custody


@pytest.fixture
def allocation(org_a, make_member, request):
    from dataclasses import replace
    from types import SimpleNamespace
    from uuid import UUID, uuid4

    from inventory.allocations.commands import AssignmentWrite, ConfigurationWrite, IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.permissions import ADMIN_CODES
    from inventory.allocations.services import write_assignment
    from inventory.allocations.transit import publish_transit_configuration
    from tests.factories import MotorcycleFactory
    from tests.inventory_support import AT, inventory_context
    from tests.review_support import audit_current_membership
    from tests.shift_support import make_check_items, open_event
    from tests.sync_support import make_phone

    identity = getattr(request, "param", "lot")
    quantity = Decimal(1) if identity == "piece" else Decimal(10)
    context = inventory_context(org_a, make_member, quantity=str(quantity), identity_kind=identity)
    from inventory.models import Piece

    piece = Piece.objects.get(lot=context.lot) if identity == "piece" else None
    context.profile.permission_codes = [
        *context.profile.permission_codes,
        *ADMIN_CODES,
        "field_event.sync",
        "field.bootstrap",
        "review_item.decide",
        "review_item.read",
    ]
    context.profile.save(update_fields=["permission_codes"])
    audit_current_membership(context.member)
    phone = make_phone(lambda *_args, **_kwargs: (context.actor.user, context.member), org_a)
    make_check_items(org_a)
    motorcycle = MotorcycleFactory(organization=org_a, center=context.center)
    opened = open_event(motorcycle.code)
    assert phone.sync([opened]).data["results"][0]["status"] == "accepted"
    policy = publish_transit_configuration(
        ConfigurationWrite(
            context.actor,
            context.supply.pk,
            {
                "supply_version_id": context.supply_version.pk,
                "expected_revision": 0,
                "name": "Synthetic manual transit procedure",
                "procedure": "Review actual synthetic photos",
                "reference": "Synthetic test only",
                "mode": "manual_evidence_review",
                "proof_roles": ["photo"],
                "is_active": True,
            },
        )
    )
    line_id = uuid4()
    written = write_assignment(
        AssignmentWrite(
            context.actor,
            {
                "command_id": uuid4(),
                "courier_id": phone.user.pk,
                "origin_id": context.location.pk,
                "date": AT.date(),
                "shift_id": UUID(opened["shift_id"]),
                "lines": [
                    {
                        "id": line_id,
                        "lot_id": context.lot.pk,
                        "piece_id": None if piece is None else piece.pk,
                        "unit_version_id": context.supply_version.pk,
                        "quantity": quantity,
                    }
                ],
            },
        )
    )
    assignment_id = UUID(written.body["assignment"]["id"])
    prepared = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "assignment_release",
            "assignment_id": assignment_id,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    released = execute_inventory_intent(
        context.actor,
        IntentExecution(UUID(prepared.body["intent"]["id"]), "assignment_release", assignment_id),
    )
    return SimpleNamespace(
        context=context,
        phone=phone,
        assignment_id=assignment_id,
        release_id=UUID(released.body["release"]["id"]),
        line_id=line_id,
        shift_id=UUID(opened["shift_id"]),
        source_actor=replace(context.actor, device_id=phone.device_id),
        policy=policy,
    )


def receive_capture(allocation, quantity="8"):
    from uuid import uuid4

    from inventory.allocations.models import OriginReleaseLine
    from tests.sync_support import event
    from tests.test_inventory_transfers_106 import verified_upload

    line_id = uuid4()
    release_line = OriginReleaseLine.objects.get(release_id=allocation.release_id)
    capture = event(
        type="supplies.receive",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 0,
            "plan_revision": 1,
            "release_id": str(allocation.release_id),
            "signature_upload_id": str(verified_upload(allocation.source_actor)),
            "actual_lines": [
                {"id": str(line_id), "release_line_id": str(release_line.pk), "quantity": quantity}
            ],
            "discrepancies": [],
        },
    )
    return capture, line_id


def held_supply_operation(operation, holding, release):
    """Retain the real successful service's locks until the competing request has answered."""
    from django.db import connection, transaction

    try:
        with transaction.atomic():
            result = operation()
            holding.set()
            assert release.wait(20), "the owning test must release its real transaction"
        return result
    finally:
        connection.close()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", ["release", "dispatch"])
def test_real_release_and_transfer_dispatch_share_one_spendable_balance(custody, first):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from uuid import UUID, uuid4

    from inventory.allocations.commands import AssignmentWrite, IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import OriginReleaseProof
    from inventory.allocations.services import write_assignment
    from inventory.allocations.stock import balance, spendable_balance
    from inventory.exceptions import InventoryConflictError, InventoryInProgressError
    from inventory.models import StockMovement
    from inventory.transactions import inventory_transaction
    from inventory.transfers.services import dispatch_transfer
    from tests.inventory_support import AT
    from tests.test_inventory_transfers_106 import dispatch_request, prepared

    context, _ = custody
    context.profile.permission_codes += ["inventory.allocate", "field_event.sync"]
    context.profile.save(update_fields=["permission_codes"])
    plan = write_assignment(
        AssignmentWrite(
            context.actor,
            {
                "command_id": uuid4(),
                "courier_id": context.actor.user.pk,
                "origin_id": context.location.pk,
                "date": AT.date(),
                "shift_id": None,
                "lines": [
                    {
                        "id": uuid4(),
                        "lot_id": context.lot.pk,
                        "piece_id": None,
                        "unit_version_id": context.supply_version.pk,
                        "quantity": Decimal(5),
                    }
                ],
            },
        )
    )
    assignment_id = UUID(plan.body["assignment"]["id"])
    intent = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "assignment_release",
            "assignment_id": assignment_id,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    release_command = IntentExecution(
        UUID(intent.body["intent"]["id"]), "assignment_release", assignment_id
    )
    transfer_command = dispatch_request(context.actor, prepared(custody, "5"))
    operations = {
        "release": lambda: execute_inventory_intent(context.actor, release_command),
        "dispatch": lambda: dispatch_transfer(transfer_command),
    }
    loser = "dispatch" if first == "release" else "release"
    holding, release = Event(), Event()
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(held_supply_operation, operations[first], holding, release)
        try:
            if not holding.wait(10):
                if future.done():
                    future.result()  # Preserve the actual winning-service failure as the cause.
                pytest.fail("The real service did not reach its retained-transaction barrier")
            with pytest.raises(InventoryInProgressError):
                operations[loser]()
        finally:
            release.set()
        future.result(timeout=20)
    with pytest.raises(InventoryConflictError) as depleted:
        operations[loser]()
    assert depleted.value.blocked_by[0]["reason"] == (
        "transfer_insufficient_stock" if loser == "dispatch" else "supply_insufficient_stock"
    )
    assert OriginReleaseProof.objects.count() == (1 if first == "release" else 0)
    assert StockMovement.objects.filter(operation__source_kind="transfer_dispatch").count() == (
        1 if first == "dispatch" else 0
    )
    with inventory_transaction(organization=context.actor.organization):
        # Supply and transfer lines both use the same declared lot/unit identity.
        from inventory.transfers.models import TransferLine

        actual = TransferLine.objects.get(transfer_id=transfer_command.transfer_id)
        assert balance(actual, context.location) >= 0
        assert spendable_balance(actual, context.location) == 0


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", ["use", "return"])
def test_real_reviewed_use_and_signed_return_cannot_spend_same_custody(allocation, first):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from uuid import UUID, uuid4

    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import ReturnAcceptance, ReturnDeclaration, SupplyUse
    from inventory.exceptions import InventoryConflictError, InventoryInProgressError
    from inventory.models import StockMovement
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewItem
    from tests.sync_support import event
    from tests.test_inventory_transfers_106 import verified_upload
    from uploads.models import AttachmentLink, Upload

    context = allocation.context
    received, line_id = receive_capture(allocation)
    assert allocation.phone.sync([received]).data["results"][0]["status"] == "accepted"
    declaration_source = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 1,
            "used": [],
            "shrinkage": [],
            "returned": [
                {
                    "receipt_line_id": str(line_id),
                    "receipt_source_event_id": received["id"],
                    "quantity": "8",
                    "destination_id": str(context.location.pk),
                }
            ],
        },
    )
    assert allocation.phone.sync([declaration_source]).data["results"][0]["status"] == "accepted"
    source = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 2,
            "used": [
                {
                    "receipt_line_id": str(line_id),
                    "receipt_source_event_id": received["id"],
                    "quantity": "8",
                    "work_kind": "manual",
                    "manual_reason": "Actual synthetic complete use",
                    "transit_policy_id": str(allocation.policy.pk),
                    "transit_evidence_ids": [str(verified_upload(allocation.source_actor))],
                }
            ],
            "returned": [],
            "shrinkage": [],
        },
    )
    assert allocation.phone.sync([source]).data["results"][0]["status"] == "in_review"
    assert not SupplyUse.objects.exists()
    item = ReviewItem.objects.get(field_event_id=source["id"])
    signature = verified_upload(context.actor)
    intent = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "return_accept",
            "declaration_id": ReturnDeclaration.objects.get().pk,
            "expected_revision": 2,
            "quantity": "8",
            "evidence": [{"upload_id": signature, "role": "signature"}],
        },
    )
    intent_id = UUID(intent.body["intent"]["id"])
    AttachmentLink.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        upload=Upload.objects.get(public_id=signature),
        inventory_intent_id=intent_id,
    )
    command = IntentExecution(
        intent_id,
        "return_accept",
        ReturnDeclaration.objects.get().event.assignment.reconciliation.pk,
    )
    operations = {
        "use": lambda: decide_review(
            context.actor,
            item.pk,
            ReviewDecisionRequest("accept", 0, "Verified real full transit use"),
        ),
        "return": lambda: execute_inventory_intent(context.actor, command),
    }
    loser = "return" if first == "use" else "use"
    holding, release = Event(), Event()
    from field_sync.exceptions import SyncInProgressError

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(held_supply_operation, operations[first], holding, release)
        try:
            if not holding.wait(10):
                if future.done():
                    future.result()  # Preserve the actual winning-service failure as the cause.
                pytest.fail("The real service did not reach its retained-transaction barrier")
            with pytest.raises((InventoryInProgressError, SyncInProgressError)):
                operations[loser]()
        finally:
            release.set()
        future.result(timeout=20)
    with pytest.raises((InventoryConflictError, ReviewBlockedError)):
        operations[loser]()
    assert SupplyUse.objects.count() == (1 if first == "use" else 0)
    assert ReturnAcceptance.objects.count() == (1 if first == "return" else 0)
    assert (
        sum(
            StockMovement.objects.filter(assignment_id=allocation.assignment_id).values_list(
                "quantity", flat=True
            )
        )
        == 0
    )


@pytest.mark.django_db
@pytest.mark.parametrize("reviewed", [False, True])
def test_actual_close_keeps_unexplained_custody_and_reviewed_close_has_no_new_frame(
    allocation, reviewed
):
    from field_sync.models import CourierChange
    from inventory.allocations.models import ReconciliationVersion, SupplyDiscrepancy
    from inventory.models import StockMovement
    from shifts.models import Shift
    from tests.shift_support import close_event

    capture, _ = receive_capture(allocation)
    assert allocation.phone.sync([capture]).data["results"][0]["status"] == "accepted"
    before = ReconciliationVersion.objects.count()
    movements = list(StockMovement.objects.order_by("pk").values_list("pk", "quantity"))
    close = close_event(allocation.shift_id, odometer_km=11_999 if reviewed else 12_050)
    result = allocation.phone.sync([close]).data["results"][0]
    assert result["status"] == ("in_review" if reviewed else "accepted")
    shift = Shift.objects.get(pk=allocation.shift_id)
    assert shift.status == ("open" if reviewed else "closed")
    assert ReconciliationVersion.objects.count() == before + (0 if reviewed else 1)
    assert list(StockMovement.objects.order_by("pk").values_list("pk", "quantity")) == movements
    assert SupplyDiscrepancy.objects.count() == 1
    if not reviewed:
        frame = ReconciliationVersion.objects.get(close_source_uuid=close["id"])
        assert (frame.lines.get().difference, frame.lines.get().delivery_variance) == (
            Decimal(8),
            Decimal(2),
        )
        latest = CourierChange.objects.filter(
            courier=allocation.phone.user,
            kind="supplies",
            resource_id=str(allocation.assignment_id),
        ).latest("sequence")
        assert latest.payload["reconciliation"]["revision"] == frame.revision
    assert allocation.phone.sync([close]).data["results"][0] == result
    assert ReconciliationVersion.objects.count() == before + (0 if reviewed else 1)


@pytest.mark.django_db
@pytest.mark.parametrize(("quantity", "changed"), [("0", False), ("8", True)])
def test_signed_zero_and_changed_plan_keep_actual_source_without_invented_credit(
    allocation, quantity, changed
):
    from uuid import uuid4

    from field_sync.models import FieldEvent
    from inventory.allocations.commands import AssignmentWrite
    from inventory.allocations.models import SupplyAssignment, SupplyReceipt
    from inventory.allocations.services import write_assignment
    from inventory.models import StockOperation
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewItem

    capture, _ = receive_capture(allocation, quantity)
    if changed:
        assignment = SupplyAssignment.objects.get(pk=allocation.assignment_id)
        write_assignment(
            AssignmentWrite(
                allocation.context.actor,
                {
                    "command_id": uuid4(),
                    "courier_id": assignment.courier_id,
                    "origin_id": assignment.origin_id,
                    "date": assignment.date,
                    "shift_id": assignment.shift_id,
                    "expected_revision": 1,
                    "lines": [
                        {
                            "id": uuid4(),
                            "lot_id": allocation.context.lot.pk,
                            "piece_id": None,
                            "unit_version_id": allocation.context.supply_version.pk,
                            "quantity": Decimal(10),
                        }
                    ],
                },
                assignment.pk,
            )
        )
    response = allocation.phone.sync([capture]).data["results"][0]
    assert response["status"] == ("in_review" if changed else "accepted")
    if changed:
        assert response["code"] == "supply_assignment_changed"
        assert not SupplyReceipt.objects.exists()
        assert StockOperation.objects.count() == 1
        item = ReviewItem.objects.get(field_event_id=capture["id"])
        decide_review(
            allocation.context.actor,
            item.pk,
            ReviewDecisionRequest("accept", 0, "Accept exact original signed observation"),
        )
    receipt = SupplyReceipt.objects.get()
    assert receipt.release_id == allocation.release_id
    assert receipt.lines.get().quantity == Decimal(quantity)
    assert allocation.phone.sync([capture]).data["results"][0] == response
    assert SupplyReceipt.objects.count() == 1
    assert FieldEvent.objects.get(pk=capture["id"]).status == response["status"]
    assert StockOperation.objects.count() == (2 if changed else 1)


@pytest.mark.django_db
@pytest.mark.parametrize("custody", [True], indirect=True)
def test_real_biological_lot_write_off_requires_bound_rpbi_and_never_exceeds_stock(
    custody, void_catalog
):
    from uuid import UUID, uuid4

    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import LotWriteOff
    from inventory.exceptions import InventoryConflictError
    from inventory.models import StockMovement
    from tests.inventory_support import AT
    from tests.test_inventory_transfers_106 import verified_upload
    from uploads.models import AttachmentLink, Upload

    context, _ = custody
    context.profile.permission_codes.append("inventory.write_off")
    context.profile.save(update_fields=["permission_codes"])
    values = {
        "command_id": uuid4(),
        "kind": "lot_write_off",
        "lot_id": context.lot.pk,
        "location_id": context.location.pk,
        "piece_id": None,
        "unit_version_id": context.supply_version.pk,
        "quantity": Decimal(6),
        "expected_revision": 1,
        "owner_id": context.actor.user.pk,
        "date": AT.date(),
        "reason_code": "other",
        "reason": "Synthetic biological disposal audit",
        "evidence": [],
    }
    over = prepare_inventory_intent(context.actor, values)
    with pytest.raises(InventoryConflictError) as excessive:
        execute_inventory_intent(
            context.actor, IntentExecution(UUID(over.body["intent"]["id"]), "lot_write_off")
        )
    assert excessive.value.blocked_by[0]["reason"] == "supply_insufficient_stock"
    missing = prepare_inventory_intent(
        context.actor, {**values, "command_id": uuid4(), "quantity": Decimal(1)}
    )
    with pytest.raises(InventoryConflictError) as absent:
        execute_inventory_intent(
            context.actor, IntentExecution(UUID(missing.body["intent"]["id"]), "lot_write_off")
        )
    assert absent.value.blocked_by[0]["reason"] == "supply_evidence_required"
    identifier = verified_upload(context.actor)
    prepared = prepare_inventory_intent(
        context.actor,
        {
            **values,
            "command_id": uuid4(),
            "quantity": Decimal(1),
            "evidence": [{"upload_id": identifier, "role": "rpbi"}],
        },
    )
    intent_id = UUID(prepared.body["intent"]["id"])
    command = IntentExecution(intent_id, "lot_write_off")
    with pytest.raises(InventoryConflictError) as unbound:
        execute_inventory_intent(context.actor, command)
    assert unbound.value.blocked_by[0]["reason"] == "supply_evidence_required"
    assert not LotWriteOff.objects.exists()
    assert StockMovement.objects.count() == 1
    AttachmentLink.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        upload=Upload.objects.get(public_id=identifier),
        inventory_intent_id=intent_id,
    )
    written = execute_inventory_intent(context.actor, command)
    assert execute_inventory_intent(context.actor, command).body == written.body
    assert LotWriteOff.objects.get().quantity == 1
    assert StockMovement.objects.count() == 2
    assert (
        sum(
            StockMovement.objects.filter(location=context.location).values_list(
                "quantity", flat=True
            )
        )
        == 4
    )


@pytest.mark.django_db
def test_actual_receipt_and_reconciliation_preserve_exact_custody_and_replay(
    allocation, void_catalog
):
    from uuid import UUID, uuid4

    from field_sync.models import FieldEvent
    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import ReconciliationVersion, ReturnDeclaration, SupplyEvent
    from inventory.models import StockMovement
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewItem
    from tests.sync_support import event
    from tests.test_inventory_transfers_106 import verified_upload
    from uploads.models import AttachmentLink, Upload

    context = allocation.context
    received, line_id = receive_capture(allocation)
    assert allocation.phone.sync([received]).data["results"][0]["status"] == "accepted"
    assert allocation.phone.sync([received]).data["results"][0]["status"] == "accepted"
    policy = allocation.policy
    reconciled = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 1,
            "used": [
                {
                    "receipt_line_id": str(line_id),
                    "receipt_source_event_id": received["id"],
                    "quantity": "5",
                    "work_kind": "manual",
                    "manual_reason": "Actual synthetic usage recorded",
                    "transit_policy_id": str(policy.pk),
                    "transit_evidence_ids": [str(verified_upload(allocation.source_actor))],
                }
            ],
            "returned": [
                {
                    "receipt_line_id": str(line_id),
                    "receipt_source_event_id": received["id"],
                    "destination_id": str(context.location.pk),
                    "quantity": "2",
                }
            ],
            "shrinkage": [],
        },
    )
    assert allocation.phone.sync([reconciled]).data["results"][0]["status"] == "in_review"
    assert not ReturnDeclaration.objects.exists()  # NEW review has zero operational effects.
    item = ReviewItem.objects.get(field_event_id=reconciled["id"])
    decide_review(
        context.actor,
        item.pk,
        ReviewDecisionRequest("accept", 0, "Verified real transit evidence", ()),
    )
    declaration = ReturnDeclaration.objects.get()
    frame = ReconciliationVersion.objects.filter(
        reconciliation__assignment_id=allocation.assignment_id
    ).first()
    assert (frame.lines.get().difference, frame.lines.get().returned) == (Decimal(3), Decimal(0))
    signature_id = verified_upload(context.actor)
    prepared = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "return_accept",
            "declaration_id": declaration.pk,
            "expected_revision": frame.revision,
            "quantity": Decimal(2),
            "evidence": [{"upload_id": signature_id, "role": "signature"}],
        },
    )
    intent_id = UUID(prepared.body["intent"]["id"])
    AttachmentLink.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        upload=Upload.objects.get(public_id=signature_id),
        inventory_intent_id=intent_id,
    )
    target_id = declaration.event.assignment.reconciliation.pk
    command = IntentExecution(intent_id, "return_accept", target_id)
    accepted = execute_inventory_intent(context.actor, command)
    assert execute_inventory_intent(context.actor, command).body == accepted.body
    assert allocation.phone.sync([reconciled]).data["results"][0]["status"] == "in_review"
    final = (
        ReconciliationVersion.objects.filter(reconciliation__assignment_id=allocation.assignment_id)
        .first()
        .lines.get()
    )
    assert (
        final.planned,
        final.credited,
        final.used,
        final.returned,
        final.shrinkage,
        final.difference,
        final.delivery_variance,
    ) == tuple(map(Decimal, (10, 8, 5, 2, 0, 1, 2)))
    assert SupplyEvent.objects.count() == 2
    assert FieldEvent.objects.get(pk=reconciled["id"]).status == "in_review"
    assert StockMovement.objects.filter(assignment_id=allocation.assignment_id).count() == 3
    from inventory.allocations.models import SupplyDiscrepancy, SupplyDiscrepancyDecision

    discrepancy = SupplyDiscrepancy.objects.get()
    justification = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "reconcile_justify",
            "reconciliation_id": discrepancy.reconciliation_id,
            "discrepancy_id": discrepancy.pk,
            "expected_revision": 3,
            "reason_code": "other",
            "reason": "Verified unexplained difference without invented stock",
            "evidence": [],
        },
    )
    justification_command = IntentExecution(
        UUID(justification.body["intent"]["id"]), "reconcile_justify", discrepancy.reconciliation_id
    )
    explained = execute_inventory_intent(context.actor, justification_command)
    assert execute_inventory_intent(context.actor, justification_command).body == explained.body
    assert SupplyDiscrepancyDecision.objects.count() == 1
    assert StockMovement.objects.filter(assignment_id=allocation.assignment_id).count() == 3
    bootstrap_before = allocation.phone.client.get("/api/v1/field/bootstrap/")
    assert bootstrap_before.status_code == 200
    assert [row["id"] for row in bootstrap_before.data["supplies"]] == [
        str(allocation.assignment_id)
    ]
    blocked_void = event(
        type="record.void",
        voids_event_id=reconciled["id"],
        shift_id=str(allocation.shift_id),
        payload={"reason_code": "other", "reason": "Retain genuinely consumed physical material"},
    )
    blocked_result = allocation.phone.sync([blocked_void]).data["results"][0]
    assert (blocked_result["status"], blocked_result["code"]) == ("rejected", "supply_void_blocked")
    assert FieldEvent.objects.get(pk=reconciled["id"]).voided_at is None
    from django.db import connection
    from django.test.utils import CaptureQueriesContext
    from rest_framework.test import APIClient

    from inventory.allocations.permissions import ADMIN_CODES

    reader = APIClient()
    reader.force_login(context.actor.user)
    url = f"/api/v1/locations/{context.location.pk}/movements/"
    with CaptureQueriesContext(connection) as all_rows:
        visible = reader.get(url, {"lot": str(context.lot.pk)})
    assert visible.status_code == 200
    typed = [row for row in visible.data["results"] if row["source_kind"] == "supply_receive"]
    assert len(typed) == 1
    assert typed[0]["source_supply"]["assignment_id"] == str(allocation.assignment_id)
    assert typed[0]["source_supply"]["source_event_id"] == received["id"]
    assert typed[0]["source_transfer"] is None
    return_leg = StockMovement.objects.get(
        operation__source_kind="supply_return", location=context.location
    )
    with CaptureQueriesContext(connection) as one_row:
        single = reader.get(url, {"operation": str(return_leg.operation_id)})
    assert single.status_code == 200
    assert len(single.data["results"]) == 1
    assert single.data["results"][0]["source_supply"]["kind"] == "supply_return"
    # Each request has one equivalent scoped relation lookup; source rows add no ORM queries.
    assert len(all_rows) == len(one_row)
    original = typed[0]
    context.profile.permission_codes = [
        code for code in context.profile.permission_codes if code not in ADMIN_CODES
    ]
    context.profile.save(update_fields=["permission_codes"])
    opaque = reader.get(url)
    assert (
        opaque.status_code == 200
    )  # Existing Location/lot read survives, supply authority does not.
    retained = next(row for row in opaque.data["results"] if row["id"] == original["id"])
    assert retained["source_supply"] is None
    assert retained["source_transfer"] is original["source_transfer"] is None
    assert (retained["source_kind"], retained["source_id"]) == (
        original["source_kind"],
        original["source_id"],
    )
    denied_replay = allocation.phone.sync([received]).data["results"][0]
    assert (denied_replay["status"], denied_replay["code"]) == ("rejected", "supply_inaccessible")
    assert FieldEvent.objects.get(pk=received["id"]).status == "accepted"
    assert SupplyEvent.objects.count() == 2
    bootstrap_after = allocation.phone.client.get("/api/v1/field/bootstrap/")
    assert bootstrap_after.status_code == 200
    assert bootstrap_after.data["supplies"] == []
    assert (
        bootstrap_after.data["capture_context"]["scope_revision"]
        != bootstrap_before.data["capture_context"]["scope_revision"]
    )
    assert allocation.phone.sync([]).data["changes"]["supplies"] == []


def test_equation_separates_signed_custody_from_plan_and_unaccepted_return():
    from inventory.allocations.policy import QuantityFrame, reconciliation_equation

    declared = QuantityFrame(planned=Decimal(10), credited=Decimal(8), used=Decimal(5))
    pending = reconciliation_equation(declared)
    accepted = reconciliation_equation(
        QuantityFrame(
            planned=Decimal(10),
            credited=Decimal(8),
            used=Decimal(5),
            returned=Decimal(2),
        )
    )

    assert (pending.remaining, pending.delivery_variance) == (Decimal(3), Decimal(2))
    assert (accepted.remaining, accepted.delivery_variance) == (Decimal(1), Decimal(2))


@pytest.mark.parametrize(
    ("credited", "remaining", "variance"),
    [(None, None, None), (Decimal(0), Decimal(0), Decimal(10))],
)
def test_missing_receipt_is_distinct_from_an_actual_signed_zero(credited, remaining, variance):
    from inventory.allocations.policy import QuantityFrame, reconciliation_equation

    equation = reconciliation_equation(QuantityFrame(planned=Decimal(10), credited=credited))

    assert (equation.remaining, equation.delivery_variance) == (remaining, variance)


def test_observed_overuse_cannot_become_a_negative_custody_posting():
    from inventory.allocations.policy import (
        QuantityFrame,
        SupplyPolicyError,
        reconciliation_equation,
    )

    with pytest.raises(SupplyPolicyError, match="supply_insufficient_custody"):
        reconciliation_equation(
            QuantityFrame(planned=Decimal(10), credited=Decimal(8), used=Decimal(9))
        )


def test_lab_replacement_preserves_legacy_command_shape_and_closes_measurement_kind():
    from lab.commands import canonical_values
    from lab.serializers import LabReplacementSerializer

    original = LabReplacementSerializer(data={"kind": "count", "value": 0})
    explicit = LabReplacementSerializer(
        data={"kind": "count", "value": 0, "measurement_kind": "physical_measurement"}
    )
    corrected = LabReplacementSerializer(
        data={"kind": "count", "value": 0, "measurement_kind": "data_correction"}
    )
    assert original.is_valid(), original.errors
    assert explicit.is_valid(), explicit.errors
    assert corrected.is_valid(), corrected.errors
    assert canonical_values(original.validated_data) == canonical_values(explicit.validated_data)
    assert "measurement_kind" not in original.validated_data
    assert corrected.validated_data["measurement_kind"] == "data_correction"
    invalid = LabReplacementSerializer(data={"kind": "count", "value": 0, "measurement_kind": None})
    assert not invalid.is_valid()


def test_supply_note_floor_survives_a_lower_global_minimum_without_changing_shared_policy(settings):
    from rest_framework.exceptions import ValidationError

    from core.void_reason import validate_void_reason
    from inventory.allocations.policy import validate_supply_note

    settings.VOID_REASON_MIN_LENGTH = 1
    short = "abcdefghi" + "\u200b" * 20
    assert validate_void_reason(short) == short
    with pytest.raises(ValidationError) as denied:
        validate_supply_note(short)
    assert denied.value.get_codes() == {"reason": ["void_reason_too_short"]}
    assert validate_supply_note(" \r\ne\u0301abcdefghI ") == "éabcdefghI"


@pytest.mark.django_db
def test_source_void_compensates_real_custody_once_and_retains_declared_dependents(
    allocation, void_catalog
):
    from uuid import uuid4

    from field_sync.models import FieldEvent
    from inventory.allocations.models import SupplyReceiptLine, SupplyVoidAudit
    from inventory.allocations.stock import assignment_balance, release_reservations
    from inventory.models import StockMovement
    from inventory.transfers.custody import balance
    from tests.sync_support import event

    first, _ = receive_capture(allocation)
    assert allocation.phone.sync([first]).data["results"][0]["status"] == "accepted"
    line = SupplyReceiptLine.objects.get(receipt__event__declared_source_uuid=first["id"])
    original = FieldEvent.objects.filter(pk=first["id"]).values().get()
    too_short = event(
        type="record.void",
        voids_event_id=first["id"],
        payload={"reason_code": "data-entry-error", "reason": "abcdefghi"},
    )
    rejected = allocation.phone.sync([too_short]).data["results"][0]
    assert (rejected["status"], rejected["code"]) == ("rejected", "invalid_payload")
    assert FieldEvent.objects.filter(pk=first["id"]).values().get() == original
    correction = event(
        type="record.void",
        voids_event_id=first["id"],
        payload={
            "reason_code": "other",
            "reason": "Return exact unused custody to its actual source",
        },
    )
    assert allocation.phone.sync([correction]).data["results"][0]["status"] == "accepted"
    leg_count = StockMovement.objects.count()
    assert allocation.phone.sync([correction]).data["results"][0]["status"] == "accepted"
    assert StockMovement.objects.count() == leg_count
    assert SupplyVoidAudit.objects.count() == 1
    assert assignment_balance(line) == 0
    source_line = line.release_line.line
    assert balance(source_line, allocation.context.location) == Decimal(10)
    assert release_reservations(source_line, allocation.context.location) == Decimal(10)
    retained = FieldEvent.objects.filter(pk=first["id"]).values().get()
    for key in (
        "status",
        "status_code",
        "payload",
        "payload_sha256",
        "device_time",
        "server_received_at",
        "rules_version",
        "catalog_version",
    ):
        assert retained[key] == original[key]
    next_receipt, next_line = receive_capture(allocation, "6")
    next_receipt["payload"]["expected_revision"] = 2
    assert allocation.phone.sync([next_receipt]).data["results"][0]["status"] == "accepted"
    declared = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 3,
            "used": [],
            "shrinkage": [],
            "returned": [
                {
                    "receipt_line_id": str(next_line),
                    "receipt_source_event_id": next_receipt["id"],
                    "destination_id": str(allocation.context.location.pk),
                    "quantity": "2",
                }
            ],
        },
    )
    assert allocation.phone.sync([declared]).data["results"][0]["status"] == "accepted"
    blocked = event(
        type="record.void",
        voids_event_id=next_receipt["id"],
        payload={"reason_code": "other", "reason": "Retain the signed downstream declaration"},
    )
    result = allocation.phone.sync([blocked]).data["results"][0]
    assert (result["status"], result["code"]) == ("rejected", "supply_void_blocked")
    assert FieldEvent.objects.get(pk=next_receipt["id"]).voided_at is None
    discard_declaration = event(
        type="record.void",
        voids_event_id=declared["id"],
        payload={
            "reason_code": "other",
            "reason": "Correct the unapplied return declaration first",
        },
    )
    assert allocation.phone.sync([discard_declaration]).data["results"][0]["status"] == "accepted"
    released = event(
        type="record.void",
        voids_event_id=next_receipt["id"],
        payload={"reason_code": "other", "reason": "Compensate the intact remaining real custody"},
    )
    assert allocation.phone.sync([released]).data["results"][0]["status"] == "accepted"
    assert SupplyVoidAudit.objects.count() == 3
    assert balance(source_line, allocation.context.location) == Decimal(10)


@pytest.mark.django_db
def test_whole_bag_disposal_retains_lab_audit_and_only_proved_historical_correction(
    monkeypatch, make_member
):
    from dataclasses import replace
    from datetime import timedelta
    from uuid import UUID, uuid4
    from zoneinfo import ZoneInfo

    from field_sync.envelope import describe_payload
    from inventory.allocations.bag_dependencies import material_availability
    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import BagDisposition
    from inventory.exceptions import InventoryConflictError
    from lab.access import LabTarget
    from lab.commands import LabCommandInput, execute_lab_command
    from lab.models import (
        DailyRecountSampleMember,
        EggCountAttempt,
        LabCommand,
        LabResultRevision,
        RecountRequest,
    )
    from lab.recounts import ClosedDayInput, close_lab_day
    from tests.lab_support import (
        AT,
        actor_with_codes,
        capture_bag,
        count_input,
        lab_context,
        receive,
    )
    from tests.ovitrap_support import envelope, ingest
    from tests.test_inventory_transfers_106 import verified_upload
    from uploads.models import AttachmentLink, Upload

    context = lab_context(monkeypatch)
    context.actor = actor_with_codes(
        context,
        make_member,
        (
            "bag.receive",
            "egg_count.create",
            "egg_count.void",
            "lab_rejection.create",
            "field.upload",
            "bag.dispose",
        ),
    )
    legacy = {}
    bags = [
        capture_bag(context, "B10-DISPOSE-A"),
        capture_bag(context, "B10-DISPOSE-B", new_source=True),
    ]
    for bag in bags:
        receive(context, bag)
        initial = execute_lab_command(context.actor, count_input(context, bag, 0))
        old_id = UUID(initial.body["count"]["id"])
        correction = LabCommandInput(
            "void_count",
            LabTarget("count", old_id),
            uuid4(),
            {
                "expected_revision": 1,
                "reason_code": "other",
                "reason": "Synthetic historical entry correction",
                "replacement": {"kind": "count", "value": 0, "confirmed_implausible": False},
            },
        )
        corrected = execute_lab_command(context.actor, correction)
        assert corrected.status == 200
        legacy[bag.pk] = (correction, corrected)
    closed_now = AT + timedelta(days=1)
    monkeypatch.setattr("lab.recounts.server_now", lambda: closed_now)
    monkeypatch.setattr("django.utils.timezone.now", lambda: closed_now)
    day = AT.astimezone(ZoneInfo(context.actor.organization.timezone)).date()

    # A real count alone is not a closed-day draw assessment.
    before = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "bag_disposal",
            "bag_id": bags[0].pk,
            "owner_id": context.actor.user.pk,
            "date": day,
            "expected_revision": 2,
            "reason_code": "other",
            "reason": "Synthetic completed material disposal",
            "evidence": [],
        },
    )
    with pytest.raises(InventoryConflictError) as unavailable:
        execute_inventory_intent(
            context.actor, IntentExecution(UUID(before.body["intent"]["id"]), "bag_disposal")
        )
    assert unavailable.value.blocked_by[0]["reason"] == "lab_draw_unassessed"
    closed = close_lab_day(ClosedDayInput(context.actor.organization, day))
    assert (closed.population, closed.quota) == (2, 1)
    member = DailyRecountSampleMember.objects.select_related("count__bag").get(
        sample_id=closed.sample_id, selected=False
    )
    selected = DailyRecountSampleMember.objects.get(sample_id=closed.sample_id, selected=True)
    pending = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "bag_disposal",
            "bag_id": selected.count.bag_id,
            "owner_id": context.actor.user.pk,
            "date": day,
            "expected_revision": 2,
            "reason_code": "other",
            "reason": "Synthetic pending obligation blocks disposal",
            "evidence": [],
        },
    )
    with pytest.raises(InventoryConflictError) as pending_qa:
        execute_inventory_intent(
            context.actor, IntentExecution(UUID(pending.body["intent"]["id"]), "bag_disposal")
        )
    assert pending_qa.value.blocked_by[0]["reason"] == "lab_recount_pending"
    bag, predecessor = member.count.bag, member.count
    signature = verified_upload(context.actor)
    values = {
        "command_id": uuid4(),
        "kind": "bag_disposal",
        "bag_id": bag.pk,
        "owner_id": context.actor.user.pk,
        "date": day,
        "expected_revision": 2,
        "reason_code": "other",
        "reason": "Synthetic completed material disposal",
        "evidence": [{"upload_id": signature, "role": "rpbi"}],
    }
    prepared = prepare_inventory_intent(context.actor, values)
    intent_id = UUID(prepared.body["intent"]["id"])
    with pytest.raises(InventoryConflictError) as missing_evidence:
        execute_inventory_intent(context.actor, IntentExecution(intent_id, "bag_disposal"))
    assert missing_evidence.value.blocked_by[0]["reason"] == "supply_evidence_required"
    AttachmentLink.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        upload=Upload.objects.get(public_id=signature),
        inventory_intent_id=intent_id,
    )
    executed = execute_inventory_intent(context.actor, IntentExecution(intent_id, "bag_disposal"))
    assert (
        execute_inventory_intent(context.actor, IntentExecution(intent_id, "bag_disposal")).body
        == executed.body
    )
    disposition = BagDisposition.objects.get(bag=bag)
    preserved = BagDisposition.objects.filter(pk=disposition.pk).values().get()
    assert disposition.dependency_proof["count_id"] == str(predecessor.pk)
    assert material_availability(bag) == {
        "available": False,
        "disposition_id": str(disposition.pk),
        "reason": "bag_disposed",
    }
    assert RecountRequest.objects.filter(count=selected.count, supersession__isnull=True).exists()
    legacy_command, legacy_result = legacy[bag.pk]
    command_before = LabCommand.objects.filter(command_id=legacy_command.command_id).values().get()
    assert "measurement_kind" not in command_before["canonical_input"]["replacement"]
    replay = execute_lab_command(context.actor, legacy_command)
    assert replay.replayed
    assert replay.body == legacy_result.body
    assert (
        LabCommand.objects.filter(command_id=legacy_command.command_id).values().get()
        == command_before
    )
    _assert_disposed_count_raw_denials(context, predecessor, selected.count)

    physical = LabCommandInput(
        "void_count",
        LabTarget("count", predecessor.pk),
        uuid4(),
        {
            "expected_revision": 2,
            "reason_code": "other",
            "reason": "Synthetic correction preserves disposal",
            "replacement": {"kind": "count", "value": 0, "confirmed_implausible": False},
        },
    )
    blocked = execute_lab_command(context.actor, physical)
    assert (blocked.status, blocked.body["code"]) == (409, "bag_material_unavailable")
    metadata = replace(
        physical,
        command_id=uuid4(),
        values={
            **physical.values,
            "replacement": {
                **physical.values["replacement"],
                "measurement_kind": "data_correction",
            },
        },
    )
    corrected = execute_lab_command(context.actor, metadata)
    assert corrected.status == 200
    current = LabResultRevision.objects.get(bag=bag, revision=3)
    assert current.count.replacement_of_id == predecessor.pk
    assert current.count.source_proof["measurement_origin_id"] == str(predecessor.pk)
    assert current.count.source_proof["measurement_command_id"] == str(predecessor.command_id)
    assert BagDisposition.objects.filter(pk=disposition.pk).values().get() == preserved
    assert material_availability(bag)["available"] is False
    assert EggCountAttempt.objects.filter(pk=predecessor.pk).exists()
    cleared = execute_lab_command(
        context.actor,
        LabCommandInput(
            "void_count",
            LabTarget("count", current.count_id),
            uuid4(),
            {
                "expected_revision": 3,
                "reason_code": "other",
                "reason": "Synthetic audit correction without material",
            },
        ),
    )
    assert cleared.status == 200
    physical_count = execute_lab_command(
        context.actor,
        replace(
            count_input(context, bag, 0),
            values={
                "expected_revision": 4,
                "value": 0,
                "confirmed_implausible": False,
            },
        ),
    )
    assert (physical_count.status, physical_count.body["code"]) == (409, "bag_material_unavailable")
    rejection = execute_lab_command(
        context.actor,
        LabCommandInput(
            "reject",
            LabTarget("bag", bag.pk),
            uuid4(),
            {
                "expected_revision": 4,
                "method_version": uuid4(),
                "reason": "Synthetic unavailable material rejection",
                "evidence_ids": [],
            },
        ),
    )
    assert (rejection.status, rejection.body["code"]) == (409, "bag_material_unavailable")
    void_payload = {
        "reason_code": "other",
        "reason": "Synthetic source must retain disposed material",
    }
    original = type(bag.event).objects.filter(pk=bag.event_id).values().get()
    void = replace(
        envelope(context.field),
        type="record.void",
        payload=void_payload,
        payload_info=describe_payload(void_payload),
        voids_event_id=bag.event_id,
    )
    result = ingest(context.field, void)
    assert (result.status, result.code) == ("rejected", "ovitrap_void_blocked")
    assert type(bag.event).objects.filter(pk=bag.event_id).values().get() == original
    assert BagDisposition.objects.filter(pk=disposition.pk).values().get() == preserved


def _assert_disposed_count_raw_denials(context, predecessor, other):
    import json
    from uuid import uuid4

    from django.db import DatabaseError, connection, transaction

    from lab.models import LabCommand

    for flag, parent in (
        ({}, predecessor),
        ({"measurement_kind": None}, predecessor),
        ({"measurement_kind": []}, predecessor),
        ({"measurement_kind": "data_correction"}, None),
        ({"measurement_kind": "data_correction"}, other),
    ):
        with (  # noqa: PT012 -- real command and raw insert share the failed savepoint.
            pytest.raises(
                DatabaseError, match="Disposed Bag permits only proved historical correction"
            ),
            transaction.atomic(),
        ):
            command = LabCommand.objects.create(
                organization=context.actor.organization,
                created_by=context.actor.user,
                command_id=uuid4(),
                action="void_count",
                target_id=predecessor.pk,
                source_id=predecessor.bag.event_id,
                input_hash="a" * 64,
                canonical_input={
                    "expected_revision": 2,
                    "replacement": {
                        "kind": "count",
                        "value": 0,
                        "confirmed_implausible": False,
                        **flag,
                    },
                    "reason_code": "other",
                    "reason": "Synthetic raw historical correction",
                },
            )
            proof = {
                **predecessor.source_proof,
                **flag,
                "measurement_origin_id": str(predecessor.pk),
                "measurement_command_id": str(predecessor.command_id),
                "material_available": False,
            }
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO lab_eggcountattempt(id,created_at,created_by_id,organization_id,command_id,receipt_id,bag_id,ordinal,value,viable_eggs,total_examined,viability_percent,method_version_id,verification_id,rules,source_proof,replacement_of_id) "
                    "SELECT %s,now(),created_by_id,organization_id,%s,receipt_id,bag_id,ordinal+1,value,viable_eggs,total_examined,viability_percent,method_version_id,verification_id,rules,%s::jsonb,%s FROM lab_eggcountattempt WHERE id=%s",
                    [
                        uuid4(),
                        command.pk,
                        json.dumps(proof),
                        None if parent is None else parent.pk,
                        predecessor.pk,
                    ],
                )


@pytest.mark.django_db
def test_real_release_reserves_once_without_rewriting_physical_location_balance(org_a, make_member):
    from uuid import UUID, uuid4

    from inventory.allocations.commands import AssignmentWrite, IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import SupplyAssignmentLine
    from inventory.allocations.permissions import OPERATOR_CODES
    from inventory.allocations.services import write_assignment
    from inventory.allocations.stock import spendable_balance
    from inventory.models import StockOperation
    from inventory.transactions import inventory_transaction
    from inventory.transfers.custody import balance
    from tests.inventory_support import AT, inventory_context

    context = inventory_context(org_a, make_member, quantity="10")
    context.profile.permission_codes = [
        *context.profile.permission_codes,
        *OPERATOR_CODES,
        "field_event.sync",
    ]
    context.profile.save(update_fields=["permission_codes"])
    line_id = uuid4()
    written = write_assignment(
        AssignmentWrite(
            context.actor,
            {
                "command_id": uuid4(),
                "courier_id": context.actor.user.pk,
                "origin_id": context.location.pk,
                "date": AT.date(),
                "shift_id": None,
                "lines": [
                    {
                        "id": line_id,
                        "lot_id": context.lot.pk,
                        "piece_id": None,
                        "unit_version_id": context.supply_version.pk,
                        "quantity": Decimal(10),
                    }
                ],
            },
        )
    )
    assignment_id = UUID(written.body["assignment"]["id"])
    prepared = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "assignment_release",
            "assignment_id": assignment_id,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    line = SupplyAssignmentLine.objects.get(pk=line_id)
    with inventory_transaction(organization=org_a):
        assert spendable_balance(line, context.location) == Decimal(10)
    request = IntentExecution(
        UUID(prepared.body["intent"]["id"]), "assignment_release", assignment_id
    )
    released = execute_inventory_intent(context.actor, request)
    replayed = execute_inventory_intent(context.actor, request)

    assert released.status == 201
    assert replayed.replayed is True
    assert replayed.body == released.body
    assert (
        StockOperation.objects.count() == 1
    )  # The original real admission; release is a reservation.
    with inventory_transaction(organization=org_a):
        assert balance(line, context.location) == Decimal(10)
        assert spendable_balance(line, context.location) == Decimal(0)
    from django.http import Http404

    context.profile.permission_codes = [
        code for code in context.profile.permission_codes if code != "inventory.allocate"
    ]
    context.profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        execute_inventory_intent(context.actor, request)
    assert StockOperation.objects.count() == 1


@pytest.mark.django_db
def test_assignment_http_requires_current_action_and_one_paired_binding_without_foreign_disclosure(
    org_a, org_b, make_member
):
    from uuid import uuid4

    from rest_framework.test import APIClient

    from geography.models import Quadrant
    from inventory.allocations.models import SupplyAssignment
    from organizations.models import Center, all_scope
    from tests.factories import ProfileFactory
    from tests.inventory_support import AT, allow_all, inventory_context

    author, _ = make_member(org_a, ())
    center = Center.objects.create(
        organization=org_a, created_by=author, code="SUPPLY-C", name="Synthetic supply center"
    )
    quadrant = Quadrant.objects.create(
        organization=org_a, created_by=author, center=center, code="SUPPLY-Q"
    )
    other_center = Center.objects.create(
        organization=org_a, created_by=author, code="OTHER-C", name="Synthetic other center"
    )
    other_quadrant = Quadrant.objects.create(
        organization=org_a, created_by=author, center=other_center, code="OTHER-Q"
    )
    stock = inventory_context(org_a, make_member, quadrant=quadrant)
    foreign = inventory_context(org_b, make_member)
    courier, courier_membership = make_member(org_a, ("field_event.sync",))
    allow_all(courier_membership)
    actor, member = make_member(org_a, ())
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    client = APIClient()
    client.force_login(actor)
    url = "/api/v1/courier-assignments/"
    payload = {
        "command_id": str(uuid4()),
        "courier_id": str(courier.pk),
        "origin_id": str(stock.location.pk),
        "date": AT.date().isoformat(),
        "lines": [
            {
                "id": str(uuid4()),
                "lot_id": str(stock.lot.pk),
                "piece_id": None,
                "unit_version_id": str(stock.supply_version.pk),
                "quantity": "1",
            }
        ],
    }
    assert client.post(url, payload, format="json").status_code == 403
    profile.permission_codes = ["inventory.allocate"]
    profile.save(update_fields=["permission_codes"])
    for location_center, applicable_quadrant in (
        (other_center, other_quadrant),
        (center, other_quadrant),
    ):
        profile.scope = {
            "centers": {"mode": "selected", "ids": [str(location_center.pk)]},
            "quadrants": {"mode": "selected", "ids": [str(applicable_quadrant.pk)]},
        }
        profile.save(update_fields=["scope"])
        assert client.post(url, payload, format="json").status_code == 404
    split = ProfileFactory(
        organization=org_a,
        permission_codes=["inventory.allocate"],
        scope={
            "centers": {"mode": "selected", "ids": [str(other_center.pk)]},
            "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]},
        },
    )
    member.profiles.add(split)
    assert client.post(url, payload, format="json").status_code == 404
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    foreign_result = client.post(
        url, {**payload, "origin_id": str(foreign.location.pk)}, format="json"
    )
    unknown_result = client.post(url, {**payload, "origin_id": str(uuid4())}, format="json")
    assert foreign_result.status_code == unknown_result.status_code == 404
    assert foreign_result.data == unknown_result.data
    assert not SupplyAssignment.objects.exists()
    csrf = APIClient(enforce_csrf_checks=True)
    csrf.force_login(actor)
    assert csrf.post(url, payload, format="json").status_code == 403
    assert not SupplyAssignment.objects.exists()
    accepted = client.post(url, payload, format="json")
    assert accepted.status_code == 201
    assert accepted.data["assignment"]["courier_id"] == str(courier.pk)
    assert SupplyAssignment.objects.count() == 1


@pytest.mark.django_db
def test_release_refreshes_distinct_courier_before_new_effect_and_saved_result(
    org_a, make_member, void_catalog
):
    from uuid import UUID, uuid4

    from django.http import Http404

    from inventory.allocations.commands import AssignmentWrite, IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import (
        OriginReleaseProof,
        ReleaseCancellation,
        SupplyAssignmentVersion,
    )
    from inventory.allocations.permissions import ALLOCATE
    from inventory.allocations.services import write_assignment
    from tests.inventory_support import AT, allow_all, inventory_context

    context = inventory_context(org_a, make_member)
    context.profile.permission_codes = [*context.profile.permission_codes, ALLOCATE]
    context.profile.save(update_fields=["permission_codes"])
    courier, membership = make_member(org_a, ("field_event.sync",))
    allow_all(membership)
    written = write_assignment(
        AssignmentWrite(
            context.actor,
            {
                "command_id": uuid4(),
                "courier_id": courier.pk,
                "origin_id": context.location.pk,
                "date": AT.date(),
                "shift_id": None,
                "lines": [
                    {
                        "id": uuid4(),
                        "lot_id": context.lot.pk,
                        "piece_id": None,
                        "unit_version_id": context.supply_version.pk,
                        "quantity": Decimal(1),
                    }
                ],
            },
        )
    )
    identifier = UUID(written.body["assignment"]["id"])
    prepared = [
        prepare_inventory_intent(
            context.actor,
            {
                "command_id": uuid4(),
                "kind": "assignment_release",
                "assignment_id": identifier,
                "expected_revision": 1,
                "evidence": [],
            },
        )
        for _ in range(2)
    ]
    commands = [
        IntentExecution(UUID(row.body["intent"]["id"]), "assignment_release", identifier)
        for row in prepared
    ]
    first = execute_inventory_intent(context.actor, commands[0])
    membership.is_active = False
    membership.save(update_fields=["is_active"])
    for command in commands:
        with pytest.raises(Http404):
            execute_inventory_intent(context.actor, command)
    with pytest.raises(Http404):
        prepare_inventory_intent(
            context.actor,
            {
                "command_id": uuid4(),
                "kind": "assignment_release",
                "assignment_id": identifier,
                "expected_revision": 1,
                "evidence": [],
            },
        )
    # Cancellation is a distinct warehouse action; revoked field authority must not strand it.
    cancel = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "release_cancel",
            "release_id": UUID(first.body["release"]["id"]),
            "expected_revision": 1,
            "evidence": [],
            "reason_code": "other",
            "reason": "Courier eligibility withdrawn before collection",
        },
    )
    assert (
        execute_inventory_intent(
            context.actor,
            IntentExecution(UUID(cancel.body["intent"]["id"]), "release_cancel", identifier),
        ).status
        == 201
    )
    assert OriginReleaseProof.objects.count() == SupplyAssignmentVersion.objects.count() == 1
    assert ReleaseCancellation.objects.count() == 1


@pytest.mark.django_db
def test_empty_suggestion_requires_real_shared_center_authority_without_quadrant_requirement(
    org_a, make_member
):
    from django.http import Http404

    from inventory.allocations.suggestions import material_suggestion
    from organizations.models import all_scope
    from organizations.scope import deny_scope
    from tests.inventory_support import AT, inventory_context

    context = inventory_context(org_a, make_member)
    context.profile.permission_codes = [
        *context.profile.permission_codes,
        "inventory.allocate",
        "field_event.sync",
    ]
    context.profile.scope = {
        "centers": {"mode": "selected", "ids": [str(context.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    context.profile.save(update_fields=["permission_codes", "scope"])
    context.member.scope = all_scope()
    context.member.save(update_fields=["scope"])
    assert material_suggestion(context.actor, AT.date())["lines"] == []
    context.profile.scope = deny_scope()
    context.profile.save(update_fields=["scope"])
    with pytest.raises(Http404):
        material_suggestion(context.actor, AT.date())


@pytest.mark.django_db
def test_plan_command_identity_binds_creation_mode_and_original_target(allocation):
    from uuid import uuid4

    from inventory.allocations.commands import AssignmentWrite
    from inventory.allocations.models import (
        SupplyAssignment,
        SupplyAssignmentCommandReceipt,
        SupplyAssignmentVersion,
    )
    from inventory.allocations.services import write_assignment
    from inventory.exceptions import InventoryConflictError

    context = allocation.context
    original = SupplyAssignmentCommandReceipt.objects.get(
        version__assignment_id=allocation.assignment_id
    )
    line = original.version.lines.get()
    values = {
        "command_id": original.command_id,
        "courier_id": allocation.phone.user.pk,
        "origin_id": context.location.pk,
        "date": original.version.assignment.date,
        "shift_id": allocation.shift_id,
        "lines": [
            {
                "id": line.pk,
                "lot_id": line.lot_id,
                "piece_id": line.piece_id,
                "unit_version_id": line.unit_version_id,
                "quantity": line.quantity,
            }
        ],
    }
    assert write_assignment(AssignmentWrite(context.actor, values)).body == original.response
    with pytest.raises(InventoryConflictError):
        write_assignment(AssignmentWrite(context.actor, values, allocation.assignment_id))
    revised = {
        **values,
        "command_id": uuid4(),
        "expected_revision": 1,
        "lines": [{**values["lines"][0], "id": uuid4(), "quantity": Decimal(9)}],
    }
    updated = write_assignment(AssignmentWrite(context.actor, revised, allocation.assignment_id))
    assert (
        write_assignment(AssignmentWrite(context.actor, revised, allocation.assignment_id)).body
        == updated.body
    )
    for target in (None, uuid4()):
        with pytest.raises(InventoryConflictError):
            write_assignment(AssignmentWrite(context.actor, revised, target))
    assert SupplyAssignment.objects.count() == 1
    assert (
        SupplyAssignmentVersion.objects.count()
        == SupplyAssignmentCommandReceipt.objects.count()
        == 2
    )


@pytest.mark.django_db
@pytest.mark.parametrize("allocation", ["piece"], indirect=True)
def test_piece_deltas_are_indivisible_and_return_only_needs_no_upload_grant(
    allocation, void_catalog
):
    from uuid import uuid4

    from inventory.allocations.models import ReturnDeclaration, SupplyReceiptLine, SupplyShrinkage
    from inventory.allocations.reconciliation import receipt_remaining
    from inventory.models import StockMovement
    from tests.sync_support import event
    from tests.test_inventory_transfers_106 import verified_upload

    received, line_id = receive_capture(allocation, "1")
    assert allocation.phone.sync([received]).data["results"][0]["status"] == "accepted"
    base = {
        "assignment_id": str(allocation.assignment_id),
        "expected_revision": 1,
        "used": [],
        "returned": [],
    }

    def loss(quantity):
        return event(
            type="supplies.reconcile",
            shift_id=str(allocation.shift_id),
            payload={
                **base,
                "command_id": str(uuid4()),
                "shrinkage": [
                    {
                        "receipt_line_id": str(line_id),
                        "receipt_source_event_id": received["id"],
                        "quantity": quantity,
                        "reason_code": "other",
                        "reason": "Synthetic actual indivisible piece loss",
                        "evidence_ids": [str(verified_upload(allocation.source_actor))],
                    }
                ],
            },
        )

    fractional = loss("0.5")
    result = allocation.phone.sync([fractional]).data["results"][0]
    assert (result["status"], result["code"]) == ("in_review", "supply_state_conflict")
    assert not SupplyShrinkage.objects.exists()
    assert not StockMovement.objects.filter(
        assignment_id=allocation.assignment_id, quantity__lt=0
    ).exists()
    profile = allocation.context.profile
    profile.permission_codes = [code for code in profile.permission_codes if code != "field.upload"]
    profile.revision += 1
    profile.save(update_fields=["permission_codes", "revision"])
    from tests.review_support import audit_current_membership

    audit_current_membership(allocation.context.member)
    returned = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            **base,
            "command_id": str(uuid4()),
            "shrinkage": [],
            "returned": [
                {
                    "receipt_line_id": str(line_id),
                    "receipt_source_event_id": received["id"],
                    "destination_id": str(allocation.context.location.pk),
                    "quantity": "1",
                }
            ],
        },
    )
    assert allocation.phone.sync([returned]).data["results"][0]["status"] == "accepted"
    assert ReturnDeclaration.objects.get().quantity == Decimal(1)
    assert receipt_remaining(SupplyReceiptLine.objects.get(pk=line_id)) == Decimal(1)
    assert not StockMovement.objects.filter(
        assignment_id=allocation.assignment_id, quantity__lt=0
    ).exists()
    profile.permission_codes = [*profile.permission_codes, "field.upload"]
    profile.revision += 1
    profile.save(update_fields=["permission_codes", "revision"])
    audit_current_membership(allocation.context.member)
    whole = loss("1")
    whole["payload"]["expected_revision"] = 2
    assert allocation.phone.sync([whole]).data["results"][0]["status"] == "accepted"
    assert SupplyShrinkage.objects.get().quantity == Decimal(1)
    assert receipt_remaining(SupplyReceiptLine.objects.get(pk=line_id)) == Decimal(0)


@pytest.mark.django_db
def test_suggestion_uses_published_due_task_owner_rule_pins_and_authored_mapping(
    make_member, monkeypatch
):
    from django.http import Http404

    from inventory.allocations.commands import ConfigurationWrite
    from inventory.allocations.models import SupplyAssignment
    from inventory.allocations.suggestions import material_suggestion
    from inventory.allocations.transit import publish_transit_configuration
    from scheduling.models import ScheduledTask
    from scheduling.services import AssignmentChange, change_assignment, generate_schedule
    from tests.inventory_support import inventory_context
    from tests.test_scheduling_b_12 import NOW, WEEK, planner_setup

    planner = planner_setup()
    context = inventory_context(planner.member.organization, make_member)
    context.profile.permission_codes.append("inventory.allocate")
    context.profile.save(update_fields=["permission_codes"])
    monkeypatch.setattr("scheduling.services.timezone.now", lambda: NOW)
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generate_schedule(planner.member, WEEK)
    task = ScheduledTask.objects.get(organization=planner.member.organization)
    missing = material_suggestion(context.actor, task.due_date, planner.member.user_id)
    assert missing["status"] == "unconfigured"
    assert missing["unconfigured_actions"] == ["place"]
    policy = publish_transit_configuration(
        ConfigurationWrite(
            context.actor,
            context.supply.pk,
            {
                "supply_version_id": context.supply_version.pk,
                "expected_revision": 0,
                "action": "place",
                "quantity": Decimal("2.5"),
                "reference": "Synthetic authored material requirement",
                "is_active": True,
            },
            True,
        )
    )
    assessed = material_suggestion(context.actor, task.due_date, planner.member.user_id)
    assert assessed["status"] == "assessed"
    assert len(assessed["lines"]) == 1
    assert Decimal(assessed["lines"][0]["quantity"]) == Decimal("2.5")
    assert {key: value for key, value in assessed["lines"][0].items() if key != "quantity"} == {
        "supply_version_id": str(context.supply_version.pk),
        "mapping_id": str(policy.pk),
    }
    assert {"tasks", "owner_revision", "rule_version_ids"}.isdisjoint(assessed)
    assert "schedule.read" not in context.profile.permission_codes
    assert not SupplyAssignment.objects.exists()
    # Caller authority alone cannot expose a task whose actual courier lost this vector.
    planner.profile.permission_codes.remove("field_event.sync")
    planner.profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        material_suggestion(context.actor, task.due_date, planner.member.user_id)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", ["dispose", "count"])
def test_actual_disposal_and_physical_replacement_serialize_all_four_real_humans(
    monkeypatch, make_member, first
):
    from concurrent.futures import ThreadPoolExecutor
    from datetime import timedelta
    from threading import Event
    from uuid import UUID, uuid4
    from zoneinfo import ZoneInfo

    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import BagDisposition
    from inventory.exceptions import InventoryConflictError, InventoryInProgressError
    from inventory.models import StockMovement
    from lab.access import LabTarget
    from lab.commands import LabCommandInput, execute_lab_command
    from lab.exceptions import LabInProgressError
    from lab.models import DailyRecountSampleMember, EggCountAttempt
    from lab.recounts import ClosedDayInput, close_lab_day
    from tests.lab_support import AT, actor_with_codes, capture_bag, count_input, lab_context
    from tests.test_inventory_transfers_106 import verified_upload
    from uploads.models import AttachmentLink, Upload

    context = lab_context(monkeypatch)
    receiver = actor_with_codes(context, make_member, ("bag.receive",))
    counter = actor_with_codes(context, make_member, ("egg_count.create", "egg_count.void"))
    disposer = actor_with_codes(context, make_member, ("bag.dispose", "field.upload"))
    assert (
        len({context.field.batch.user.pk, receiver.user.pk, counter.user.pk, disposer.user.pk}) == 4
    )
    for index in range(2):
        bag = capture_bag(context, f"B10-RACE-{index}", new_source=index > 0)
        assert (
            execute_lab_command(
                receiver, LabCommandInput("receive", LabTarget("bag", bag.pk), uuid4(), {})
            ).status
            == 200
        )
        assert execute_lab_command(counter, count_input(context, bag, 0)).status == 201
    closed_now = AT + timedelta(days=1)
    monkeypatch.setattr("lab.recounts.server_now", lambda: closed_now)
    monkeypatch.setattr("django.utils.timezone.now", lambda: closed_now)
    day = AT.astimezone(ZoneInfo(disposer.organization.timezone)).date()
    sample = close_lab_day(ClosedDayInput(disposer.organization, day))
    member = DailyRecountSampleMember.objects.select_related("count__bag").get(
        sample_id=sample.sample_id, selected=False
    )
    bag, predecessor = member.count.bag, member.count
    identifier = verified_upload(disposer)
    values = {
        "command_id": uuid4(),
        "kind": "bag_disposal",
        "bag_id": bag.pk,
        "owner_id": disposer.user.pk,
        "date": day,
        "expected_revision": 1,
        "reason_code": "other",
        "reason": "Synthetic real material disposal race",
        "evidence": [{"upload_id": identifier, "role": "rpbi"}],
    }
    prepared = prepare_inventory_intent(disposer, values)
    intent_id = UUID(prepared.body["intent"]["id"])
    AttachmentLink.objects.create(
        organization=disposer.organization,
        created_by=disposer.user,
        upload=Upload.objects.get(public_id=identifier),
        inventory_intent_id=intent_id,
    )
    replacement = LabCommandInput(
        "void_count",
        LabTarget("count", predecessor.pk),
        uuid4(),
        {
            "expected_revision": 1,
            "reason_code": "other",
            "reason": "Synthetic actual physical replacement",
            "replacement": {"kind": "count", "value": 0, "confirmed_implausible": False},
        },
    )
    operations = {
        "count": lambda: execute_lab_command(counter, replacement),
        "dispose": lambda: execute_inventory_intent(
            disposer, IntentExecution(intent_id, "bag_disposal")
        ),
    }
    loser = "count" if first == "dispose" else "dispose"
    holding, release = Event(), Event()
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(held_supply_operation, operations[first], holding, release)
        try:
            if not holding.wait(10):
                if future.done():
                    future.result()  # Preserve the actual winning-service failure as the cause.
                pytest.fail("The real service did not reach its retained-transaction barrier")
            with pytest.raises((InventoryInProgressError, LabInProgressError)):
                operations[loser]()
        finally:
            release.set()
        result = future.result(timeout=20)
    assert result.status == (201 if first == "dispose" else 200)
    if first == "dispose":
        blocked = operations[loser]()
        assert (blocked.status, blocked.body["code"]) == (409, "bag_material_unavailable")
        assert EggCountAttempt.objects.filter(bag=bag).count() == 1
        assert BagDisposition.objects.filter(bag=bag).count() == 1
    else:
        with pytest.raises(InventoryConflictError) as stale:
            operations[loser]()
        assert stale.value.blocked_by[0]["reason"] == "supply_revision_conflict"
        fresh = prepare_inventory_intent(
            disposer, {**values, "command_id": uuid4(), "expected_revision": 2}
        )
        with pytest.raises(InventoryConflictError) as unassessed:
            execute_inventory_intent(
                disposer, IntentExecution(UUID(fresh.body["intent"]["id"]), "bag_disposal")
            )
        assert unassessed.value.blocked_by[0]["reason"] == "lab_draw_unassessed"
        assert EggCountAttempt.objects.filter(bag=bag).count() == 2
        assert not BagDisposition.objects.filter(bag=bag).exists()
    assert not StockMovement.objects.exists()  # A Bag is not a guessed numeric supply quantity.
