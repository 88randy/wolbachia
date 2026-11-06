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
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, cast

from django.db import IntegrityError, transaction

from accounts.models import User
from catalogs.models import CatalogItem
from core.exceptions import FieldValidationError
from core.services import lock_record_for_update, void_validated_record
from core.void_reason import resolve_void_reason, validate_void_reason
from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.registry import EventContext
from field_sync.selectors import captured_scope, membership_snapshots
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
from shifts.exceptions import MotorcycleInUseError, MotorcycleNotBlockedError
from shifts.extensions import UNBLOCK_GUARDS
from shifts.models import (
    BlockedReason,
    CheckResult,
    Motorcycle,
    MotorcycleBlockAction,
    MotorcycleBlockEvent,
    MotorcycleCheck,
    Shift,
    ShiftStatus,
)
from shifts.selectors import highest_recorded_km

# [ASSUMPTION] An odometer shows six digits; above that the reading is a typo or abuse. A physical
# limit of the instrument, not a business threshold, so it is not a rule parameter.
MAX_ODOMETER_KM = 999_999
SHIFT_PRIMARY_KEY_CONSTRAINT = "shifts_shift_pkey"
EDITABLE_MOTORCYCLE_FIELDS = ("plate", "center")
MOTORCYCLE_CODE_CONSTRAINT = "motorcycle_unique_code_per_organization"


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
    motorcycle = _lock_motorcycle(ctx, data["motorcycle_code"])
    _ensure_odometer_in_range(data["odometer_km"])
    _ensure_no_open_shift(ctx)
    _ensure_shift_id_is_free(shift_id)
    _ensure_motorcycle_is_usable(motorcycle)
    previous_km = highest_recorded_km(motorcycle)
    shift = _insert_shift(ctx, NewShift(shift_id, motorcycle, data["odometer_km"], data["note"]))
    _insert_checks(shift, data["checks"], items)
    if any(line["result"] == CheckResult.SEVERE for line in data["checks"]):
        _block_motorcycle(motorcycle, ctx)
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


def _lock_motorcycle(ctx: EventContext, code: str) -> Motorcycle:
    """Deny outside scope without a lock wait; recheck current allocation under its lock."""
    motorcycles = Motorcycle.objects.for_org(ctx.organization).filter(
        code=code, voided_at__isnull=True
    )
    candidate = motorcycles.first()
    if candidate is None or not _has_motorcycle_scope(ctx, candidate):
        raise EventRejected(MOTORCYCLE_UNKNOWN)
    motorcycle = motorcycles.select_for_update().first()
    if motorcycle is None or not _has_motorcycle_scope(ctx, motorcycle):
        raise EventRejected(MOTORCYCLE_UNKNOWN)
    return cast(Motorcycle, motorcycle)


def _has_motorcycle_scope(ctx: EventContext, motorcycle: Motorcycle) -> bool:
    """Capture membership and profiles together for preflight and locked revalidation.

    EventContext carries no captured scope. The shared single-statement capture avoids
    mixing configuration revisions, without configuration locks, including on a final upload.
    """
    membership = membership_snapshots(ctx.organization).filter(user=ctx.user).first()
    if membership is None:
        return False
    scope = captured_scope(membership)
    if motorcycle.center_id is None:
        return any(
            FIELD_EVENT_SYNC in codes and grant["centers"]["mode"] == "all"
            for codes, grant in scope.grants
        )
    return scope.allows(FIELD_EVENT_SYNC, str(motorcycle.center_id))


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


def _block_motorcycle(motorcycle: Motorcycle, ctx: EventContext) -> None:
    motorcycle.is_blocked = True
    motorcycle.blocked_reason = BlockedReason.SEVERE_CHECK
    motorcycle.revision += 1
    motorcycle.save(update_fields=["is_blocked", "blocked_reason", "revision"])
    MotorcycleBlockEvent.objects.create(
        organization_id=motorcycle.organization_id,
        created_by=ctx.user,
        motorcycle=motorcycle,
        action=MotorcycleBlockAction.BLOCK,
        blocked_reason=BlockedReason.SEVERE_CHECK,
        reason=SEVERE_CHECK,
        field_event_id=ctx.envelope.id,
    )


