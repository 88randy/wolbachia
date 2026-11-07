"""Closed LOCAL-day real population frames, deterministic supplement and durable requests."""

from datetime import timedelta
from zoneinfo import ZoneInfo

import pytest

from lab.access import LabTarget
from lab.commands import execute_lab_command
from lab.models import DailyRecountSample, DailyRecountSampleMember, RecountRequest
from lab.recounts import ClosedDayInput, close_lab_day
from tests.lab_support import AT, capture_bag, command, count_input, lab_context, receive

pytestmark = pytest.mark.django_db


def test_closed_day_snapshot_requests_exact_selection_and_recovers_without_duplicate(
    monkeypatch, make_member
):
    from tests.lab_support import actor_with_codes

    context = lab_context(monkeypatch)
    context.actor = actor_with_codes(
        context, make_member, ("bag.receive", "egg_count.create", "egg_count.void")
    )
    counter = context.actor
    receiver = actor_with_codes(context, make_member, ("bag.receive",))
    first = capture_bag(context, "DAY-FIRST", has_eggs=False)
    context.actor = receiver
    receive(context, first)
    context.actor = counter
    counted = execute_lab_command(context.actor, count_input(context, first, 1))
    second = capture_bag(context, "DAY-SECOND")
    context.actor = receiver
    receive(context, second)
    context.actor = counter
    execute_lab_command(context.actor, count_input(context, second, 0))
    closed_now = AT + timedelta(days=1)
    monkeypatch.setattr("lab.recounts.server_now", lambda: closed_now)
    monkeypatch.setattr("django.utils.timezone.now", lambda: closed_now)
    local_day = AT.astimezone(ZoneInfo(context.actor.organization.timezone)).date()
    outcome = close_lab_day(ClosedDayInput(context.actor.organization, local_day))
    assert (outcome.created, outcome.population, outcome.quota) == (True, 2, 1)
    sample = DailyRecountSample.objects.get(pk=outcome.sample_id)
    assert sample.timezone == context.actor.organization.timezone
    members = DailyRecountSampleMember.objects.filter(sample=sample)
    assert members.count() == 2
    chosen = members.get(selected=True)
    request = RecountRequest.objects.get(count=chosen.count)
    assert request.causes.filter(kind="daily_sample", proof__sample_id=str(sample.pk)).exists()
    assert request.first_counter_id == chosen.count.created_by_id
    assert request.first_counter_id != chosen.count.bag.collector_id
    assert request.first_counter_id != chosen.count.receipt.created_by_id
    repeated = close_lab_day(ClosedDayInput(context.actor.organization, local_day))
    assert repeated.sample_id == sample.pk
    assert repeated.created is False
    assert DailyRecountSample.objects.count() == 1
    assert RecountRequest.objects.filter(count_id=counted.body["count"]["id"]).count() == 1
    old_count_id = chosen.count_id
    voided = command(
        context,
        "void_count",
        LabTarget("count", old_count_id),
        {
            "expected_revision": 1,
            "reason_code": "other",
            "reason": "Preserve the selected original observation",
        },
    )
    assert voided.status == 200
    supplemental = close_lab_day(ClosedDayInput(context.actor.organization, local_day))
    assert (supplemental.created, supplemental.population, supplemental.quota) == (True, 1, 1)
    replacement_member = DailyRecountSampleMember.objects.get(
        sample_id=supplemental.sample_id, selected=True
    )
    assert replacement_member.count_id != old_count_id
    assert DailyRecountSampleMember.objects.filter(sample=sample).count() == 2
    assert RecountRequest.objects.get(count_id=old_count_id).supersession.replacement_id is None
    assert (
        RecountRequest.objects.get(count_id=replacement_member.count_id)
        .causes.filter(kind="daily_sample")
        .exists()
    )
