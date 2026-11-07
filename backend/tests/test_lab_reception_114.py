"""Real reception parents, source effectiveness and durable configuration recovery."""

from uuid import uuid4

import pytest

from lab.access import LabTarget
from lab.models import BagReceipt, ReceptionDiscrepancy, ReceptionIncidentLink
from lab.queue import current_lab_queue
from tests.lab_support import capture_bag, command, lab_context, receive

pytestmark = pytest.mark.django_db


def test_receipt_is_continuous_exactly_once_and_no_paddle_is_real_reading_only(monkeypatch):
    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    identifier = uuid4()
    first = command(context, "receive", LabTarget("bag", bag.pk), command_id=identifier)
    assert first.status == 200
    again = command(context, "receive", LabTarget("bag", bag.pk), command_id=identifier)
    assert again.replayed is True
    assert again.body == first.body
    assert receive(context, bag).body["code"] == "already_received"
    reading = capture_bag(context, None, paddle_present=False, has_eggs=None)
    missing_paddle = command(context, "receive_reading", LabTarget("reading", reading.pk))
    assert missing_paddle.status == 200
    assert missing_paddle.body["bag"] is None
    assert BagReceipt.objects.get(reading=reading).bag_id is None
    assert list(current_lab_queue(context.actor, {}).values_list("pk", flat=True)) == [bag.pk]
    assert BagReceipt.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_expected_missing_retains_pending_cause_and_real_policy_recovers_one_case(
    monkeypatch, api_client, make_member
):
    from datetime import timedelta

    from incidents.configuration import write_type
    from incidents.models import AutomaticIncidentOrigin, Incident
    from lab.models import ReceptionIncidentPolicyVersion
    from lab.tasks import recover_reception_incidents
    from tests.lab_support import actor_with_codes

    context = lab_context(monkeypatch)
    collector = context.actor
    context.actor = actor_with_codes(context, make_member, ("bag.receive",))
    bag = capture_bag(context)
    pending = command(
        context,
        "missing",
        LabTarget("bag", bag.pk),
        {"reason": "Expected physical paddle was not received"},
    )
    assert pending.status == 409
    assert pending.body["code"] == "lab_configuration_unavailable"
    discrepancy = ReceptionDiscrepancy.objects.get()
    assert discrepancy.created_by_id != bag.collector_id
    context.actor = collector
    assert not Incident.objects.exists()
    kind = write_type(
        context.actor,
        {
            "code": "lab-reception-synthetic",
            "label": "Synthetic lab reception discrepancy",
            "severity": "high",
            "terminal_id": context.member.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 60,
            "report_evidence_min": 0,
            "close_evidence_min": 1,
            "blocker_kinds": [],
        },
    )
    values = {
        "expected_revision": 0,
        "missing_type_version": str(kind.pk),
        "no_reading_type_version": str(kind.pk),
    }
    api_client.force_authenticate(context.actor.user)
    endpoint = "/api/v1/lab-reception-incident-policy/versions/"
    published = api_client.post(endpoint, values, format="json")
    assert published.status_code == 201
    policy = ReceptionIncidentPolicyVersion.objects.get(pk=published.data["id"])
    stale = api_client.post(endpoint, values, format="json")
    assert (stale.status_code, stale.data["code"]) == (409, "lab_state_conflict")
    foreign = api_client.post(
        endpoint,
        {**values, "expected_revision": 1, "missing_type_version": str(uuid4())},
        format="json",
    )
    assert foreign.status_code == 404
    assert ReceptionIncidentPolicyVersion.objects.count() == 1
    assert recover_reception_incidents.run() == 1
    assert recover_reception_incidents.run() == 0
    link = ReceptionIncidentLink.objects.get(discrepancy=discrepancy)
    assert link.policy_id == policy.pk
    assert link.actor_kind == "system"
    assert link.created_by_id is None
    assert link.incident.source_event_id is None
    assert AutomaticIncidentOrigin.objects.get(incident=link.incident).source_id == discrepancy.pk
    repeated = command(
        context, "missing", LabTarget("bag", bag.pk), {"reason": "Same unchanged missing cause"}
    )
    assert repeated.body["incident_id"] == str(link.incident_id)
    assert ReceptionDiscrepancy.objects.count() == Incident.objects.count() == 1
    later_bag = capture_bag(context, "LATER-DISCREPANCY")
    monkeypatch.setattr(
        "django.utils.timezone.now", lambda: discrepancy.created_at + timedelta(minutes=1)
    )
    later_outcome = command(
        context,
        "missing",
        LabTarget("bag", later_bag.pk),
        {"reason": "A separate later authorized missing paddle"},
    )
    later = ReceptionDiscrepancy.objects.get(pk=later_outcome.body["discrepancy_id"])
    assert later.created_by_id != discrepancy.created_by_id
    assert later.created_at > discrepancy.created_at
    collection = "/api/v1/lab-reception-discrepancies/"
    for filters, expected in (
        (
            {
                "author": discrepancy.created_by_id,
                "created_from": discrepancy.created_at.isoformat(),
                "created_before": later.created_at.isoformat(),
            },
            [str(discrepancy.pk)],
        ),
        ({"created_from": later.created_at.isoformat()}, [str(later.pk)]),
        ({"created_before": later.created_at.isoformat()}, [str(discrepancy.pk)]),
        ({"author": discrepancy.created_by_id, "created_from": later.created_at.isoformat()}, []),
    ):
        page = api_client.get(collection, {**filters, "page_size": 1, "ordering": "created_at"})
        assert page.status_code == 200
        assert page.data["count"] == len(expected)
        assert [row["id"] for row in page.data["results"]] == expected


