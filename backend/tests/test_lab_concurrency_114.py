"""PostgreSQL barriers protect one winner, exact replay and source-void ordering."""

import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from uuid import uuid4

import pytest
from django.db import close_old_connections

from field_sync.models import ACCEPTED_CODE
from lab.commands import execute_lab_command
from lab.exceptions import LabInProgressError
from lab.models import EggCountAttempt, RecountRequest
from organizations.models import all_scope
from tests.lab_support import capture_bag, count_input, lab_context, receive
from tests.test_lab_recounts_b_19 import allocation as allocation
from uploads.access import UploadActor


def run_counter(actor, request):
    close_old_connections()
    try:
        return execute_lab_command(actor, request)
    finally:
        close_old_connections()


def run_source_void(field, capture):
    from tests.ovitrap_support import ingest

    close_old_connections()
    try:
        return ingest(field, capture)
    finally:
        close_old_connections()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("allocation", ["piece"], indirect=True)
@pytest.mark.parametrize("winner_kind", ["correction", "reuse"])
def test_result_correction_and_reuse_keep_one_physical_winner_and_atomic_evidence(
    allocation, make_member, monkeypatch, void_catalog, winner_kind
):
    from inventory.models import StockMovement, StockOperation
    from lab.access import LabTarget
    from lab.commands import LabCommandInput
    from lab.corrections import void_result
    from lab.independent_qa.paddles import append_paddle_return
    from lab.models import LabResultVoid, PaddleReuse
    from tests.test_lab_recounts_b_19 import prepared_physical_reuse
    from uploads.models import AttachmentLink

    physical = prepared_physical_reuse(allocation, make_member, monkeypatch)
    actor = physical.context.actor
    correction = LabCommandInput(
        "void_count",
        LabTarget("count", physical.first.pk),
        uuid4(),
        {
            "expected_revision": 1,
            "reason_code": "other",
            "reason": "A real correction and wash cannot both replace the same physical frame",
        },
    )
    operations, movements = StockOperation.objects.count(), StockMovement.objects.count()
    entered, release = threading.Event(), threading.Event()
    owner = void_result if winner_kind == "correction" else append_paddle_return

    def held_winner(*args):
        result = owner(*args)
        entered.set()
        assert release.wait(10)
        return result

    target = (
        "lab.corrections.void_result"
        if winner_kind == "correction"
        else "lab.independent_qa.paddles.append_paddle_return"
    )
    winning, losing = (
        (correction, physical.request)
        if winner_kind == "correction"
        else (physical.request, correction)
    )
    with monkeypatch.context() as race:
        race.setattr(target, held_winner)
        with ThreadPoolExecutor(max_workers=1) as pool:
            winner = pool.submit(run_counter, actor, winning)
            try:
                assert entered.wait(10)
                with pytest.raises(LabInProgressError):
                    execute_lab_command(actor, losing)
            finally:
                release.set()
            result = winner.result()
    assert result.status == (200 if winner_kind == "correction" else 201)
    retry = execute_lab_command(actor, losing)
    assert (retry.status, retry.body["code"]) == (
        409,
        "lab_paddle_result_unavailable"
        if winner_kind == "correction"
        else "lab_material_dependency",
    )
    reused = winner_kind == "reuse"
    assert PaddleReuse.objects.count() == int(reused)
    assert LabResultVoid.objects.count() == int(not reused)
    assert StockOperation.objects.count() == operations + int(reused)
    assert StockMovement.objects.count() == movements + int(reused)
    assert (
        AttachmentLink.objects.filter(
            upload__public_id__in=physical.request.values["evidence_ids"]
        ).exists()
        is reused
    )
    assert execute_lab_command(actor, winning).body == result.body


def mixed_void_batch(context, blocked_capture, code):
    from datetime import timedelta

    from field_sync.services import sync_batch
    from tests.ovitrap_support import CAPTURED

    uncounted = capture_bag(context, code, new_source=True)
    first = replace(
        blocked_capture,
        id=uuid4(),
        index=0,
        voids_event_id=uncounted.event_id,
        device_time=CAPTURED + timedelta(seconds=1),
    )
    second = replace(
        blocked_capture, id=uuid4(), index=1, device_time=CAPTURED + timedelta(seconds=2)
    )
    batch = replace(
        context.field.batch,
        sent_at=CAPTURED + timedelta(minutes=1),
        received_at=CAPTURED + timedelta(minutes=1),
    )
    results = sync_batch(batch, [first, second], None).results
    assert [(row.status, row.code) for row in results] == [
        ("accepted", ACCEPTED_CODE),
        ("rejected", "ovitrap_void_blocked"),
    ]


