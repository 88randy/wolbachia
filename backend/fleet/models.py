"""Fleet history is insert-only; only catalog-resolved void metadata may change once."""

from typing import Any, ClassVar, Self

from django.conf import settings
from django.db import models

from core.models import (
    ImmutableMixin,
    ImmutableQuerySet,
    OrgScopedModel,
    VoidableMixin,
)

VOID_FIELDS = frozenset({"voided_at", "voided_by", "void_reason", "void_reason_code"})


class ImmutableVoidableQuerySet(ImmutableQuerySet):
    def not_voided(self) -> Self:
        return self.filter(voided_at__isnull=True)

    def voided(self) -> Self:
        return self.filter(voided_at__isnull=False)


class ServiceKind(models.TextChoices):
    ROUTINE = "routine"
    REPAIR = "repair"
    INSPECTION = "inspection"


class EfficiencyStatus(models.TextChoices):
    UNAVAILABLE = "unavailable"
    OK = "ok"
    REVIEW = "review"


class ServiceRecord(ImmutableMixin, VoidableMixin, OrgScopedModel):
    objects: ClassVar[Any] = ImmutableVoidableQuerySet.as_manager()  # type: ignore[assignment]
    mutable_fields: ClassVar[frozenset[str]] = VOID_FIELDS
    motorcycle = models.ForeignKey(
        "shifts.Motorcycle", on_delete=models.PROTECT, related_name="services"
    )
    kind = models.CharField(max_length=20, choices=ServiceKind.choices)
    performed_at = models.DateField()
    odometer_km = models.PositiveIntegerField()
    notes = models.TextField(blank=True)
    service_interval_km = models.PositiveIntegerField(null=True, blank=True)
    service_interval_days = models.PositiveIntegerField(null=True, blank=True)
    due_metric_provenance = models.JSONField(default=dict)
    scope_center_lookup: ClassVar[str] = "motorcycle__center_id"

    class Meta(ImmutableMixin.Meta, VoidableMixin.Meta):
        ordering = ["-performed_at", "-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.motorcycle_id}:{self.kind}"


class ResponsibilityLetter(ImmutableMixin, VoidableMixin, OrgScopedModel):
    objects: ClassVar[Any] = ImmutableVoidableQuerySet.as_manager()  # type: ignore[assignment]
    mutable_fields: ClassVar[frozenset[str]] = VOID_FIELDS
    motorcycle = models.ForeignKey(
        "shifts.Motorcycle", on_delete=models.PROTECT, related_name="responsibility_letters"
    )
    courier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    issued_at = models.DateField()
    document_reference = models.UUIDField(null=True, blank=True)
    notes = models.TextField(blank=True)
    scope_center_lookup: ClassVar[str] = "motorcycle__center_id"

    class Meta(ImmutableMixin.Meta, VoidableMixin.Meta):
        ordering = ["-issued_at", "-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.motorcycle_id}:{self.courier_id}"


class FuelLoad(ImmutableMixin, OrgScopedModel):
    event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="fuel_load"
    )
    shift = models.ForeignKey("shifts.Shift", on_delete=models.PROTECT, related_name="fuel_loads")
    motorcycle = models.ForeignKey(
        "shifts.Motorcycle", on_delete=models.PROTECT, related_name="fuel_loads"
    )
    litres = models.DecimalField(max_digits=12, decimal_places=3)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3)
    odometer_km = models.PositiveIntegerField()
    receipt_upload_id = models.UUIDField(null=True, blank=True)
    receipt_pending = models.BooleanField()
    is_full_refill = models.BooleanField()
    efficiency_km_l = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    efficiency_status = models.CharField(max_length=20, choices=EfficiencyStatus.choices)
    threshold_min = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    threshold_max = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    rule_provenance = models.JSONField(default=dict)
    baseline = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="intervals"
    )
    provisional = models.BooleanField(default=False)
    scope_center_lookup: ClassVar[str] = "motorcycle__center_id"

    class Meta(ImmutableMixin.Meta):
        ordering = ["-event__device_time", "-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(litres__gt=0, amount__gt=0, odometer_km__lte=999999),
                name="fleet_fuel_positive_values",
            ),
        ]

    def __str__(self) -> str:
        return str(self.event_id)


class InspectionClearance(ImmutableMixin, OrgScopedModel):
    fault = models.OneToOneField(
        "shifts.MotorcycleBlockEvent", on_delete=models.PROTECT, related_name="inspection_clearance"
    )
    evidence_ids = models.JSONField()
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    reason = models.TextField()
    unblock_event = models.OneToOneField(
        "shifts.MotorcycleBlockEvent", on_delete=models.PROTECT, related_name="clearance_decision"
    )
    scope_center_lookup: ClassVar[str] = "fault__motorcycle__center_id"

    def __str__(self) -> str:
        return str(self.fault_id)