def test_known_voided_source_records_no_reading_without_inventing_another_parent(monkeypatch):
    from field_sync.models import FieldEvent

    context = lab_context(monkeypatch)
    bag = capture_bag(context)
    source = bag.event
    original_receipt = receive(context, bag).body["receipt"]["id"]
    # Canonical permitted source-void fields; no current Lab result exists.
    FieldEvent.objects.filter(pk=source.pk).update(
        voided_at=source.server_received_at,
        voided_by=context.actor.user,
        void_reason="Synthetic source correction",
        void_reason_code="other",
    )
    bag.refresh_from_db()
    result = receive(context, bag)
    assert result.status == 409
    assert result.body["code"] == "lab_configuration_unavailable"
    assert ReceptionDiscrepancy.objects.get().kind == "no_reading"
    assert str(BagReceipt.objects.get(reading=bag.reading).pk) == original_receipt
    assert not current_lab_queue(context.actor, {}).exists()
    assert receive(context, bag).body["discrepancy_id"] == result.body["discrepancy_id"]


def test_lab_consumes_canonical_legacy_effect_receipt_without_rewriting_ingest(
    monkeypatch, make_member
):
    from types import SimpleNamespace

    from ovitraps.models import Bag
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewEffectReceipt
    from tests.ovitrap_support import make_point
    from tests.review_support import audit_current_membership, reviewer
    from tests.test_review_legacy_113 import _legacy_capture

    context = lab_context(monkeypatch)
    audit_current_membership(context.member)
    field = SimpleNamespace(
        **{
            **vars(context.field),
            "point": make_point(context.field.point.block.quadrant, "LAB-LEGACY-P"),
            "identity": uuid4(),
        }
    )
    item = _legacy_capture(field, "check")
    bag = Bag.objects.get(event=item.field_event)
    before = (
        item.field_event.status,
        item.field_event.payload_sha256,
        item.field_event.device_time,
        item.field_event.server_received_at,
    )
    blocked = receive(context, bag)
    assert (blocked.status, blocked.body["code"]) == (409, "lab_configuration_unavailable")
    assert not BagReceipt.objects.filter(bag=bag).exists()
    actor = reviewer(context.actor.organization, make_member)
    decision = decide_review(
        actor,
        item.pk,
        ReviewDecisionRequest(
            "accept", 0, "Verified authentic retained source and original capture proof"
        ),
    )
    assert ReviewEffectReceipt.objects.get(decision=decision).mode == "adopted_legacy"
    item.field_event.refresh_from_db()
    assert before == (
        item.field_event.status,
        item.field_event.payload_sha256,
        item.field_event.device_time,
        item.field_event.server_received_at,
    )
    received = receive(context, bag)
    assert received.status == 200
    assert BagReceipt.objects.get(bag=bag).source_id == item.field_event_id
