"""First-pass lifecycle, named reporting, evidence and correction obligations (real PG)."""

from decimal import Decimal

import pytest

from lab.access import LabTarget
from lab.commands import execute_lab_command
from lab.models import EggCountAttempt, LabResultRevision, RecountRequest
from lab.queue import current_lab_queue
from tests.lab_support import (
    capture_bag,
    command,
    count_input,
    lab_context,
    receive,
    synthetic_method,
)
from tests.uploads_support import verified_upload

pytestmark = pytest.mark.django_db


def test_count_retains_method_rules_zero_examined_and_immediate_real_qa(monkeypatch):
    context = lab_context(monkeypatch)
    method = synthetic_method(context)
    bag = capture_bag(context, has_eggs=False, is_lagged=True)
    receive(context, bag)
    assert bag.reading.is_index_excluded is True
    assert list(
        current_lab_queue(
            context.actor,
            {
                "center": context.field.point.block.quadrant.center_id,
                "quadrant": context.field.point.block.quadrant_id,
                "point": context.field.point.pk,
                "week": bag.reading.epi_week,
                "code": bag.code,
                "ordering": "-code",
            },
        ).values_list("pk", flat=True)
    ) == [bag.pk]
    missing_confirmation = execute_lab_command(context.actor, count_input(context, bag, 10001))
    assert missing_confirmation.status == 409
    assert missing_confirmation.body["code"] == "lab_confirmation_required"
    assert not EggCountAttempt.objects.exists()
    request = count_input(
        context,
        bag,
        10001,
        confirmed_implausible=True,
        viable_eggs=0,
        total_examined=0,
        method_version=method.pk,
    )
    result = execute_lab_command(context.actor, request)
    assert result.status == 201
    count = EggCountAttempt.objects.get(pk=result.body["count"]["id"])
    assert (
        count.value,
        count.viable_eggs,
        count.total_examined,
        count.viability_percent,
        count.viability_reason,
    ) == (10001, 0, 0, None, "zero_examined")
    assert count.method_version_id == method.pk
    assert count.verification.content_hash == method.content_hash
    assert count.source_proof["has_eggs"] is False
    assert count.source_proof["device_time"] == bag.event.device_time.isoformat()
    assert count.rules["lab_count_plausibility_limit"]["version_id"]
    assert set(count.recount_request.causes.values_list("kind", flat=True)) == {
        "implausible",
        "eggs_flag_absent",
    }
    assert count.recount_request.first_counter_id == context.actor.user.pk
    assert count.recount_request.independent_required is True
    assert not current_lab_queue(context.actor, {}).exists()
    assert LabResultRevision.objects.get(bag=bag).count_id == count.pk


def test_verified_reporting_does_not_infer_examined_sample_from_full_paddle_count(monkeypatch):
    from lab.counting import count_projection
    from lab.methods import write_method

    context = lab_context(monkeypatch)
    method = synthetic_method(context)
    bag = capture_bag(context)
    receive(context, bag)
    outcome = execute_lab_command(
        context.actor,
        count_input(context, bag, 0, viable_eggs=1, total_examined=3, method_version=method.pk),
    )
    assert outcome.status == 201
    count = EggCountAttempt.objects.get()
    assert count.value == 0
    assert count.viability_percent == Decimal("33.333333")
    assert not RecountRequest.objects.exists()
    revised = write_method(
        context.actor,
        {
            "expected_revision": 1,
            "name": "Changed synthetic procedure, not operational approval",
            "procedure": "A distinct synthetic technical configuration remains unverified.",
            "reference": "Synthetic replacement procedure reference",
            "effective_from": method.effective_from,
            "supports_viability": True,
            "supports_rejection": True,
        },
        method.method_id,
    )
    assert count_projection(count)["method"]["name"] == method.name
    later_bag = capture_bag(context, "UNVERIFIED-METHOD", new_source=True)
    receive(context, later_bag)
    unavailable = execute_lab_command(
        context.actor,
        count_input(
            context, later_bag, 0, viable_eggs=0, total_examined=0, method_version=revised.pk
        ),
    )
    assert (unavailable.status, unavailable.body["code"]) == (409, "lab_method_unverified")
    simple = execute_lab_command(context.actor, count_input(context, later_bag, 0))
    assert simple.status == 201
    assert simple.body["count"]["method"] is None


