"""Transfer rules once at the pure layer; database boundaries have separate owners."""

from decimal import Decimal

import pytest

from organizations.scope import EffectiveScope, safe_scope

CENTER_A = "00000000-0000-0000-0000-000000000001"
CENTER_B = "00000000-0000-0000-0000-000000000002"
PIECE = "00000000-0000-0000-0000-000000000003"


def grant(*centers):
    return (
        frozenset({"transfer.dispatch"}),
        safe_scope(
            {
                "centers": {"mode": "selected", "ids": list(centers)},
                "quadrants": {"mode": "none", "ids": []},
            }
        ),
    )


@pytest.mark.parametrize(
    ("bindings", "allowed"),
    [
        ((grant(CENTER_A), grant(CENTER_B)), False),
        ((grant(CENTER_A, CENTER_B),), True),
        ((), False),
    ],
)
def test_transfer_requires_one_binding_for_the_complete_endpoint_vector(bindings, allowed):
    from inventory.transfers.scope import allows_transfer_vector

    contexts = (
        {"center_id": CENTER_A, "quadrant_id": None},
        {"center_id": CENTER_B, "quadrant_id": None},
    )
    assert (
        allows_transfer_vector(EffectiveScope(bindings), "transfer.dispatch", contexts) is allowed
    )
    assert not allows_transfer_vector(EffectiveScope(bindings), "transfer.dispatch", ())
    assert not allows_transfer_vector(
        EffectiveScope(bindings),
        "transfer.dispatch",
        (*contexts, {"center_id": "00000000-0000-0000-0000-000000000004", "quadrant_id": None}),
    )
    assert not allows_transfer_vector(
        EffectiveScope(bindings), "transfer.dispatch", ({"center_id": None, "quadrant_id": None},)
    )


def test_receipt_scan_repeats_never_count_a_piece_twice_and_unknown_extra_never_credits():
    from inventory.transfers.policy import reconcile_scans

    expected = [
        {
            "id": "line",
            "lot_id": "lot",
            "piece_id": PIECE,
            "quantity": "1",
            "unit_version_id": "unit",
        }
    ]
    scans = [
        {"kind": "expected", "scan_id": "first", "line_id": "line", "quantity": "1"},
        {"kind": "expected", "scan_id": "second", "line_id": "line", "quantity": "1"},
        {
            "kind": "unidentified_extra",
            "scan_id": "extra",
            "unidentified_code": "UNKNOWN",
            "quantity": "2",
        },
    ]
    result = reconcile_scans(expected, scans)
    assert result.received == {"line": Decimal("1")}
    assert result.duplicates == ("second",)
    assert result.missing == {}
    assert len(result.extras) == 1
    assert result.extras[0]["kind"] == "unidentified_extra"


def test_same_scan_id_with_changed_quantity_conflicts_instead_of_silent_dedup():
    from inventory.transfers.policy import TransferPolicyError, reconcile_scans

    expected = [
        {
            "id": "line",
            "lot_id": "lot",
            "piece_id": None,
            "quantity": "5",
            "unit_version_id": "unit",
        }
    ]
    scan = {"kind": "expected", "scan_id": "first", "line_id": "line", "quantity": "1"}
    with pytest.raises(TransferPolicyError, match="transfer_scan_conflict"):
        reconcile_scans(expected, [scan, {**scan, "quantity": "2"}])


def test_extra_piece_is_an_observation_once_even_with_distinct_scan_ids():
    from inventory.transfers.policy import reconcile_scans

    extra = {
        "kind": "identified_extra",
        "scan_id": "first",
        "lot_id": "other",
        "piece_id": PIECE,
        "quantity": "1",
        "unit_version_id": "unit",
    }
    result = reconcile_scans([], [extra, {**extra, "scan_id": "second"}])
    assert result.received == {}
    assert len(result.extras) == 1
    assert result.duplicates == ("second",)


@pytest.mark.parametrize("quantity", ["0", "-1", "NaN", "1.0000001"])
def test_unrepresentable_or_nonpositive_stock_quantity_cannot_enter_a_signed_manifest(quantity):
    from inventory.transfers.policy import TransferPolicyError, stock_quantity

    with pytest.raises(TransferPolicyError, match="transfer_quantity_invalid"):
        stock_quantity(quantity)


def test_resolution_outcomes_must_partition_each_outstanding_line_exactly():
    from inventory.transfers.policy import TransferPolicyError, partition_outcomes

    outcomes = [
        {"line_id": "missing", "kind": "recover_dest", "quantity": "1.5"},
        {"line_id": "missing", "kind": "ack_missing", "quantity": "0.5"},
    ]
    partition_outcomes({"missing": Decimal("2")}, outcomes)
    with pytest.raises(TransferPolicyError, match="transfer_resolution_incomplete"):
        partition_outcomes({"missing": Decimal("2")}, outcomes[:1])
    with pytest.raises(TransferPolicyError, match="transfer_resolution_incomplete"):
        partition_outcomes({"missing": Decimal("1")}, outcomes)


def test_closed_wire_rejects_unknown_credit_fields_and_keeps_decimal_exact():
    from uuid import uuid4

    from inventory.transfers.serializers import (
        ClosedOutcomeSerializer,
        ClosedScanSerializer,
        ReceiveTransferSerializer,
    )

    row = {
        "kind": "unidentified_extra",
        "scan_id": str(uuid4()),
        "unidentified_code": "SYNTHETIC-UNPROVEN",
        "quantity": "99999999999999.999999",
    }
    payload = {
        "command_id": str(uuid4()),
        "expected_revision": 2,
        "signature_upload_id": str(uuid4()),
        "scanned": [row],
        "missing": [],
        "evidence_ids": [],
    }
    serializer = ReceiveTransferSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["scanned"][0]["quantity"] == Decimal("99999999999999.999999")
    invalid = ReceiveTransferSerializer(
        data={**payload, "scanned": [{**row, "lot_id": str(uuid4())}]}
    )
    assert not invalid.is_valid()
    correction = ClosedOutcomeSerializer(
        data={
            "kind": "invented_credit",
            "line_id": str(uuid4()),
            "quantity": "1",
            "location_id": str(uuid4()),
        }
    )
    assert not correction.is_valid()
    for closed_union in (ClosedScanSerializer, ClosedOutcomeSerializer):
        for kind in ([], {}):
            malformed = closed_union(data={"kind": kind})
            assert not malformed.is_valid()
            assert malformed.errors == {"kind": ["invalid_choice"]}
