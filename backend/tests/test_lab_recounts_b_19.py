"""B19 independent observations and real physical reuse, without another sampling owner."""

import pytest

from tests.test_inventory_allocations_b_10 import allocation as allocation


def configure_qa(context):
    from lab.independent_qa.services import write_qa_policy
    from lab.methods import decide_method, write_method
    from tests.ovitrap_support import CAPTURED

    method = write_method(
        context.actor,
        {
            "code": "B19-SYNTHETIC-ONLY",
            "expected_revision": 0,
            "name": "Synthetic B19 technical fixture",
            "procedure": "Synthetic observation/treatment workflow, no operational recipe",
            "reference": "Synthetic technical attestation only",
            "effective_from": CAPTURED,
            "supports_viability": True,
            "supports_rejection": False,
            "supports_independent_qa": True,
            "supports_paddle_reuse": True,
        },
    )
    decide_method(
        context.actor,
        method.pk,
        {"expected_revision": 0, "decision": "verify", "reference": "Synthetic verification only"},
    )
    write_qa_policy(
        context.actor,
        {
            "expected_revision": 0,
            "absolute_tolerance": 10,
            "relative_per_100": 10,
            "qa_method_version": method.pk,
            "reuse_method_version": method.pk,
        },
    )
    return method


def qa_command(actor, request, action, values):
    from uuid import uuid4

    from lab.access import LabTarget
    from lab.commands import LabCommandInput, execute_lab_command

    target = (
        LabTarget("bag", request.count.bag_id)
        if action == "recount"
        else LabTarget("recount", request.pk)
    )
    command = LabCommandInput(action, target, uuid4(), values)
    return command, execute_lab_command(actor, command)


