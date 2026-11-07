"""The new typed history branch uses the actual bootstrap/change serializer."""

from uuid import uuid4

import pytest

from reviews.history_serializers import CourierHistoryEntrySerializer


def test_relocation_history_round_trips_without_fabricated_review_fields():
    payload = {
        "kind": "relocation_proposal",
        "id": str(uuid4()),
        "proposal_event_id": str(uuid4()),
        "point_id": str(uuid4()),
        "point_code": "P-B33",
        "status": "pending",
        "proposed_location": [-99.99, 20.005],
        "decision": None,
        "next_day_task": None,
        "source_voided_at": None,
        "subjects": [{"center_id": str(uuid4()), "quadrant_id": str(uuid4())}],
    }
    serializer = CourierHistoryEntrySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    assert serializer.data == payload
    assert "review_item_id" not in serializer.data
    assert "shift_id" not in serializer.data


@pytest.mark.parametrize(
    "mutation",
    [{"kind": "invented_history"}, {"proposal_event_id": "not-a-uuid"}, {"subjects": []}],
)
def test_invalid_shared_history_cannot_enter_either_delivery_contract(mutation):
    payload = {
        "kind": "relocation_proposal",
        "id": str(uuid4()),
        "proposal_event_id": str(uuid4()),
        "point_id": str(uuid4()),
        "point_code": "P-B33",
        "status": "pending",
        "proposed_location": [-99.99, 20.005],
        "decision": None,
        "next_day_task": None,
        "source_voided_at": None,
        "subjects": [{"center_id": str(uuid4()), "quadrant_id": str(uuid4())}],
    }
    serializer = CourierHistoryEntrySerializer(data=payload | mutation)
    assert not serializer.is_valid()


def test_transfer_history_uses_event_identity_without_invented_review_or_shift_fields():
    payload = {
        "kind": "transfer_custody",
        "id": str(uuid4()),
        "transfer_id": str(uuid4()),
        "transfer_code": "SYNTHETIC-TRANSFER",
        "phase": "receive",
        "revision": 3,
        "manifest_hash": "a" * 64,
        "source_event_id": str(uuid4()),
        "source_status": "in_review",
        "source_code": "causal_parent_pending",
        "voided_at": None,
        "subjects": [{"center_id": str(uuid4()), "quadrant_id": None}],
    }
    serializer = CourierHistoryEntrySerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    assert serializer.data == payload
    assert payload["id"] != payload["transfer_id"]
    assert "review_item_id" not in serializer.data
    assert "shift_id" not in serializer.data
