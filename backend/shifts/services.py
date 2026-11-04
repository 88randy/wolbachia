"""Shift lifecycle: the apply functions of `shift.open` and `shift.close` (write Shift,
MotorcycleCheck and Motorcycle).

They run inside the savepoint the sync pipeline opens per event, under the courier's batch lock
(docs/sync.md): they validate their own rules and raise `EventRejected` (every write rolls back)
or `EventNeedsReview` (after the writes to keep), never letting the database detect a violation
(an `IntegrityError` would be a `500` for the whole batch). The partial unique index on open
shifts is the backstop. They call no external service.

Row locks taken here, in this order: `Motorcycle` (open), `Shift` (close). Both come after the
account locks of accounts/README.md (a final upload holds those first) and are bounded by the
batch's `lock_timeout`.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from django.db import IntegrityError, transaction

from catalogs.models import CatalogItem
from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext
from organizations.models import Organization
from shifts.codes import (
    MOTORCYCLE_BLOCKED,
    MOTORCYCLE_CHECK_CATALOG_SLUG,
    MOTORCYCLE_IN_USE,
    MOTORCYCLE_UNKNOWN,
    ODOMETER_DECREASED,
    ODOMETER_OUT_OF_RANGE,
    SEVERE_CHECK,
    SHIFT_ALREADY_OPEN,
    SHIFT_NOT_OPEN,
)
from shifts.models import (
    BlockedReason,
    CheckResult,
    Motorcycle,
    MotorcycleCheck,
    Shift,
    ShiftStatus,
)
from shifts.selectors import last_known_km

# [ASSUMPTION] An odometer shows six digits; above that the reading is a typo or abuse. A physical
# limit of the instrument, not a business threshold, so it is not a rule parameter.
MAX_ODOMETER_KM = 999_999
SHIFT_PRIMARY_KEY_CONSTRAINT = "shifts_shift_pkey"


@dataclass(frozen=True)
class NewShift:
    """What `shift.open` writes into the `Shift` row."""

    shift_id: uuid.UUID
    motorcycle: Motorcycle
    odometer_km: int
    note: str


def open_shift(ctx: EventContext, data: dict[str, Any]) -> None:
    """`shift.open`: start the courier's shift on a motorcycle (writes Shift, MotorcycleCheck and,
    after a severe check, Motorcycle).

    Rejected: `shift_already_open`, `motorcycle_unknown`, `motorcycle_blocked`,
    `motorcycle_in_use`, `odometer_out_of_range`, `invalid_payload` (unknown checklist item or
    reused shift id). In review (writes kept): `severe_check`, `odometer_decreased`; when both
    apply, `severe_check` wins (the decrease is not reported separately).
    """
    shift_id = _require_shift_id(ctx)
    items = _resolve_check_items(ctx.organization, data["checks"])
    motorcycle = _lock_motorcycle(ctx.organization, data["motorcycle_code"])
    _ensure_odometer_in_range(data["odometer_km"])
    _ensure_no_open_shift(ctx)
    _ensure_shift_id_is_free(shift_id)
    _ensure_motorcycle_is_usable(motorcycle)
    previous_km = last_known_km(motorcycle)
    shift = _insert_shift(ctx, NewShift(shift_id, motorcycle, data["odometer_km"], data["note"]))
    _insert_checks(shift, data["checks"], items)
    if any(line["result"] == CheckResult.SEVERE for line in data["checks"]):
        _block_motorcycle(motorcycle)
        raise EventNeedsReview(SEVERE_CHECK, {"motorcycle_code": motorcycle.code})
    if previous_km is not None and data["odometer_km"] < previous_km:
        raise EventNeedsReview(
            ODOMETER_DECREASED, {"previous_km": previous_km, "odometer_km": data["odometer_km"]}
        )


def close_shift(ctx: EventContext, data: dict[str, Any]) -> None:
    """`shift.close`: close the courier's open shift named by the envelope's `shift_id` (writes
    Shift, once).

    Rejected: `shift_not_open` (missing, someone else's or already closed), `odometer_out_of_range`.
    In review (the shift is closed anyway, a field typo must not lose data): `odometer_decreased`.
    """
    shift_id = _require_shift_id(ctx)
    shift = (
        Shift.objects.for_org(ctx.organization)
        .select_for_update()
        .filter(pk=shift_id, courier=ctx.user)
        .first()
    )
    if shift is None or shift.status != ShiftStatus.OPEN:
        raise EventRejected(SHIFT_NOT_OPEN, {"shift_id": str(shift_id)})
    odometer_km = data["odometer_km"]
    _ensure_odometer_in_range(odometer_km)
    shift.status = ShiftStatus.CLOSED
    shift.closed_at_device = ctx.envelope.device_time
    shift.closed_event_id = ctx.envelope.id
    shift.odometer_close_km = odometer_km
    shift.close_note = data["note"]
    shift.save(
        update_fields=[
            "status",
            "closed_at_device",
            "closed_event",
            "odometer_close_km",
            "close_note",
        ]
    )
    if odometer_km < shift.odometer_open_km:
        raise EventNeedsReview(
            ODOMETER_DECREASED,
            {"previous_km": shift.odometer_open_km, "odometer_km": odometer_km},
        )


def _require_shift_id(ctx: EventContext) -> uuid.UUID:
    shift_id = ctx.envelope.shift_id
    if shift_id is None:
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"shift_id": ["required"]}})
    return shift_id


def _ensure_odometer_in_range(odometer_km: int) -> None:
    if odometer_km > MAX_ODOMETER_KM:
        raise EventRejected(
            ODOMETER_OUT_OF_RANGE, {"odometer_km": odometer_km, "max_km": MAX_ODOMETER_KM}
        )


def _resolve_check_items(
    organization: Organization, checks: list[dict[str, Any]]
) -> dict[str, CatalogItem]:
    """The active catalog items the checklist names, by code (reads). An unknown or inactive item,
    or the same item twice, is an invalid payload."""
    codes = [line["item"] for line in checks]
    items = {
        item.code: item
        for item in CatalogItem.objects.filter(
            organization=organization,
            catalog__slug=MOTORCYCLE_CHECK_CATALOG_SLUG,
            is_active=True,
            code__in=codes,
        )
    }
    if len(set(codes)) != len(codes):
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"checks": ["duplicate_item"]}})
    if len(items) != len(codes):
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"checks": ["unknown_item"]}})
    return items


def _lock_motorcycle(organization: Organization, code: str) -> Motorcycle:
    """The motorcycle with that code, row-locked so a severe check and an open cannot interleave."""
    motorcycle = (
        Motorcycle.objects.for_org(organization).select_for_update().filter(code=code).first()
    )
    if motorcycle is None:
        raise EventRejected(MOTORCYCLE_UNKNOWN)
    return motorcycle


def _ensure_no_open_shift(ctx: EventContext) -> None:
    open_shift_of_courier = (
        Shift.objects.for_org(ctx.organization)
        .filter(courier=ctx.user, status=ShiftStatus.OPEN)
        .first()
    )
    if open_shift_of_courier is not None:
        raise EventRejected(SHIFT_ALREADY_OPEN, {"shift_id": str(open_shift_of_courier.pk)})


def _ensure_shift_id_is_free(shift_id: uuid.UUID) -> None:
    """The phone generates shift ids; one already used (by anyone) cannot be reused. Same answer
    for another organization's id, so nothing leaks."""
    if Shift.objects.filter(pk=shift_id).exists():
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"shift_id": ["already_used"]}})