def new_physical_assignment(allocation, at):
    from decimal import Decimal
    from uuid import UUID, uuid4

    from inventory.allocations.commands import AssignmentWrite, IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.services import write_assignment
    from inventory.models import Piece

    context = allocation.context
    line = uuid4()
    written = write_assignment(
        AssignmentWrite(
            context.actor,
            {
                "command_id": uuid4(),
                "courier_id": allocation.phone.user.pk,
                "origin_id": context.location.pk,
                "date": at.date(),
                "shift_id": allocation.shift_id,
                "lines": [
                    {
                        "id": line,
                        "lot_id": context.lot.pk,
                        "piece_id": Piece.objects.get(lot=context.lot).pk,
                        "unit_version_id": context.supply_version.pk,
                        "quantity": Decimal(1),
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
    allocation.assignment_id, allocation.release_id, allocation.line_id = (
        assignment_id,
        UUID(released.body["release"]["id"]),
        line,
    )


def captured_physical_bag(allocation, clock, cycle, *, consume=True, collected_at=None):
    from dataclasses import replace
    from datetime import timedelta
    from types import SimpleNamespace
    from uuid import UUID, uuid4

    from catalogs.history import remember_catalog_snapshot
    from catalogs.seeds import seed_default_catalogs
    from catalogs.selectors import build_catalog_snapshot
    from geography.models import Quadrant
    from inventory.models import StockMovement
    from ovitraps.models import Bag
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewItem
    from tests.ovitrap_support import envelope, make_point
    from tests.sync_support import event, second_device_of
    from tests.test_inventory_allocations_b_10 import receive_capture
    from tests.test_inventory_transfers_106 import verified_upload

    context = allocation.context
    if cycle > 1:
        allocation.phone = second_device_of(allocation.phone)
        allocation.source_actor = replace(context.actor, device_id=allocation.phone.device_id)
        new_physical_assignment(allocation, clock[0])
    clock[0] += timedelta(seconds=1)
    received, receipt_line = receive_capture(allocation, "1")
    response = allocation.phone.sync([received])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "accepted", response.data
    quadrant = Quadrant.objects.create(
        organization=context.actor.organization, center=context.center, code=f"B19-Q-{cycle}"
    )
    point = make_point(quadrant, f"B19-P-{cycle}")
    seed_default_catalogs(context.actor.organization)
    catalog = remember_catalog_snapshot(
        context.actor.organization,
        allocation.phone.user,
        build_catalog_snapshot(context.actor.organization),
    )
    field = SimpleNamespace(point=point, identity=uuid4(), catalog_version=catalog.version)
    source_values = {
        "shift_id": str(allocation.shift_id),
        "gps": {"lat": 20.005, "lng": -99.99, "accuracy_m": 5},
        "catalog_version": catalog.version,
    }
    if collected_at is not None:
        source_values["device_time"] = collected_at.isoformat()
    place = event(
        type="ovitrap.place",
        payload={**envelope(field).payload, "supply_refs": [str(receipt_line)]},
        **source_values,
    )
    clock[0] += timedelta(seconds=1)
    response = allocation.phone.sync([place])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "accepted", response.data
    check = event(
        type="ovitrap.check",
        payload=envelope(
            field, "ovitrap.check", payload={"bag_code": f"B19-BAG-{cycle}", "has_eggs": False}
        ).payload,
        **source_values,
    )
    response = allocation.phone.sync([check])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "accepted", response.data
    bag = Bag.objects.get(event_id=check["id"])
    if not consume:
        from inventory.allocations.models import SupplyStockEffect

        return bag, SupplyStockEffect.objects.get(
            receipt_line_id=receipt_line, kind="courier_credit"
        ).movement
    clock[0] += timedelta(seconds=1)
    consumed = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 1,
            "used": [
                {
                    "receipt_line_id": str(receipt_line),
                    "receipt_source_event_id": received["id"],
                    "quantity": "1",
                    "work_kind": "field_event",
                    "work_source_id": check["id"],
                    "transit_policy_id": str(allocation.policy.pk),
                    "transit_evidence_ids": [str(verified_upload(allocation.source_actor))],
                }
            ],
            "returned": [],
            "shrinkage": [],
        },
    )
    response = allocation.phone.sync([consumed])
    assert response.status_code == 200, response.data
    result = response.data["results"][0]
    assert result["status"] == "in_review", result
    decide_review(
        context.actor,
        ReviewItem.objects.get(field_event_id=consumed["id"]).pk,
        ReviewDecisionRequest("accept", 0, "Synthetic actual transit proof accepted", ()),
    )
    debit = StockMovement.objects.get(
        operation__supply_source__event__declared_source_uuid=UUID(consumed["id"]), quantity=-1
    )
    return bag, debit


def complete_physical_qa(context, bag, method, counter, clock, monkeypatch):
    from datetime import timedelta
    from zoneinfo import ZoneInfo

    from lab.commands import execute_lab_command
    from lab.models import EggCountAttempt, RecountRequest
    from lab.recounts import ClosedDayInput, close_lab_day
    from tests.lab_support import count_input, receive

    receive(context, bag)
    observed = execute_lab_command(context.actor, count_input(context, bag, 0))
    first = EggCountAttempt.objects.get(pk=observed.body["count"]["id"])
    day = clock[0].astimezone(ZoneInfo(context.actor.organization.timezone)).date()
    clock[0] += timedelta(days=1)
    monkeypatch.setattr("lab.recounts.server_now", lambda: clock[0])
    selected = close_lab_day(ClosedDayInput(context.actor.organization, day))
    assert (selected.population, selected.quota) == (1, 1)
    request = RecountRequest.objects.get(count=first)
    _, claimed = qa_command(
        counter, request, "recount_claim", {"expected_revision": 0, "role": "second"}
    )
    assert claimed.status == 201
    _, second = qa_command(
        counter,
        request,
        "recount",
        {
            "request_id": request.pk,
            "expected_revision": 1,
            "expected_result_revision": 1,
            "value": 0,
            "confirmed_implausible": False,
            "method_version": method.pk,
        },
    )
    assert second.status == 201
    _, resolved = qa_command(
        counter,
        request,
        "recount_adjudicate",
        {
            "expected_revision": 2,
            "expected_result_revision": 1,
            "final_attempt_id": first.pk,
            "reason_code": "other",
            "reason": "Synthetic completing counter selected the genuine first observation",
        },
    )
    assert resolved.status == 201  # No recount.adjudicate grant on this completing counter.
    return first


def prepared_physical_reuse(allocation, make_member, monkeypatch):
    """One real pending physical cycle shared only by race and raw-guard owners."""
    from datetime import timedelta
    from types import SimpleNamespace
    from uuid import UUID, uuid4

    from django.utils import timezone

    from inventory.models import Piece, StockMovement
    from lab.access import LabTarget
    from lab.commands import LabCommandInput, execute_lab_command
    from lab.models import EggPaddle
    from lab.permissions import ADMIN_CODES
    from rules.seeds import seed_default_rule_parameters
    from tests.lab_support import actor_with_codes
    from tests.uploads_support import verified_upload

    context = allocation.context
    context.profile.permission_codes = sorted(
        set(context.profile.permission_codes)
        | set(ADMIN_CODES)
        | {"catalog.read", "reading.read", "ovitrap.read"}
    )
    context.profile.save(update_fields=["permission_codes"])
    piece = Piece.objects.get(lot=context.lot)
    origin = StockMovement.objects.get(piece=piece, quantity=1)
    clock = [max(timezone.now(), origin.created_at + timedelta(seconds=1))]
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock[0])
    for module in ("lab.counting", "lab.methods", "lab.queue", "lab.recounts", "uploads.access"):
        monkeypatch.setattr(module + ".server_now", lambda: clock[0])
    seed_default_rule_parameters(context.actor.organization)
    lab = SimpleNamespace(actor=context.actor, member=context.member)
    method = configure_qa(lab)
    counter = actor_with_codes(lab, make_member, ["recount.create"])

    def evidence():
        return [verified_upload(context.actor.organization, context.actor.user).public_id]

    registered = execute_lab_command(
        context.actor,
        LabCommandInput(
            "paddle_register",
            LabTarget("paddle", piece.pk),
            uuid4(),
            {
                "code": "B19-PENDING-PHYSICAL",
                "piece_id": piece.pk,
                "source_movement_id": origin.pk,
                "location_id": context.location.pk,
                "evidence_ids": evidence(),
            },
        ),
    )
    assert registered.status == 201
    paddle = EggPaddle.objects.get(pk=registered.body["paddle"]["id"])
    bag, debit = captured_physical_bag(allocation, clock, 1)
    first = complete_physical_qa(lab, bag, method, counter, clock, monkeypatch)
    bound = execute_lab_command(
        context.actor,
        LabCommandInput(
            "paddle_bind",
            LabTarget("paddle", paddle.pk),
            uuid4(),
            {
                "expected_revision": 0,
                "bag_id": bag.pk,
                "issue_movement_id": debit.pk,
                "evidence_ids": evidence(),
            },
        ),
    )
    assert bound.status == 201
    request = LabCommandInput(
        "paddle_reuse",
        LabTarget("paddle", paddle.pk),
        uuid4(),
        {
            "expected_revision": 1,
            "binding_id": UUID(bound.body["binding"]["id"]),
            "expected_result_revision": 1,
            "expected_qa_revision": 3,
            "destination_location_id": context.location.pk,
            "source_movement_id": debit.pk,
            "washed_at": clock[0] - timedelta(minutes=2),
            "dried_at": clock[0] - timedelta(minutes=1),
            "method_version": method.pk,
            "evidence_ids": evidence(),
        },
    )
    return SimpleNamespace(
        context=context,
        clock=clock,
        lab=lab,
        method=method,
        paddle=paddle,
        bag=bag,
        first=first,
        debit=debit,
        origin=origin,
        request=request,
    )


def assert_saved_paddle_http_retries(context, api_client, proof):
    from organizations.models import all_scope

    original_quadrant, binding, binding_response = proof.binding
    reuse, reuse_response = proof.reuse
    retries = (("bindings", binding, binding_response), ("reuses", reuse, reuse_response))
    api_client.force_authenticate(context.actor.user)
    for allowed_quadrant, expected_status in (
        (original_quadrant, 201),
        (proof.current_quadrant, 404),
    ):
        actual_quadrants = {
            allowed_quadrant,
            context.lot.quadrant_id,
            context.location.quadrant_id,
        } - {None}
        context.member.scope = {
            "centers": {"mode": "all", "ids": []},
            "quadrants": {
                "mode": "selected",
                "ids": sorted(str(value) for value in actual_quadrants),
            },
        }
        context.member.save(update_fields=["scope"])
        for action, saved, original_response in retries:
            response = api_client.post(
                f"/api/v1/egg-paddles/{proof.paddle.pk}/{action}/",
                {"command_id": str(saved.command_id), **saved.values},
                format="json",
            )
            assert response.status_code == expected_status, response.data
            if expected_status == 201:
                assert response.data == original_response
    context.member.scope = all_scope()
    context.member.save(update_fields=["scope"])


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("allocation", ["piece"], indirect=True)
def test_forward_paddle_three_real_consumed_cycles_credit_only_first_two_and_preserve_b10(
    allocation, make_member, monkeypatch, void_catalog, api_client
):
    from datetime import timedelta
    from decimal import Decimal
    from types import SimpleNamespace
    from uuid import UUID, uuid4

    from django.db.models import Sum
    from django.utils import timezone

    from inventory.allocations.models import SupplyUse
    from inventory.models import PaddleStockReturn, Piece, StockMovement, StockOperation
    from lab.access import LabTarget
    from lab.commands import LabCommandInput, execute_lab_command
    from lab.models import EggPaddle, PaddleReuse, RecountAttempt
    from lab.permissions import ADMIN_CODES
    from rules.seeds import seed_default_rule_parameters
    from tests.lab_support import actor_with_codes
    from tests.uploads_support import verified_upload

    context = allocation.context
    context.profile.permission_codes = sorted(
        set(context.profile.permission_codes)
        | set(ADMIN_CODES)
        | {"catalog.read", "reading.read", "ovitrap.read"}
    )
    context.profile.permission_codes = [
        code
        for code in context.profile.permission_codes
        if code not in {"location.read", "lot.read"}
    ]
    context.profile.save(update_fields=["permission_codes"])
    clock = [timezone.now()]
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock[0])
    seed_default_rule_parameters(context.actor.organization)
    lab = SimpleNamespace(actor=context.actor, member=context.member)
    method = configure_qa(lab)
    counter = actor_with_codes(lab, make_member, ["recount.create"])
    rival = actor_with_codes(
        lab, make_member, ["egg_paddle.reuse", "inventory.reconcile", "field.upload"]
    )
    ledger_reader = actor_with_codes(lab, make_member, ["location.read", "lot.read"])
    piece = Piece.objects.get(lot=context.lot)
    origin = StockMovement.objects.get(piece=piece, quantity=1)

    def evidence():
        return [verified_upload(context.actor.organization, context.actor.user).public_id]

    registration = LabCommandInput(
        "paddle_register",
        LabTarget("paddle", piece.pk),
        uuid4(),
        {
            "code": "B19-PHYSICAL",
            "piece_id": piece.pk,
            "source_movement_id": origin.pk,
            "location_id": context.location.pk,
            "evidence_ids": evidence(),
        },
    )
    registered = execute_lab_command(context.actor, registration)
    assert registered.status == 201
    paddle = EggPaddle.objects.get(pk=registered.body["paddle"]["id"])
    assert StockMovement.objects.filter(piece=piece).count() == 1
    receipts, original_bindings, original_reuses = [], {}, {}
    for cycle in (1, 2, 3):
        if cycle == 2:
            from django.db import transaction

            previous = paddle.bindings.first().reuse
            saved_allocation, saved_clock = dict(vars(allocation)), clock[0]
            with transaction.atomic():
                old_bag, late_debit = captured_physical_bag(
                    allocation, clock, cycle, collected_at=previous.dried_at - timedelta(seconds=1)
                )
                assert old_bag.reading.event.server_received_at > previous.dried_at
                assert late_debit.created_at > previous.dried_at
                refused = execute_lab_command(
                    context.actor,
                    LabCommandInput(
                        "paddle_bind",
                        LabTarget("paddle", paddle.pk),
                        uuid4(),
                        {
                            "expected_revision": 1,
                            "bag_id": old_bag.pk,
                            "issue_movement_id": late_debit.pk,
                            "evidence_ids": evidence(),
                        },
                    ),
                )
                assert (refused.status, refused.body["code"]) == (409, "lab_paddle_cycle_open")
                assert not paddle.bindings.filter(bag=old_bag).exists()
                transaction.set_rollback(True)
            vars(allocation).clear()
            vars(allocation).update(saved_allocation)
            clock[0] = saved_clock
        bag, debit = captured_physical_bag(allocation, clock, cycle)
        first = complete_physical_qa(lab, bag, method, counter, clock, monkeypatch)
        binding_input = LabCommandInput(
            "paddle_bind",
            LabTarget("paddle", paddle.pk),
            uuid4(),
            {
                "expected_revision": cycle - 1,
                "bag_id": bag.pk,
                "issue_movement_id": debit.pk,
                "evidence_ids": evidence(),
            },
        )
        bound = execute_lab_command(
            context.actor,
            binding_input,
        )
        assert bound.status == 201
        original_bindings[cycle] = (
            bag.reading.ovitrap.sampling_point.block.quadrant_id,
            binding_input,
            bound.body,
        )
        if cycle == 2:
            assert_saved_paddle_http_retries(
                context,
                api_client,
                SimpleNamespace(
                    paddle=paddle,
                    binding=original_bindings[1],
                    reuse=original_reuses[1],
                    current_quadrant=bag.reading.ovitrap.sampling_point.block.quadrant_id,
                ),
            )
        before = SupplyUse.objects.values().get(
            event__declared_source_uuid=debit.operation.supply_source.event.declared_source_uuid
        )
        operation_count = StockOperation.objects.count()
        reuse_input = LabCommandInput(
            "paddle_reuse",
            LabTarget("paddle", paddle.pk),
            uuid4(),
            {
                "expected_revision": cycle,
                "binding_id": UUID(bound.body["binding"]["id"]),
                "expected_result_revision": 1,
                "expected_qa_revision": 3,
                "destination_location_id": context.location.pk,
                "source_movement_id": debit.pk,
                "washed_at": clock[0] - timedelta(minutes=2),
                "dried_at": clock[0] - timedelta(minutes=1),
                "method_version": method.pk,
                "evidence_ids": evidence(),
            },
        )
        if cycle < 3:
            from concurrent.futures import ThreadPoolExecutor
            from dataclasses import replace
            from threading import Event

            from lab.exceptions import LabInProgressError
            from lab.independent_qa.paddles import append_paddle_return
            from tests.test_lab_concurrency_114 import run_counter

            winner_actor, loser_actor = (
                (context.actor, rival) if cycle == 1 else (rival, context.actor)
            )
            winner_request = replace(
                reuse_input,
                values={
                    **reuse_input.values,
                    "evidence_ids": [
                        verified_upload(winner_actor.organization, winner_actor.user).public_id
                    ],
                },
            )
            loser_request = replace(
                reuse_input,
                command_id=uuid4(),
                values={
                    **reuse_input.values,
                    "evidence_ids": [
                        verified_upload(loser_actor.organization, loser_actor.user).public_id
                    ],
                },
            )
            entered, release = Event(), Event()

            def held_return(*args, entered=entered, release=release):
                returned = append_paddle_return(*args)
                entered.set()
                assert release.wait(20)
                return returned

            with monkeypatch.context() as race:
                race.setattr("lab.independent_qa.paddles.append_paddle_return", held_return)
                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(run_counter, winner_actor, winner_request)
                    try:
                        assert entered.wait(20)
                        with pytest.raises(LabInProgressError):
                            execute_lab_command(loser_actor, loser_request)
                    finally:
                        release.set()
                    result = future.result()
            assert execute_lab_command(winner_actor, winner_request).body == result.body
            original_reuses[cycle] = winner_request, result.body
            rejected_retry = execute_lab_command(loser_actor, loser_request)
            assert (rejected_retry.status, rejected_retry.body["code"]) == (
                409,
                "lab_paddle_cycle_closed",
            )
            from lab.models import LabNumericDisclosure

            assert LabNumericDisclosure.objects.filter(
                count=first, created_by=loser_actor.user
            ).exists()
        else:
            result = execute_lab_command(context.actor, reuse_input)
        if cycle == 3:
            assert (result.status, result.body["code"]) == (409, "lab_paddle_reuse_limit")
            assert StockOperation.objects.count() == operation_count
        else:
            assert result.status == 201
            receipts.append(result.body)
            assert StockOperation.objects.count() == operation_count + 1
            returned = PaddleStockReturn.objects.get(reuse_id=result.body["reuse"]["id"])
            assert (returned.piece_id, returned.unit_version_id, returned.consumed_debit_id) == (
                piece.pk,
                debit.unit_version_id,
                debit.pk,
            )
            assert list(returned.stock_operation.movements.values_list("quantity", flat=True)) == [
                Decimal(1)
            ]
            if cycle == 1:
                route = f"/api/v1/locations/{context.location.pk}/movements/"
                api_client.force_authenticate(context.actor.user)
                assert api_client.get(route, {"lot_code": context.lot.code}).status_code == 403
                api_client.force_authenticate(ledger_reader.user)
                page = api_client.get(route, {"lot_code": context.lot.code})
                assert page.status_code == 200
                leg = next(
                    row
                    for row in page.json()["results"]
                    if row["operation_id"] == str(returned.stock_operation.pk)
                )
                assert (leg["source_kind"], leg["source_id"]) == ("paddle_return", str(returned.pk))
                assert leg["source_supply"] is None
                assert leg["source_transfer"] is None
            assert (
                StockMovement.objects.filter(piece=piece).aggregate(total=Sum("quantity"))["total"]
                == 1
            )
        assert SupplyUse.objects.filter(pk=before["id"]).values().get() == before
        assert first.value == 0
    assert (
        PaddleReuse.objects.count(),
        PaddleStockReturn.objects.count(),
        SupplyUse.objects.count(),
        RecountAttempt.objects.count(),
    ) == (2, 2, 3, 3)
    assert [receipt["reuse"]["reuse_number"] for receipt in receipts] == [1, 2]
    assert StockMovement.objects.filter(piece=piece).aggregate(total=Sum("quantity"))["total"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize("allocation", ["piece"], indirect=True)
def test_actual_positive_return_is_not_credited_twice_and_late_draw_blocks_treated_material(
    allocation, monkeypatch, void_catalog
):
    from dataclasses import replace
    from datetime import timedelta
    from decimal import Decimal
    from types import SimpleNamespace
    from uuid import UUID, uuid4
    from zoneinfo import ZoneInfo

    from django.db.models import Sum
    from django.utils import timezone

    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import ReturnAcceptance, ReturnDeclaration, SupplyStockEffect
    from inventory.models import PaddleStockReturn, Piece, StockMovement, StockOperation
    from inventory.services import LotChange, revise_lot
    from lab.access import LabTarget
    from lab.commands import LabCommandInput, execute_lab_command
    from lab.exceptions import LabConflictError
    from lab.independent_qa.paddles import reuse_frame
    from lab.independent_qa.selectors import request_state
    from lab.models import (
        DailyRecountSampleMember,
        EggPaddle,
        PaddleReuse,
        RecountAttempt,
        RecountRequest,
    )
    from lab.permissions import ADMIN_CODES
    from lab.recounts import ClosedDayInput, close_lab_day
    from rules.seeds import seed_default_rule_parameters
    from tests.lab_support import count_input, receive
    from tests.sync_support import event
    from tests.test_inventory_transfers_106 import verified_upload as inventory_evidence
    from tests.uploads_support import verified_upload
    from uploads.models import AttachmentLink, Upload

    context = allocation.context
    context.profile.permission_codes = sorted(
        set(context.profile.permission_codes)
        | set(ADMIN_CODES)
        | {"catalog.read", "reading.read", "ovitrap.read"}
    )
    context.profile.save(update_fields=["permission_codes"])
    clock = [timezone.now()]
    monkeypatch.setattr("django.utils.timezone.now", lambda: clock[0])
    seed_default_rule_parameters(context.actor.organization)
    method = configure_qa(SimpleNamespace(actor=context.actor, member=context.member))
    second_lot = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "B19-SECOND-REAL-PIECE",
                "supply_id": context.supply.pk,
                "initial_location_id": context.location.pk,
                "quantity": Decimal(1),
                "provenance": "Actual second synthetic admission",
            },
        )
    )
    other = SimpleNamespace(
        **{**vars(allocation), "context": replace(context, lot=second_lot.lot, version=second_lot)}
    )
    rows = []

    def evidence():
        return [verified_upload(context.actor.organization, context.actor.user).public_id]

    for cycle, current in enumerate((allocation, other), 1):
        piece = Piece.objects.get(lot=current.context.lot)
        origin = StockMovement.objects.get(piece=piece, quantity=1)
        registered = execute_lab_command(
            context.actor,
            LabCommandInput(
                "paddle_register",
                LabTarget("paddle", piece.pk),
                uuid4(),
                {
                    "code": f"B19-POSITIVE-{cycle}",
                    "piece_id": piece.pk,
                    "source_movement_id": origin.pk,
                    "location_id": context.location.pk,
                    "evidence_ids": evidence(),
                },
            ),
        )
        assert registered.status == 201
        paddle = EggPaddle.objects.get(pk=registered.body["paddle"]["id"])
        bag, issue = captured_physical_bag(current, clock, cycle, consume=False)
        receive(SimpleNamespace(actor=context.actor), bag)
        observed = execute_lab_command(
            context.actor, count_input(SimpleNamespace(actor=context.actor), bag, 0)
        )
        assert observed.status == 201
        bound = execute_lab_command(
            context.actor,
            LabCommandInput(
                "paddle_bind",
                LabTarget("paddle", paddle.pk),
                uuid4(),
                {
                    "expected_revision": 0,
                    "bag_id": bag.pk,
                    "issue_movement_id": issue.pk,
                    "evidence_ids": evidence(),
                },
            ),
        )
        assert bound.status == 201
        rows.append((current, paddle, bag, issue, UUID(bound.body["binding"]["id"])))
    local_day = clock[0].astimezone(ZoneInfo(context.actor.organization.timezone)).date()
    clock[0] += timedelta(days=1)
    monkeypatch.setattr("lab.recounts.server_now", lambda: clock[0])
    sampling = close_lab_day(ClosedDayInput(context.actor.organization, local_day))
    assert (sampling.population, sampling.quota) == (2, 1)
    unselected = DailyRecountSampleMember.objects.get(sample_id=sampling.sample_id, selected=False)
    current, paddle, bag, issued, binding_id = next(
        row for row in rows if row[2].pk == unselected.count.bag_id
    )
    selected = DailyRecountSampleMember.objects.get(sample_id=sampling.sample_id, selected=True)
    actual_receipt = SupplyStockEffect.objects.get(movement=issued).receipt_line
    # Fresh authentication after the closed day, without changing custody/source facts.
    from tests.sync_support import second_device_of

    current.phone = second_device_of(current.phone)
    current.source_actor = replace(context.actor, device_id=current.phone.device_id)
    declaration_event = event(
        type="supplies.reconcile",
        shift_id=str(current.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(current.assignment_id),
            "expected_revision": 1,
            "used": [],
            "shrinkage": [],
            "returned": [
                {
                    "receipt_line_id": str(actual_receipt.pk),
                    "receipt_source_event_id": str(
                        actual_receipt.receipt.event.declared_source_uuid
                    ),
                    "quantity": "1",
                    "destination_id": str(context.location.pk),
                }
            ],
        },
    )
    assert current.phone.sync([declaration_event]).data["results"][0]["status"] == "accepted"
    declaration = ReturnDeclaration.objects.get(event__declared_source_uuid=declaration_event["id"])
    signature = inventory_evidence(context.actor)
    prepared = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "return_accept",
            "declaration_id": declaration.pk,
            "expected_revision": 2,
            "quantity": "1",
            "evidence": [{"upload_id": signature, "role": "signature"}],
        },
    )
    intent_id = UUID(prepared.body["intent"]["id"])
    AttachmentLink.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        upload=Upload.objects.get(public_id=signature),
        inventory_intent_id=intent_id,
    )
    accepted = execute_inventory_intent(
        context.actor,
        IntentExecution(intent_id, "return_accept", declaration.event.assignment.reconciliation.pk),
    )
    assert accepted.status == 201
    credit = SupplyStockEffect.objects.get(
        source__execution__intent_id=intent_id, kind="return_credit"
    ).movement
    preserved_acceptance = ReturnAcceptance.objects.get().pk
    command = LabCommandInput(
        "paddle_reuse",
        LabTarget("paddle", paddle.pk),
        uuid4(),
        {
            "expected_revision": 1,
            "binding_id": binding_id,
            "expected_result_revision": 1,
            "expected_qa_revision": 0,
            "destination_location_id": context.location.pk,
            "source_movement_id": credit.pk,
            "washed_at": clock[0] - timedelta(minutes=2),
            "dried_at": clock[0] - timedelta(minutes=1),
            "method_version": method.pk,
            "evidence_ids": evidence(),
        },
    )
    operations = StockOperation.objects.count()
    reused = execute_lab_command(context.actor, command)
    assert reused.status == 201
    assert reused.body["reuse"]["recovery_kind"] == "custody"
    assert execute_lab_command(context.actor, command).body == reused.body
    assert StockOperation.objects.count() == operations
    returned = PaddleStockReturn.objects.get(reuse_id=reused.body["reuse"]["id"])
    assert returned.source_movement_id == credit.pk
    assert returned.consumed_debit_id is None
    assert (
        StockMovement.objects.filter(piece=paddle.piece).aggregate(total=Sum("quantity"))["total"]
        == 1
    )
    assert ReturnAcceptance.objects.get(pk=preserved_acceptance).quantity == 1
    assert not RecountAttempt.objects.exists()
    retained = PaddleReuse.objects.filter(pk=reused.body["reuse"]["id"]).values().get()
    # Removing the selected OTHER observation changes the real closed-day population.
    voided = execute_lab_command(
        context.actor,
        LabCommandInput(
            "void_count",
            LabTarget("count", selected.count_id),
            uuid4(),
            {
                "expected_revision": 1,
                "reason_code": "other",
                "reason": "Correct the other genuine selected observation",
            },
        ),
    )
    assert voided.status == 200
    supplement = close_lab_day(ClosedDayInput(context.actor.organization, local_day))
    assert (supplement.population, supplement.quota) == (1, 1)
    obligation = RecountRequest.objects.get(count=unselected.count)
    assert obligation.causes.filter(
        kind="daily_sample", proof__sample_id=str(supplement.sample_id)
    ).exists()
    assert request_state(obligation) == "awaiting_material"
    with pytest.raises(LabConflictError) as pending:
        reuse_frame(returned.reuse.binding)
    assert pending.value.code == "lab_recount_pending"
    assert PaddleReuse.objects.filter(pk=retained["id"]).values().get() == retained
    assert StockOperation.objects.count() == operations
    assert (
        StockMovement.objects.filter(piece=paddle.piece).aggregate(total=Sum("quantity"))["total"]
        == 1
    )