def test_reasoned_rejection_binds_verified_evidence_and_void_replacement_retains_qa(
    monkeypatch, make_member
):
    from core.exceptions import FieldValidationError
    from lab.models import LabRejection, LabResultVoid, RecountRequestSupersession
    from lab.permissions import ADMIN_CODES
    from tests.lab_support import actor_with_codes
    from uploads.models import AttachmentLink

    context = lab_context(monkeypatch)
    collector = context.actor
    context.actor = actor_with_codes(context, make_member, (*ADMIN_CODES, "field.upload"))
    method = synthetic_method(context)
    bag = capture_bag(context, has_eggs=False)
    counter = context.actor
    receiver = actor_with_codes(context, make_member, ("bag.receive",))
    context.actor = receiver
    receive(context, bag)
    context.actor = counter
    count = execute_lab_command(context.actor, count_input(context, bag, 1))
    original = EggCountAttempt.objects.get()
    assert original.created_by_id != bag.collector_id
    context.actor = actor_with_codes(
        context,
        make_member,
        ("egg_count.void", "egg_count.create", "lab_rejection.create", "field.upload"),
    )
    assert context.actor.user.pk not in {collector.user.pk, original.created_by_id}
    assert len({collector.user.pk, receiver.user.pk, counter.user.pk, context.actor.user.pk}) == 4
    assert original.receipt.created_by_id == receiver.user.pk
    with pytest.raises(FieldValidationError) as invalid_note:
        command(
            context,
            "void_count",
            LabTarget("count", original.pk),
            {"expected_revision": 1, "reason_code": "data-entry-error", "reason": "short"},
        )
    assert invalid_note.value.fields == {
        "reason": [{"code": "void_reason_too_short", "params": {"min_length": 10}}]
    }
    assert not LabResultVoid.objects.exists()
    voided = command(
        context,
        "void_count",
        LabTarget("count", original.pk),
        {
            "expected_revision": 1,
            "reason_code": "data-entry-error",
            "reason": " \r\nCorrect authored observation  ",
            "replacement": {"kind": "count", "value": 0, "confirmed_implausible": False},
        },
    )
    assert voided.status == 200
    assert LabResultVoid.objects.get().reason == "Correct authored observation"
    assert LabResultVoid.objects.get().reason_code == "data-entry-error"
    replacement = EggCountAttempt.objects.get(pk=voided.body["count"]["id"])
    assert replacement.replacement_of_id == original.pk
    assert original.value == 1
    assert set(replacement.recount_request.causes.values_list("kind", flat=True)) == {
        "carried_obligation"
    }
    assert (
        RecountRequestSupersession.objects.get(request=original.recount_request).replacement_id
        == replacement.recount_request.pk
    )
    command(
        context,
        "void_count",
        LabTarget("count", replacement.pk),
        {
            "expected_revision": 2,
            "reason_code": "other",
            "reason": "Retain rejected material history",
        },
    )
    # A pending QA obligation cannot be silently replaced by a rejection.
    upload = verified_upload(context.actor.organization, context.actor.user)
    rejected = command(
        context,
        "reject",
        LabTarget("bag", bag.pk),
        {
            "expected_revision": 3,
            "method_version": method.pk,
            "reason": "Synthetic reasoned laboratory rejection",
            "evidence_ids": [upload.public_id],
        },
    )
    assert rejected.status == 409
    assert rejected.body["code"] == "lab_recount_dependency"
    assert not LabRejection.objects.exists()
    assert not AttachmentLink.objects.filter(upload=upload).exists()
    assert LabResultVoid.objects.count() == 2
    assert count.body["count"]["value"] == 1


def test_rejection_is_distinct_from_zero_and_exact_parent_survives_void(monkeypatch, make_member):
    from field_sync.models import CourierChange
    from lab.evidence import authorize_rejection_download
    from lab.models import LabBlindObservation, LabRejection
    from lab.permissions import ADMIN_CODES
    from tests.lab_support import actor_with_codes
    from uploads.models import AttachmentLink

    context = lab_context(monkeypatch)
    collector = context.actor
    context.actor = actor_with_codes(context, make_member, (*ADMIN_CODES, "field.upload"))
    method = synthetic_method(context)
    bag = capture_bag(context)
    receive(context, bag)
    upload = verified_upload(context.actor.organization, context.actor.user)
    outcome = command(
        context,
        "reject",
        LabTarget("bag", bag.pk),
        {
            "expected_revision": 0,
            "method_version": method.pk,
            "reason": "Synthetic rejected sample integrity",
            "evidence_ids": [upload.public_id],
        },
    )
    assert outcome.status == 201
    target = LabRejection.objects.get(pk=outcome.body["rejection"]["id"])
    assert not EggCountAttempt.objects.exists()
    assert not current_lab_queue(context.actor, {}).exists()
    assert AttachmentLink.objects.get(upload=upload).lab_rejection_id == target.pk
    assert authorize_rejection_download(context.actor, target.pk) is None
    assert target.created_by_id != bag.collector_id
    context.actor = actor_with_codes(context, make_member, ("egg_count.void", "egg_count.create"))
    assert context.actor.user.pk not in {collector.user.pk, target.created_by_id}
    corrected = command(
        context,
        "void_rejection",
        LabTarget("rejection", target.pk),
        {
            "expected_revision": 1,
            "reason_code": "other",
            "reason": "Preserve original rejection evidence",
            "replacement": {"kind": "count", "value": 0, "confirmed_implausible": False},
        },
    )
    assert corrected.status == 200
    assert not LabBlindObservation.objects.filter(count__bag=bag).exists()
    assert LabRejection.objects.get(pk=target.pk).reason == target.reason
    assert AttachmentLink.objects.get(upload=upload).lab_rejection_id == target.pk
    history = (
        CourierChange.objects.filter(
            resource_type="history.lab_rejection", resource_id=str(target.pk)
        )
        .order_by("sequence")
        .last()
    )
    assert history.payload["voided"] is True
    void_history = CourierChange.objects.get(resource_type="history.lab_void").payload
    assert void_history["rejection_id"] == str(target.pk)
    assert void_history["count_id"] is None
