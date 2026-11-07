"""Lab uses one real history receipt and current subject scope before download limits."""

from uuid import UUID

import pytest

from field_sync.models import CourierChange
from field_sync.permissions import FIELD_BOOTSTRAP
from field_sync.producers import ProducerContext
from lab.access import LabTarget
from lab.commands import execute_lab_command
from organizations.models import default_scope
from organizations.services import effective_scope
from reviews.history import build_history
from reviews.models import HistoryPublicationReceipt
from tests.lab_support import AT, capture_bag, command, count_input, lab_context, receive


@pytest.mark.django_db
def test_lab_history_preserves_real_source_identity_and_current_scope_before_limit(
    monkeypatch, make_member
):
    from tests.lab_support import actor_with_codes

    context = lab_context(monkeypatch)
    context.actor = actor_with_codes(
        context, make_member, ("bag.receive", "egg_count.create", "egg_count.void")
    )
    bag = capture_bag(context, has_eggs=False)
    receipt = receive(context, bag)
    request = count_input(context, bag, 1)
    counted = execute_lab_command(context.actor, request)
    execute_lab_command(context.actor, request)
    assert HistoryPublicationReceipt.objects.filter(cause_kind="lab_count").count() == 1
    payload = CourierChange.objects.get(resource_type="history.lab_count").payload
    assert payload["source_event_id"] == str(bag.event_id)
    assert payload["reading_id"] == str(bag.reading_id)
    assert payload["author_id"] == str(context.actor.user.pk)
    assert payload["count_id"] == counted.body["count"]["id"]
    assert payload["rejection_id"] is None
    assert payload["voided"] is False
    assert payload["qa_state"] == "awaiting_independent_qa"
    assert receipt.body["receipt"]["reading_id"] == str(bag.reading_id)
    producer = ProducerContext(
        context.actor.organization,
        context.field.batch.user,
        effective_scope(context.field.membership),
        AT,
        FIELD_BOOTSTRAP,
    )
    assert build_history(producer) == []
    command(
        context,
        "void_count",
        LabTarget("count", UUID(counted.body["count"]["id"])),
        {
            "expected_revision": 1,
            "reason_code": "other",
            "reason": "Preserve old QA obligation after void",
        },
    )
    versions = CourierChange.objects.filter(resource_type="history.lab_count").order_by("sequence")
    assert versions.last().payload["qa_state"] == "superseded"
    assert versions.last().payload["voided"] is True
    assert versions.last().payload["count_id"] == payload["count_id"]
    assert versions.first().payload == payload
    void_payload = CourierChange.objects.get(resource_type="history.lab_void").payload
    assert void_payload["count_id"] == payload["count_id"]
    assert void_payload["rejection_id"] is None
    context.field.profile.permission_codes += [FIELD_BOOTSTRAP]
    context.field.profile.save(update_fields=["permission_codes"])
    producer = ProducerContext(
        context.actor.organization,
        context.field.batch.user,
        effective_scope(context.field.membership),
        AT,
        FIELD_BOOTSTRAP,
    )
    latest_count = next(row for row in build_history(producer) if row["kind"] == "lab_count")
    assert latest_count["qa_state"] == "superseded"
    assert latest_count["voided"] is True
    context.field.membership.scope = default_scope()
    context.field.membership.save(update_fields=["scope"])
    producer = ProducerContext(
        context.actor.organization,
        context.field.batch.user,
        effective_scope(context.field.membership),
        AT,
        FIELD_BOOTSTRAP,
    )
    assert list(build_history(producer)) == []
