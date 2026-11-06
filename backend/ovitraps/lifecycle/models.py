"""B-15 insert-only physical identity and proposed-location evidence (existing app label)."""

from typing import ClassVar

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel
from ovitraps.models import OvitrapRecord


class LifecycleRecord(OvitrapRecord):
    reason = models.ForeignKey("catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+")
    reason_code = models.CharField(max_length=64)
    reason_label = models.JSONField()
    other_text = models.TextField(blank=True)
    evidence_ids = models.JSONField()
    evaluated_rules = models.JSONField()
    rule_version_ids = models.JSONField()
    point_version = models.ForeignKey(
        "geography.PointVersion", on_delete=models.PROTECT, related_name="+"
    )

    class Meta(OvitrapRecord.Meta):
        abstract = True
        app_label = "ovitraps"


class PhysicalOvitrapLineage(LifecycleRecord):
    point = models.ForeignKey(
        "geography.SamplingPoint", on_delete=models.PROTECT, related_name="physical_lineage"
    )
    old_trap = models.ForeignKey(
        "ovitraps.Ovitrap", on_delete=models.PROTECT, related_name="replacements"
    )
    new_trap = models.OneToOneField(
        "ovitraps.Ovitrap", on_delete=models.PROTECT, related_name="replacement"
    )

    class Meta(LifecycleRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(old_trap=models.F("new_trap")),
                name="lineage_distinct_identities",
            )
        ]


class RelocationProposal(LifecycleRecord):
    decision_status: str

    ovitrap = models.ForeignKey(
        "ovitraps.Ovitrap", on_delete=models.PROTECT, related_name="relocation_proposals"
    )
    old_location = models.JSONField()
    new_location = models.JSONField()
    scope_center_lookup: ClassVar[str] = "ovitrap__sampling_point__block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "ovitrap__sampling_point__block__quadrant_id"


class RelocationDecision(OvitrapRecord):
    """Read-side decision boundary; B-33 owns the authorized decision writer."""

    proposal = models.ForeignKey(
        RelocationProposal, on_delete=models.PROTECT, related_name="decisions"
    )
    decision = models.CharField(
        max_length=8, choices=[("approved", "approved"), ("rejected", "rejected")]
    )

    class Meta(OvitrapRecord.Meta):
        app_label = "ovitraps"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(decision__in=["approved", "rejected"]),
                name="relocation_decision_valid",
            )
        ]


class OvitrapIncidentLink(OvitrapRecord):
    """Reserved incident identity, once per physical trap; B-06 may adopt this UUID."""

    ovitrap = models.ForeignKey(
        "ovitraps.Ovitrap", on_delete=models.PROTECT, related_name="incident_links"
    )

    class Meta(OvitrapRecord.Meta):
        app_label = "ovitraps"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "ovitrap"], name="ovitrap_incident_once"
            )
        ]


class RemovalAttempt(LifecycleRecord):
    scope_center_lookup: ClassVar[str] = "ovitrap__sampling_point__block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "ovitrap__sampling_point__block__quadrant_id"

    ovitrap = models.ForeignKey(
        "ovitraps.Ovitrap", on_delete=models.PROTECT, related_name="removals"
    )
    is_recovered = models.BooleanField()
    recovery_state = models.CharField(
        max_length=11, choices=[("recovered", "recovered"), ("unrecovered", "unrecovered")]
    )
    incident_link = models.ForeignKey(
        OvitrapIncidentLink, null=True, on_delete=models.PROTECT, related_name="removals"
    )

    class Meta(LifecycleRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(is_recovered=True, recovery_state="recovered")
                    | models.Q(is_recovered=False, recovery_state="unrecovered")
                ),
                name="removal_recovery_consistent",
            )
        ]


class RemovalResolution(ImmutableMixin, OrgScopedModel):
    """Supervisor disposition of one unrecovered removal; the source remains immutable."""

    removal = models.OneToOneField(
        RemovalAttempt, on_delete=models.PROTECT, related_name="resolution"
    )
    outcome = models.CharField(
        max_length=15,
        choices=[("recovered_later", "recovered_later"), ("written_off", "written_off")],
    )
    reason = models.TextField()
    scope_center_lookup: ClassVar[str] = (
        "removal__ovitrap__sampling_point__block__quadrant__center_id"
    )
    scope_quadrant_lookup: ClassVar[str] = "removal__ovitrap__sampling_point__block__quadrant_id"

    class Meta(ImmutableMixin.Meta):
        app_label = "ovitraps"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(outcome__in=["recovered_later", "written_off"]),
                name="removal_resolution_outcome_valid",
            )
        ]