@pytest.mark.django_db
def test_blind_second_third_and_explicit_choice_retain_original_observation_and_population(
    monkeypatch, make_member
):
    from uuid import UUID, uuid4

    from django.http import Http404

    from lab.commands import execute_lab_command
    from lab.independent_qa.selectors import execution_rows, queue_projection
    from lab.models import (
        EggCountAttempt,
        LabNumericDisclosure,
        RecountAttempt,
        RecountRequest,
        RecountResolution,
    )
    from lab.recounts import daily_population
    from lab.selectors import published_result_projection, result_rows, void_context
    from tests.lab_support import (
        AT,
        actor_with_codes,
        capture_bag,
        count_input,
        lab_context,
        receive,
    )

    context = lab_context(monkeypatch)
    method = configure_qa(context)
    bag = capture_bag(context, has_eggs=False)
    receive(context, bag)
    original = execute_lab_command(context.actor, count_input(context, bag, 100))
    count = EggCountAttempt.objects.get(pk=original.body["count"]["id"])
    request = RecountRequest.objects.get(count=count)
    pinned = EggCountAttempt.objects.filter(pk=count.pk).values().get()
    _, self_denied = qa_command(
        context.actor, request, "recount_claim", {"expected_revision": 0, "role": "second"}
    )
    assert (self_denied.status, self_denied.body["code"]) == (409, "lab_recount_self")

    exposed = actor_with_codes(context, make_member, ["egg_count.read"])
    assert published_result_projection(exposed, count)["value"] == 100
    assert LabNumericDisclosure.objects.filter(count=count, created_by=exposed.user).count() == 1
    profile = exposed.user.memberships.get(organization=context.actor.organization).profiles.get()
    profile.permission_codes += ["recount.create"]
    profile.save(update_fields=["permission_codes"])
    _, denied = qa_command(
        exposed, request, "recount_claim", {"expected_revision": 0, "role": "second"}
    )
    assert denied.body["code"] == "lab_recount_disclosed"

    second = actor_with_codes(
        context, make_member, ["recount.create", "egg_count.read", "egg_count.void"]
    )
    assert result_rows(second, EggCountAttempt, {}).count() == 0
    with pytest.raises(Http404):
        void_context(second, ("count", count.pk))
    queue = queue_projection(execution_rows(second, {}).get(pk=request.pk))
    assert queue["state"] == "awaiting_second"
    assert not {"value", "difference", "first_counter", "causes"} & queue.keys()
    _, claimed = qa_command(
        second, request, "recount_claim", {"expected_revision": 0, "role": "second"}
    )
    assert claimed.status == 201
    attempt_command, observed = qa_command(
        second,
        request,
        "recount",
        {
            "request_id": request.pk,
            "expected_revision": 1,
            "expected_result_revision": 1,
            "value": 111,
            "confirmed_implausible": False,
            "method_version": method.pk,
        },
    )
    assert observed.status == 201
    assert observed.body["qa_state"] == "awaiting_third"
    assert execute_lab_command(second, attempt_command).body == observed.body
    assert published_result_projection(second, count)["value"] == 100
    assert EggCountAttempt.objects.filter(pk=count.pk).values().get() == pinned
    assert (
        daily_population(
            (context.actor.organization, AT.replace(hour=0), AT.replace(hour=23))
        ).count()
        == 1
    )
    _, blocked = qa_command(
        second,
        request,
        "recount_adjudicate",
        {
            "expected_revision": 2,
            "expected_result_revision": 1,
            "final_attempt_id": count.pk,
            "reason_code": "other",
            "reason": "Synthetic explicit selected observation",
        },
    )
    assert blocked.body["code"] == "lab_recount_third_required"
    assert not RecountResolution.objects.exists()
    third = actor_with_codes(
        context, make_member, ["recount.create", "recount.adjudicate", "egg_count.read"]
    )
    _, third_claim = qa_command(
        third, request, "recount_claim", {"expected_revision": 2, "role": "third"}
    )
    assert third_claim.status == 201
    _, third_count = qa_command(
        third,
        request,
        "recount",
        {
            "request_id": request.pk,
            "expected_revision": 3,
            "expected_result_revision": 1,
            "value": 101,
            "confirmed_implausible": False,
            "method_version": method.pk,
        },
    )
    assert third_count.status == 201
    _, arbitrary = qa_command(
        third,
        request,
        "recount_adjudicate",
        {
            "expected_revision": 4,
            "expected_result_revision": 1,
            "final_attempt_id": uuid4(),
            "reason_code": "other",
            "reason": "Synthetic arbitrary choice is never accepted",
        },
    )
    assert arbitrary.body["code"] == "lab_recount_candidate_required"
    _, selected = qa_command(
        third,
        request,
        "recount_adjudicate",
        {
            "expected_revision": 4,
            "expected_result_revision": 1,
            "final_attempt_id": UUID(observed.body["attempt"]["id"]),
            "reason_code": "other",
            "reason": "Synthetic independent final selection",
        },
    )
    assert selected.status == 201
    resolved = RecountResolution.objects.get()
    assert resolved.selected_attempt_id == UUID(observed.body["attempt"]["id"])
    assert {
        count.created_by_id,
        *RecountAttempt.objects.values_list("created_by_id", flat=True),
    } == {context.actor.user.pk, second.user.pk, third.user.pk}
    assert (EggCountAttempt.objects.count(), RecountAttempt.objects.count()) == (1, 2)
    assert EggCountAttempt.objects.filter(pk=count.pk).values().get() == pinned


@pytest.mark.parametrize(
    ("first", "second", "absolute", "relative", "expected"),
    [
        (0, 10, 10, 10, False),
        (0, 11, 10, 10, True),
        (100, 110, 10, 10, False),
        (100, 111, 10, 10, True),
        (101, 111, 10, 10, False),
        (101, 112, 10, 10, True),
        (1000, 900, 10, 10, False),
        (1000, 899, 10, 10, True),
        (100, 115, 10, 20, False),
        (100, 115, 10, 10, True),
    ],
)
def test_third_observation_requires_strict_exact_difference_against_pinned_tolerances(
    first, second, absolute, relative, expected
):
    from lab.independent_qa.policies import RecountComparison, requires_third

    comparison = RecountComparison(first, second, absolute, relative)
    assert requires_third(comparison) is expected
