"""Pure safety decisions; every threshold comes from explicit persisted facts."""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

MAX_PIECES_PER_ADMISSION = 10_000
SQL_BATCH_SIZE = 500
BIOLOGICAL_FIELDS = ("species", "strain", "generation", "laid_on", "estimated_organism_count")


@dataclass(frozen=True)
class Protocol:
    name: str
    temperature_min: Decimal | None
    temperature_max: Decimal | None
    humidity_min: Decimal | None
    humidity_max: Decimal | None
    windows: tuple[tuple[int, int], ...]

    @property
    def has_ranges(self) -> bool:
        return bool(self.name) and all(
            value is not None
            for value in (
                self.temperature_min,
                self.temperature_max,
                self.humidity_min,
                self.humidity_max,
            )
        )


@dataclass(frozen=True)
class LotSafetySnapshot:
    is_biological: bool
    is_active: bool
    missing_fields: tuple[str, ...]
    expires_at: datetime | None
    protocol_ready: bool
    requires_insecticide_free: bool | None
    is_insecticide_free: bool | None
    slots: frozenset[int]
    unresolved_breaches: tuple[str, ...]
    transfer_holds: tuple[str, ...] = ()


@dataclass(frozen=True)
class LotSafety:
    status: str
    missing_fields: tuple[str, ...]
    blocked_by: tuple[str, ...]


def evaluate_lot(snapshot: LotSafetySnapshot, at: datetime) -> LotSafety:
    """Evaluate current facts; a missing future slot is deliberately incomplete too."""
    blockers = _global_start(snapshot, at)
    if snapshot.is_biological:
        blockers.extend(_biological_blockers(snapshot))
    blockers.extend(_global_holds(snapshot))
    status = "draft" if snapshot.missing_fields else ("blocked" if blockers else "available")
    return LotSafety(status, snapshot.missing_fields, tuple(blockers))


def evaluate_transit_lot(snapshot: LotSafetySnapshot, at: datetime) -> LotSafety:
    """Same global G; actual transit evidence owns the separate non-Location boundary."""
    blockers = _global_start(snapshot, at)
    if snapshot.is_biological and not snapshot.protocol_ready:
        blockers.append("protocol_not_configured")
    blockers.extend(_global_holds(snapshot))
    status = "draft" if snapshot.missing_fields else ("blocked" if blockers else "available")
    return LotSafety(status, snapshot.missing_fields, tuple(blockers))


def _global_start(snapshot: LotSafetySnapshot, at: datetime) -> list[str]:
    blockers: list[str] = []
    if not snapshot.is_active:
        blockers.append("supply_type_inactive")
    if snapshot.expires_at is not None and at >= snapshot.expires_at:
        blockers.append("lot_expired")
    return blockers


def _global_holds(snapshot: LotSafetySnapshot) -> list[str]:
    blockers: list[str] = []
    if snapshot.unresolved_breaches:
        blockers.append("condition_breach")
    if snapshot.transfer_holds:
        blockers.append("transfer_discrepancy_hold")
    return blockers


def _biological_blockers(snapshot: LotSafetySnapshot) -> list[str]:
    blockers = []
    if not snapshot.protocol_ready:
        blockers.append("protocol_not_configured")
    if snapshot.requires_insecticide_free is None:
        blockers.append("storage_safety_not_configured")
    elif snapshot.requires_insecticide_free and snapshot.is_insecticide_free is not True:
        blockers.append("insecticide_free_required")
    if snapshot.slots != frozenset({0, 1}):
        blockers.append("condition_slot_missing")
    return blockers


def assess_condition(protocol: Protocol, temperature: Decimal, humidity: Decimal) -> str:
    """Missing ranges are unassessed; inclusive configured bounds define a normal reading."""
    if not protocol.has_ranges:
        return "unassessed"
    if (
        protocol.temperature_min is None
        or protocol.temperature_max is None
        or protocol.humidity_min is None
        or protocol.humidity_max is None
    ):
        return "unassessed"
    normal = (
        protocol.temperature_min <= temperature <= protocol.temperature_max
        and protocol.humidity_min <= humidity <= protocol.humidity_max
    )
    return "normal" if normal else "breach"


def reading_slot(protocol: Protocol, at: datetime, timezone: str) -> tuple[date, int | None]:
    """Map an actual UTC instant into one explicitly configured local window."""
    local = at.astimezone(ZoneInfo(timezone))
    minute = local.hour * 60 + local.minute
    slot = next(
        (index for index, (start, end) in enumerate(protocol.windows) if start <= minute < end),
        None,
    )
    return local.date(), slot


def validate_piece_quantity(quantity: Decimal) -> int:
    """Bound expansion before allocating UUIDs; this limit is technical, not biological."""
    if not quantity.is_finite() or quantity != quantity.to_integral_value():
        raise ValueError("Piece quantity must be integral.")
    if not 0 < quantity <= MAX_PIECES_PER_ADMISSION:
        raise ValueError("Piece quantity exceeds the admission limit.")
    return int(quantity)
