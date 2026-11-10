"""Canonical minimal B-21 identity consumed by UIEB source selection."""

from django.db import models

from lab.models import LabFact


class WolbachiaSample(LabFact):
    code = models.CharField(max_length=50)
    event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="wolbachia_sample"
    )
    origin = models.ForeignKey("catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+")
    method_version = models.ForeignKey(
        "lab.LabMethodVersion", on_delete=models.PROTECT, related_name="+"
    )
    location = models.ForeignKey("inventory.Location", on_delete=models.PROTECT, related_name="+")
    reading = models.ForeignKey(
        "ovitraps.OvitrapReading", null=True, on_delete=models.PROTECT, related_name="+"
    )
    lot = models.ForeignKey("inventory.Lot", null=True, on_delete=models.PROTECT, related_name="+")
    collector = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="lab_sample_org_code"),
            models.CheckConstraint(
                condition=(
                    models.Q(reading__isnull=False, lot__isnull=True)
                    | models.Q(reading__isnull=True, lot__isnull=False)
                ),
                name="lab_sample_exact_source",
            ),
        ]