def _ensure_motorcycle_is_usable(motorcycle: Motorcycle) -> None:
    """Not blocked and in no open shift. The motorcycle row is locked by the caller, so two
    couriers cannot both pass this check for the same motorcycle."""
    if motorcycle.is_blocked:
        raise EventRejected(MOTORCYCLE_BLOCKED, {"reason": motorcycle.blocked_reason})
    if Shift.objects.filter(motorcycle=motorcycle, status=ShiftStatus.OPEN).exists():
        raise EventRejected(MOTORCYCLE_IN_USE)


def _insert_shift(ctx: EventContext, new: NewShift) -> Shift:
    """Insert the shift in its own savepoint. A client shift id already taken by a shift that a
    concurrent batch of another courier has just inserted violates the primary key: that is
    this event's `invalid_payload`, not a failed batch. Any other violation is a real bug and
    keeps propagating."""
    try:
        with transaction.atomic():
            return Shift.objects.create(
                id=new.shift_id,
                organization=ctx.organization,
                created_by=ctx.user,
                courier=ctx.user,
                device=ctx.device,
                motorcycle=new.motorcycle,
                opened_at_device=ctx.envelope.device_time,
                opened_event_id=ctx.envelope.id,
                odometer_open_km=new.odometer_km,
                open_note=new.note,
            )
    except IntegrityError as error:
        if _violated_constraint(error) != SHIFT_PRIMARY_KEY_CONSTRAINT:
            raise
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"shift_id": ["already_used"]}}) from None


def _violated_constraint(error: IntegrityError) -> str | None:
    """The PostgreSQL constraint name behind an `IntegrityError`, when the driver reports it."""
    diagnostics = getattr(error.__cause__, "diag", None)
    return getattr(diagnostics, "constraint_name", None)


def _insert_checks(
    shift: Shift, checks: list[dict[str, Any]], items: dict[str, CatalogItem]
) -> None:
    MotorcycleCheck.objects.bulk_create(
        [
            MotorcycleCheck(
                organization_id=shift.organization_id,
                created_by_id=shift.created_by_id,
                shift=shift,
                item=items[line["item"]],
                result=line["result"],
                note=line["note"],
            )
            for line in checks
        ]
    )


def _block_motorcycle(motorcycle: Motorcycle) -> None:
    motorcycle.is_blocked = True
    motorcycle.blocked_reason = BlockedReason.SEVERE_CHECK
    motorcycle.save(update_fields=["is_blocked", "blocked_reason"])
