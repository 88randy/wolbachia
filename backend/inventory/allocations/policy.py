"""Exact credited custody; a planned quantity and a declaration are not stock."""

from dataclasses import dataclass
from decimal import Decimal

from rest_framework.exceptions import ErrorDetail, ValidationError

from core.validation import params_message
from core.void_reason import validate_void_reason, visible_length


def validate_supply_note(reason: str, field: str = "reason") -> str:
    """Use the common normalization; B10 retains a ten-visible-character floor for every code."""
    cleaned = validate_void_reason(reason, field=field)
    if visible_length(cleaned) < 10:
        raise ValidationError(
            {field: [ErrorDetail(params_message({"min_length": 10}), code="void_reason_too_short")]}
        )
    return cleaned


class SupplyPolicyError(ValueError):
    """A closed B10 domain reason, translated at the HTTP or source boundary."""


@dataclass(frozen=True)
class QuantityFrame:
    planned: Decimal
    credited: Decimal | None
    used: Decimal = Decimal(0)
    returned: Decimal = Decimal(0)
    shrinkage: Decimal = Decimal(0)


@dataclass(frozen=True)
class ReconciliationEquation:
    remaining: Decimal | None
    delivery_variance: Decimal | None


def reconciliation_equation(frame: QuantityFrame) -> ReconciliationEquation:
    """Keep unknown receipt distinct from zero; debit only actual credited custody."""
    debited = frame.used + frame.returned + frame.shrinkage
    if frame.credited is None:
        if debited:
            raise SupplyPolicyError("supply_receipt_required")
        return ReconciliationEquation(None, None)
    remaining = frame.credited - debited
    if remaining < 0:
        raise SupplyPolicyError("supply_insufficient_custody")
    return ReconciliationEquation(remaining, frame.planned - frame.credited)