@contextmanager
def _motorcycle_code_conflict() -> Iterator[None]:
    """Map only the code unique constraint to a field error, after rolling back the savepoint.

    PostgreSQL arbitrates concurrent creates; an application pre-check alone races.
    Other integrity errors propagate so real bugs are never disguised as a duplicate code.
    """
    try:
        with transaction.atomic():
            yield
    except IntegrityError as error:
        if _violated_constraint(error) != MOTORCYCLE_CODE_CONSTRAINT:
            raise
        raise FieldValidationError("code", "duplicate_code") from None


def create_motorcycle(
    organization: Organization, values: Mapping[str, Any], user: User
) -> Motorcycle:
    """Insert fleet configuration; block/void metadata cannot be supplied by a caller."""
    with _motorcycle_code_conflict():
        return Motorcycle.objects.create(
            organization=organization,
            created_by=user,
            code=values["code"],
            plate=values.get("plate", ""),
            center=values.get("center"),
        )


def update_motorcycle(motorcycle: Motorcycle, changes: Mapping[str, object]) -> Motorcycle:
    """Write the plate under the same lock as shift.open, void and unblock.

    Code is immutable because pending schema-1 offline events resolve by code. Reject it even
    when unchanged; a correction requires void + create, and the voided code remains reserved.
    """
    if "code" in changes:
        raise FieldValidationError("code", "immutable_code")
    fields = [name for name in EDITABLE_MOTORCYCLE_FIELDS if name in changes]
    with transaction.atomic():
        locked = lock_record_for_update(motorcycle)
        for name in fields:
            setattr(locked, name, changes[name])
        if fields:
            locked.revision += 1
            locked.save(update_fields=[*fields, "revision"])
    return locked


def void_motorcycle(  # noqa: PLR0913 -- explicit void contract
    motorcycle: Motorcycle, user: User, reason: str, reason_code: str
) -> Motorcycle:
    """Void fleet configuration while retaining all shifts/checks. Refuse an open shift.

    Lock rule: acquire Motorcycle first, as shift.open does. Once locked, either the opening
    committed and void refuses, or void commits first and the opening cannot find a live row.
    No Shift lock is acquired, so shift.close cannot form a lock cycle.
    """
    with transaction.atomic():
        choice = resolve_void_reason(motorcycle.organization_id, reason, reason_code)
        locked = lock_record_for_update(motorcycle)
        if Shift.objects.filter(motorcycle=locked, status=ShiftStatus.OPEN).exists():
            raise MotorcycleInUseError
        return void_validated_record(locked, user, choice)


def unblock_motorcycle(motorcycle: Motorcycle, user: User, reason: str) -> Motorcycle:
    """Clear a block and insert its audit atomically; an unblocked motorcycle is a conflict.

    Motorcycle is locked before checking state and writing both rows. A concurrent severe
    check uses the same lock, and two unblocks cannot create two transitions.
    """
    cleaned = validate_void_reason(reason, "reason")
    with transaction.atomic():
        locked = lock_record_for_update(motorcycle)
        if not locked.is_blocked:
            raise MotorcycleNotBlockedError
        for guard in UNBLOCK_GUARDS:
            guard(locked)
        MotorcycleBlockEvent.objects.create(
            organization_id=locked.organization_id,
            created_by=user,
            motorcycle=locked,
            action=MotorcycleBlockAction.UNBLOCK,
            blocked_reason=locked.blocked_reason,
            reason=cleaned,
        )
        locked.is_blocked = False
        locked.blocked_reason = ""
        locked.revision += 1
        locked.save(update_fields=["is_blocked", "blocked_reason", "revision"])
    return locked
