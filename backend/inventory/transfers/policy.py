"""Pure signed-quantity, scan identity and complete resolution partition rules."""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

STOCK_QUANTUM = Decimal("0.000001")
MAX_STOCK_QUANTITY = Decimal("99999999999999.999999")
RESOLUTION_KINDS = frozenset(
    {"ack_missing", "recover_dest", "return_origin", "reference_signed_correction"}
)


class TransferPolicyError(ValueError):
    """A stable domain reason, mapped by the caller without exposing raw input."""


def json_facts(value: Any) -> Any:  # noqa: ANN401 -- closed validated JSON command/manifests
    if isinstance(value, dict):
        return {str(key): json_facts(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_facts(item) for item in value]
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def stock_quantity(value: Any) -> Decimal:  # noqa: ANN401 -- validated wire Decimal/string boundary
    if isinstance(value, (float, bool)):
        raise TransferPolicyError("transfer_quantity_invalid")
    try:
        quantity = Decimal(value)
        valid = quantity.is_finite() and 0 < quantity <= MAX_STOCK_QUANTITY
        if not valid or quantity.quantize(STOCK_QUANTUM) != quantity:
            raise TransferPolicyError("transfer_quantity_invalid")
    except (InvalidOperation, TypeError, ValueError) as error:
        raise TransferPolicyError("transfer_quantity_invalid") from error
    return quantity


@dataclass(frozen=True)
class ScanReconciliation:
    received: dict[str, Decimal]
    missing: dict[str, Decimal]
    extras: tuple[dict[str, Any], ...]
    duplicates: tuple[str, ...]


def _scan_digest(scan: Mapping[str, Any]) -> str:
    normalized = {**scan, "quantity": str(stock_quantity(scan["quantity"]).normalize())}
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"), default=str)


def reconcile_scans(
    expected: Sequence[Mapping[str, Any]], scanned: Sequence[Mapping[str, Any]]
) -> ScanReconciliation:
    lines = {str(line["id"]): line for line in expected}
    quantities: dict[str, Decimal] = {}
    seen: dict[str, str] = {}
    pieces: set[str] = set()
    extras, duplicates = [], []
    for scan in scanned:
        scan_id, digest = str(scan["scan_id"]), _scan_digest(scan)
        if scan_id in seen:
            if seen[scan_id] != digest:
                raise TransferPolicyError("transfer_scan_conflict")
            duplicates.append(scan_id)
            continue
        seen[scan_id] = digest
        line = _expected_line(lines, scan)
        piece = (line or scan).get("piece_id")
        if piece and stock_quantity(scan["quantity"]) != 1:
            raise TransferPolicyError("transfer_scan_conflict")
        if piece and str(piece) in pieces:
            duplicates.append(scan_id)
            continue
        if line is None:
            extras.append(dict(scan))
        else:
            key = str(line["id"])
            quantities[key] = quantities.get(key, Decimal(0)) + stock_quantity(scan["quantity"])
        if piece:
            pieces.add(str(piece))
    return _reconciliation(lines, quantities, (extras, duplicates))


def _expected_line(
    lines: Mapping[str, Mapping[str, Any]], scan: Mapping[str, Any]
) -> Mapping[str, Any] | None:
    if scan["kind"] != "expected":
        return None
    line = lines.get(str(scan["line_id"]))
    if line is None or (line.get("piece_id") and stock_quantity(scan["quantity"]) != 1):
        raise TransferPolicyError("transfer_scan_conflict")
    return line


def _reconciliation(
    lines: Mapping[str, Mapping[str, Any]],
    quantities: Mapping[str, Decimal],
    feedback: tuple[list[dict[str, Any]], list[str]],
) -> ScanReconciliation:
    received, missing = {}, {}
    extras = list(feedback[0])
    for key, line in lines.items():
        expected, actual = stock_quantity(line["quantity"]), quantities.get(key, Decimal(0))
        if actual:
            received[key] = min(expected, actual)
        if actual < expected:
            missing[key] = expected - actual
        if actual > expected:
            extras.append(
                {
                    "kind": "identified_extra",
                    "lot_id": str(line["lot_id"]),
                    "piece_id": line.get("piece_id"),
                    "quantity": str(actual - expected),
                    "unit_version_id": str(line["unit_version_id"]),
                }
            )
    return ScanReconciliation(received, missing, tuple(extras), tuple(feedback[1]))


def partition_outcomes(
    outstanding: Mapping[str, Decimal], outcomes: Sequence[Mapping[str, Any]]
) -> None:
    totals: dict[str, Decimal] = {}
    seen = set()
    for outcome in outcomes:
        key, kind = str(outcome["line_id"]), outcome["kind"]
        if kind not in RESOLUTION_KINDS or (key, kind) in seen or key not in outstanding:
            raise TransferPolicyError("transfer_resolution_incomplete")
        seen.add((key, kind))
        totals[key] = totals.get(key, Decimal(0)) + stock_quantity(outcome["quantity"])
    if dict(outstanding) != totals:
        raise TransferPolicyError("transfer_resolution_incomplete")
