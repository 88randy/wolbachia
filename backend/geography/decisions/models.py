"""Append-only B33 task provenance, interventions and explicit geography epochs."""

from typing import ClassVar

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class DecisionRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True
        app_label = "geography"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False), name="%(app_label)s_%(class)s_author"
            )
        ]


class NextDayTask(DecisionRecord):
    proposal = models.OneToOneField(
        "ovitraps.RelocationProposal", on_delete=models.PROTECT, related_name="next_day_task"
    )
    decision = models.OneToOneField(
        "ovitraps.RelocationDecision", on_delete=models.PROTECT, related_name="next_day_task"
    )
    task = models.ForeignKey(
        "scheduling.ScheduledTask", on_delete=models.PROTECT, related_name="relocation_origins"
    )


class QuadrantClosure(DecisionRecord):
    quadrant_version = models.OneToOneField(
        "geography.QuadrantVersion", on_delete=models.PROTECT, related_name="closure"
    )
    closed_at = models.DateTimeField()
    readiness_snapshot = models.JSONField()
    scope_center_lookup: ClassVar[str] = "quadrant_version__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "quadrant_version__quadrant_id"


class ThirdPartyIntervention(DecisionRecord):
    type = models.ForeignKey("catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+")
    type_code = models.CharField(max_length=64)
    type_label = models.JSONField()
    product = models.CharField(max_length=200)
    source = models.CharField(max_length=200)
    date_from = models.DateField()
    date_to = models.DateField()
    other_text = models.TextField(blank=True)

    class Meta(DecisionRecord.Meta):
        constraints = [
            *DecisionRecord.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(date_to__gte=models.F("date_from")),
                name="intervention_date_order",
            ),
        ]


class ThirdPartyInterventionBlock(DecisionRecord):
    intervention = models.ForeignKey(
        ThirdPartyIntervention, on_delete=models.PROTECT, related_name="blocks"
    )
    block = models.ForeignKey(
        "geography.Block", on_delete=models.PROTECT, related_name="interventions"
    )
    scope_center_lookup: ClassVar[str] = "block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "block__quadrant_id"

    class Meta(DecisionRecord.Meta):
        constraints = [
            *DecisionRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["intervention", "block"], name="intervention_block_once"
            ),
        ]