@pytest.mark.django_db(transaction=True)
def test_two_counters_have_one_committed_winner_and_retry_observes_current_revision(
    monkeypatch, make_member
):
    from lab.counting import complete_count
    from reviews.models import HistoryPublicationReceipt

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    user, member = make_member(context.actor.organization, ["egg_count.create"])
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    rival = UploadActor(user, context.actor.organization)
    entered, release = threading.Event(), threading.Event()

    def hold_winner(count, causes):
        complete_count(count, causes)
        entered.set()
        assert release.wait(10)

    monkeypatch.setattr("lab.counting.complete_count", hold_winner)
    request = count_input(context, bag, 1001, confirmed_implausible=True)
    with ThreadPoolExecutor(max_workers=1) as pool:
        winner = pool.submit(run_counter, context.actor, request)
        try:
            assert entered.wait(10)
            with pytest.raises(LabInProgressError):
                execute_lab_command(rival, replace(request, command_id=uuid4()))
        finally:
            release.set()
        assert winner.result().status == 201
    retry = execute_lab_command(rival, replace(request, command_id=uuid4()))
    assert (retry.status, retry.body["code"]) == (409, "lab_state_conflict")
    assert EggCountAttempt.objects.count() == RecountRequest.objects.count() == 1
    assert HistoryPublicationReceipt.objects.filter(cause_kind="lab_count").count() == 1
    from lab.access import LabTarget
    from lab.commands import LabCommandInput
    from lab.independent_qa.services import claim_request
    from lab.models import RecountClaim
    from tests.lab_support import actor_with_codes
    from tests.test_lab_recounts_b_19 import configure_qa, qa_command

    configure_qa(context)
    first_independent = actor_with_codes(context, make_member, ["recount.create"])
    competing_independent = actor_with_codes(context, make_member, ["recount.create"])
    obligation = RecountRequest.objects.get()
    claim = LabCommandInput(
        "recount_claim",
        LabTarget("recount", obligation.pk),
        uuid4(),
        {"expected_revision": 0, "role": "second"},
    )
    entered.clear()
    release.clear()

    def held_claim(*args):
        outcome = claim_request(*args)
        entered.set()
        assert release.wait(10)
        return outcome

    with monkeypatch.context() as claiming:
        claiming.setattr("lab.independent_qa.services.claim_request", held_claim)
        with ThreadPoolExecutor(max_workers=1) as pool:
            winner = pool.submit(run_counter, first_independent, claim)
            try:
                assert entered.wait(10)
                with pytest.raises(LabInProgressError):
                    execute_lab_command(competing_independent, replace(claim, command_id=uuid4()))
            finally:
                release.set()
            claimed = winner.result()
    assert claimed.status == 201
    assert execute_lab_command(first_independent, claim).body == claimed.body
    _, rival_retry = qa_command(
        competing_independent,
        obligation,
        "recount_claim",
        {"expected_revision": 1, "role": "second"},
    )
    assert (rival_retry.status, rival_retry.body["code"]) == (409, "lab_recount_claimed")
    assert RecountClaim.objects.count() == 1


