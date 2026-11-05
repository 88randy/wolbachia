"""The courier's shift ("jornada"): the day that frames all field work (issue #68).

`Shift` and `MotorcycleCheck` are insert-only: a shift is written by `shift.open` and changes
exactly once, when `shift.close` closes it (`mutable_fields`). Nothing is deleted; a correction is
a supervisor's decision later (#34), never an edit. `Motorcycle` is fleet configuration that only
an administrator changes through the fleet API (#72).
"""

from typing import ClassVar

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import ImmutableMixin, OrgScopedModel, VoidableMixin

CODE_MAX_LENGTH = 50
PLATE_MAX_LENGTH = 20
STATUS_MAX_LENGTH = 20
NOTE_MAX_LENGTH = 500
BLOCKED_REASON_MAX_LENGTH = 30
RESULT_MAX_LENGTH = 10


class BlockedReason(models.TextChoices):
    """Why a motorcycle cannot be used (S02 lists the unavailable ones with their reason)."""

    SEVERE_CHECK = "severe_check"
    SERVICE_OVERDUE = "service_overdue"
    OUT_OF_SERVICE = "out_of_service"


class ShiftStatus(models.TextChoices):
    OPEN = "open"
    CLOSED = "closed"


class CheckResult(models.TextChoices):
    OK = "ok"
    MINOR = "minor"
    SEVERE = "severe"


class Motorcycle(VoidableMixin, OrgScopedModel):
    """A fleet motorcycle. `code` is the human code printed on it (e.g. `M-03`), unique per
    organization. A blocked motorcycle cannot open a shift until an authorized supervisor clears it
    through an audited unblock."""

    code = models.CharField(max_length=CODE_MAX_LENGTH)
    plate = models.CharField(max_length=PLATE_MAX_LENGTH, blank=True)
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.CharField(
        max_length=BLOCKED_REASON_MAX_LENGTH, choices=BlockedReason.choices, blank=True
    )

    class Meta(VoidableMixin.Meta):
        constraints = [
            *VoidableMixin.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "code"], name="motorcycle_unique_code_per_organization"
            ),
            models.CheckConstraint(
                condition=Q(is_blocked=True) | Q(blocked_reason=""),
                name="motorcycle_reason_only_when_blocked",
            ),
        ]

    def __str__(self) -> str:
        return self.code


class MotorcycleBlockAction(models.TextChoices):
    BLOCK = "block"
    UNBLOCK = "unblock"


class MotorcycleBlockEvent(ImmutableMixin, OrgScopedModel):
    """Insert-only fleet audit. `blocked_reason` is the block being applied or cleared.

    Severe checks point to their field event; manual unblocks keep the normalized reason and
    actor. The migration also refuses UPDATE and DELETE in PostgreSQL.
    """

    motorcycle = models.ForeignKey(
        Motorcycle, on_delete=models.PROTECT, related_name="block_events"
    )
    action = models.CharField(max_length=STATUS_MAX_LENGTH, choices=MotorcycleBlockAction.choices)
    blocked_reason = models.CharField(
        max_length=BLOCKED_REASON_MAX_LENGTH, choices=BlockedReason.choices, blank=True
    )
    reason = models.TextField()
    field_event = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta(ImmutableMixin.Meta):
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"{self.motorcycle_id}:{self.action}"


class Shift(ImmutableMixin, OrgScopedModel):
    """One courier's day. The primary key is the UUID the phone generated for `shift.open` (the
    `shift_id` of every event of that day), so the phone can reference it before it syncs.

    `opened_at_device` and `closed_at_device` are the phone's clock; the events keep the server
    receipt time. A courier has at most one open shift and a motorcycle is in at most one open
    shift: the partial unique indexes are the arbiters, and the handler checks first (under the
    motorcycle row lock) so a race never surfaces as an `IntegrityError`. A database trigger
    (migration 0001) refuses deletes and any update other than closing an open shift.
    """

    mutable_fields: ClassVar[frozenset[str]] = frozenset(
        {"status", "closed_at_device", "closed_event", "odometer_close_km", "close_note"}
    )

    courier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    device = models.ForeignKey("accounts.Device", on_delete=models.PROTECT, related_name="+")
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.PROTECT, related_name="+")
    status = models.CharField(
        max_length=STATUS_MAX_LENGTH, choices=ShiftStatus.choices, default=ShiftStatus.OPEN
    )
    opened_at_device = models.DateTimeField()
    opened_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+"
    )
    odometer_open_km = models.PositiveIntegerField()
    open_note = models.CharField(max_length=NOTE_MAX_LENGTH, blank=True)
    closed_at_device = models.DateTimeField(null=True, blank=True)
    closed_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    odometer_close_km = models.PositiveIntegerField(null=True, blank=True)
    close_note = models.CharField(max_length=NOTE_MAX_LENGTH, blank=True)

    class Meta(ImmutableMixin.Meta):
        indexes = [
            models.Index(fields=["organization", "-opened_at_device", "id"]),
            models.Index(fields=["organization", "courier"]),
            models.Index(fields=["motorcycle", "-opened_at_device"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "courier"],
                condition=Q(status="open"),
                name="shift_one_open_per_courier",
            ),
            models.UniqueConstraint(
                fields=["motorcycle"],
                condition=Q(status="open"),
                name="shift_one_open_per_motorcycle",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        status="open",
                        closed_at_device__isnull=True,
                        closed_event__isnull=True,
                        odometer_close_km__isnull=True,
                    )
                    | Q(
                        status="closed",
                        closed_at_device__isnull=False,
                        closed_event__isnull=False,
                        odometer_close_km__isnull=False,
                    )
                ),
                name="shift_close_fields_match_status",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.pk}:{self.status}"


class MotorcycleCheck(ImmutableMixin, OrgScopedModel):
    """One line of the checklist done when the shift opened. `item` is an entry of the closed
    catalog `motorcycle-check-item`. A database trigger refuses every update and delete."""

    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="checks")
    item = models.ForeignKey("catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+")
    result = models.CharField(max_length=RESULT_MAX_LENGTH, choices=CheckResult.choices)
    note = models.CharField(max_length=NOTE_MAX_LENGTH, blank=True)

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(fields=["shift", "item"], name="check_unique_item_per_shift")
        ]

    def __str__(self) -> str:
        return f"{self.item_id}:{self.result}"
