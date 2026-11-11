"""Where the courier signs a delivery: each mode, and a second signature (no database needed)."""

import pytest

from inventory.allocations.signature_mode import (
    CHANNEL_PHONE,
    CHANNEL_WAREHOUSE,
    MODES,
    check_signature_channel,
    signature_facts,
    signature_proof,
)
from inventory.exceptions import InventoryConflictError


def test_the_rule_values_are_the_documented_modes():
    assert MODES == {0: "either", 1: "warehouse", 2: "phone"}


def test_warehouse_mode_needs_the_signature_on_the_warehouse_screen():
    check_signature_channel("warehouse", True)
    with pytest.raises(InventoryConflictError) as error:
        check_signature_channel("warehouse", False)
    assert error.value.blocked_by[0]["reason"] == "supply_signature_required"


def test_phone_mode_refuses_a_warehouse_signature_but_accepts_waiting():
    check_signature_channel("phone", False)
    with pytest.raises(InventoryConflictError) as error:
        check_signature_channel("phone", True)
    assert error.value.blocked_by[0]["reason"] == "supply_signature_channel_not_allowed"


@pytest.mark.parametrize("has_signature", [True, False])
def test_either_mode_accepts_both_ways(has_signature):
    check_signature_channel("either", has_signature)


def test_a_release_records_the_channel_only_when_it_carries_a_signature():
    declared = [{"role": "signature", "upload_id": "u1"}]
    assert signature_proof(declared, "user-1") == {
        "channel": CHANNEL_WAREHOUSE,
        "captured_by": "user-1",
    }
    assert signature_proof([{"role": "photo", "upload_id": "u2"}], "user-1") is None
    assert signature_proof([], "user-1") is None


def test_the_first_signature_completes_it_and_a_later_phone_one_does_not_replace_it():
    warehouse = {"signature": {"channel": CHANNEL_WAREHOUSE, "captured_by_name": "Ana"}}
    first = signature_facts(warehouse, None)
    assert first == {"state": "signed", "channel": CHANNEL_WAREHOUSE, "captured_by": "Ana"}
    # The courier's phone receipt arrives afterwards: the recorded signature stays the same.
    assert signature_facts(warehouse, "Carlos") == first


def test_without_a_warehouse_signature_the_phone_receipt_completes_it():
    assert signature_facts({}, None) == {
        "state": "pending_phone",
        "channel": None,
        "captured_by": None,
    }
    assert signature_facts({}, "Carlos") == {
        "state": "signed",
        "channel": CHANNEL_PHONE,
        "captured_by": "Carlos",
    }