@pytest.mark.django_db
def test_lost_reply_replays_exact_saved_next_and_reauthorizes_every_saved_subject(
    monkeypatch, make_member
):
    from types import SimpleNamespace

    from django.http import Http404

    from geography.models import Quadrant
    from lab.methods import decide_method
    from lab.models import LabCommandResult
    from tests.lab_support import synthetic_method
    from tests.ovitrap_support import envelope, ingest, make_point

    context = lab_context(monkeypatch)
    first = capture_bag(context, "REPLAY-FIRST")
    receive(context, first)
    quadrant = Quadrant.objects.create(
        organization=context.actor.organization,
        center=context.field.point.block.quadrant.center,
        code="REPLAY-NEXT-Q",
    )
    other_field = SimpleNamespace(
        **{
            **vars(context.field),
            "point": make_point(quadrant, "REPLAY-NEXT-P"),
            "identity": uuid4(),
        }
    )
    assert ingest(other_field, envelope(other_field)).status == "accepted"
    other = SimpleNamespace(field=other_field, actor=context.actor, member=context.member)
    second = capture_bag(other, "REPLAY-SECOND")
    receive(other, second)
    method = synthetic_method(context)
    request = count_input(
        context, first, 0, viable_eggs=0, total_examined=0, method_version=method.pk
    )
    committed = execute_lab_command(context.actor, request)
    assert committed.body["next_bag"]["id"] == str(second.pk)
    execute_lab_command(context.actor, count_input(context, second, 0))
    decide_method(
        context.actor,
        method.pk,
        {
            "expected_revision": 1,
            "decision": "withdraw",
            "reference": "Synthetic later configuration withdrawal",
        },
    )
    replay = execute_lab_command(context.actor, request)
    assert replay.replayed is True
    assert replay.body == committed.body
    assert EggCountAttempt.objects.count() == 2
    from lab.models import RecountAttempt
    from tests.lab_support import actor_with_codes
    from tests.test_lab_recounts_b_19 import configure_qa, qa_command

    qa_method = configure_qa(context)
    qa_first = capture_bag(context, "REPLAY-QA-FIRST", new_source=True, has_eggs=False)
    qa_next = capture_bag(other, "REPLAY-QA-NEXT", new_source=True, has_eggs=False)
    for target in (qa_first, qa_next):
        receive(context, target)
        assert execute_lab_command(context.actor, count_input(context, target, 100)).status == 201
    first_request = RecountRequest.objects.get(count__bag=qa_first)
    next_request = RecountRequest.objects.get(count__bag=qa_next)
    independent = actor_with_codes(context, make_member, ["recount.create"])
    for target in (first_request, next_request):
        _, claim = qa_command(
            independent, target, "recount_claim", {"expected_revision": 0, "role": "second"}
        )
        assert claim.status == 201
        observation, completed = qa_command(
            independent,
            target,
            "recount",
            {
                "request_id": target.pk,
                "expected_revision": 1,
                "expected_result_revision": 1,
                "value": 105,
                "confirmed_implausible": False,
                "method_version": qa_method.pk,
            },
        )
        assert completed.status == 201
        if target.pk == first_request.pk:
            saved_observation, saved_response = observation, completed.body
            assert saved_response["next_recount"]["id"] == str(next_request.pk)
    decide_method(
        context.actor,
        qa_method.pk,
        {
            "expected_revision": 1,
            "decision": "withdraw",
            "reference": "Synthetic later QA procedure withdrawal",
        },
    )
    replayed = execute_lab_command(independent, saved_observation)
    assert replayed.replayed
    assert replayed.body == saved_response
    assert RecountAttempt.objects.count() == 2
    independent_member = independent.user.memberships.get(organization=context.actor.organization)
    independent_member.scope = {
        "centers": {"mode": "all", "ids": []},
        "quadrants": {"mode": "selected", "ids": [str(context.field.point.block.quadrant_id)]},
    }
    independent_member.save(update_fields=["scope"])
    with pytest.raises(Http404):
        execute_lab_command(independent, saved_observation)
    assert (
        LabCommandResult.objects.get(command__command_id=saved_observation.command_id).body
        == saved_response
    )
    changed = replace(request, values={**request.values, "value": 1})
    from lab.exceptions import LabConflictError

    with pytest.raises(LabConflictError) as conflicting:
        execute_lab_command(context.actor, changed)
    assert conflicting.value.code == "lab_command_conflict"
    context.field.membership.scope = {
        "centers": {"mode": "all", "ids": []},
        "quadrants": {"mode": "selected", "ids": [str(context.field.point.block.quadrant_id)]},
    }
    context.field.membership.save(update_fields=["scope"])
    with pytest.raises(Http404):
        execute_lab_command(context.actor, request)
    assert (
        LabCommandResult.objects.get(command__command_id=request.command_id).body == committed.body
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("winner_kind", ["count", "void"])
def test_source_void_and_count_serialize_both_winner_orders_without_erasing_lab(
    monkeypatch, winner_kind
):
    import lab.counting as counting
    import ovitraps.services as ovitrap_services
    from field_sync.envelope import describe_payload
    from field_sync.exceptions import SyncInProgressError
    from tests.ovitrap_support import envelope, ingest

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    receive(context, bag)
    payload = {"reason_code": "other", "reason": "Correct the original source observation"}
    source_void = replace(
        envelope(context.field, "record.void"),
        voids_event_id=bag.event_id,
        payload=payload,
        payload_info=describe_payload(payload),
    )
    request = count_input(context, bag, 0)
    entered, release = threading.Event(), threading.Event()
    owner = (
        counting.complete_count if winner_kind == "count" else ovitrap_services._append_ovitrap_void
    )

    def hold_winner(*args):
        result = owner(*args)
        entered.set()
        assert release.wait(10)
        return result

    target = (
        "lab.counting.complete_count"
        if winner_kind == "count"
        else "ovitraps.services._append_ovitrap_void"
    )
    monkeypatch.setattr(target, hold_winner)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = (
            pool.submit(run_counter, context.actor, request)
            if winner_kind == "count"
            else pool.submit(run_source_void, context.field, source_void)
        )
        try:
            assert entered.wait(10)
            if winner_kind == "count":
                with pytest.raises(SyncInProgressError):
                    ingest(context.field, source_void)
            else:
                with pytest.raises(LabInProgressError):
                    execute_lab_command(context.actor, request)
        finally:
            release.set()
        winner = future.result()
    if winner_kind == "count":
        assert winner.status == 201
        correction = ingest(context.field, source_void)
        assert (correction.status, correction.code) == ("rejected", "ovitrap_void_blocked")
        mixed_void_batch(context, source_void, "DEFERRED-NORMAL")
        # Exercise the SQL completion boundary if an application precheck misses a dependency.
        monkeypatch.setattr("lab.dependencies.source_lab_blockers", lambda _source: [])
        mixed_void_batch(context, source_void, "DEFERRED-SQL")
        assert EggCountAttempt.objects.filter(bag=bag).count() == 1
    else:
        assert winner.status == "accepted"
        refused = execute_lab_command(context.actor, request)
        assert (refused.status, refused.body["code"]) == (409, "no_reading")
        assert not EggCountAttempt.objects.filter(bag=bag).exists()
