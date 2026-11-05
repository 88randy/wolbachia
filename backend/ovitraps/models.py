"""Immutable field effects and append-only corrections; all business rows are org-scoped."""

from typing import ClassVar

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class OvitrapRecord(ImmutableMixin, OrgScopedModel):
    event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+"
    )

    class Meta(ImmutableMixin.Meta):
        abstract = True


class Ovitrap(OvitrapRecord):
    sampling_point = models.ForeignKey(
        "geography.SamplingPoint", on_delete=models.PROTECT, related_name="ovitraps"
    )
    point_version = models.ForeignKey(
        "geography.PointVersion", on_delete=models.PROTECT, related_name="+"
    )
    scope_center_lookup: ClassVar[str] = "sampling_point__block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "sampling_point__block__quadrant_id"

    @property
    def code(self) -> str:
        return str(self.pk)


class PlacementAttempt(OvitrapRecord):
    ovitrap = models.OneToOneField(Ovitrap, on_delete=models.PROTECT, related_name="placement")
    supply_refs = models.JSONField()
    evidence_ids = models.JSONField()
    evaluated_rules = models.JSONField()
    rule_version_ids = models.JSONField()


class OvitrapReading(OvitrapRecord):
    ovitrap = models.ForeignKey(Ovitrap, on_delete=models.PROTECT, related_name="readings")
    point_version = models.ForeignKey(
        "geography.PointVersion", on_delete=models.PROTECT, related_name="+"
    )
    finding = models.ForeignKey("catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+")
    finding_code = models.CharField(max_length=64)
    finding_label = models.JSONField()
    other_text = models.TextField(blank=True)
    paddle_present = models.BooleanField()
    has_eggs = models.BooleanField(null=True)
    temperature_c = models.FloatField(null=True)
    humidity_pct = models.FloatField(null=True)
    paddle_type = models.ForeignKey(
        "catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+", null=True
    )
    is_lagged = models.BooleanField()
    is_index_excluded = models.BooleanField()
    index_exclusion_reason = models.CharField(max_length=64, blank=True)
    epi_week = models.CharField(max_length=8)
    evaluated_rules = models.JSONField()
    rule_version_ids = models.JSONField()
    scope_center_lookup: ClassVar[str] = "ovitrap__sampling_point__block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "ovitrap__sampling_point__block__quadrant_id"

    class Meta(OvitrapRecord.Meta):
        indexes = [models.Index(fields=["organization", "ovitrap", "epi_week"])]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(paddle_present=False, has_eggs__isnull=True)
                    | models.Q(paddle_present=True, has_eggs__isnull=False)
                ),
                name="ovitrap_reading_conditional_eggs",
            )
        ]


class Bag(OvitrapRecord):
    code = models.CharField(max_length=50)
    reading = models.OneToOneField(OvitrapReading, on_delete=models.PROTECT, related_name="bag")
    collector = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    field_flags = models.JSONField()
    scope_center_lookup: ClassVar[str] = (
        "reading__ovitrap__sampling_point__block__quadrant__center_id"
    )
    scope_quadrant_lookup: ClassVar[str] = "reading__ovitrap__sampling_point__block__quadrant_id"

    class Meta(OvitrapRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="ovitrap_bag_org_code")
        ]


class OvitrapVoid(OvitrapRecord):
    target_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="ovitrap_void"
    )
    reason = models.TextField()
    reason_code = models.CharField(max_length=64)
