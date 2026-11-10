"""Append-only shipment snapshots and actual material delivery facts."""

from django.db import models

from lab.models import LabFact


class UiebShipment(LabFact):
    code = models.CharField(max_length=50)
    cutoff = models.DateTimeField()
    template_version = models.CharField(max_length=64, default="source-projection-v1")
    recipient_institution = models.CharField(max_length=200)
    source_snapshot = models.JSONField()
    content_hash = models.CharField(max_length=64)
    supersedes = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="revision"
    )
    reason = models.TextField(blank=True)

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="shipment_org_code"),
        ]


class ShipmentSource(LabFact):
    shipment = models.ForeignKey(UiebShipment, on_delete=models.PROTECT, related_name="sources")
    bag = models.ForeignKey("ovitraps.Bag", null=True, on_delete=models.PROTECT)
    lot = models.ForeignKey("inventory.Lot", null=True, on_delete=models.PROTECT)
    sample = models.ForeignKey("lab.WolbachiaSample", null=True, on_delete=models.PROTECT)
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT)
    quadrant = models.ForeignKey("geography.Quadrant", null=True, on_delete=models.PROTECT)

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.CheckConstraint(
                condition=(
                    models.Q(bag__isnull=False, lot__isnull=True, sample__isnull=True)
                    | models.Q(bag__isnull=True, lot__isnull=False, sample__isnull=True)
                    | models.Q(bag__isnull=True, lot__isnull=True, sample__isnull=False)
                ),
                name="shipment_exact_source",
            ),
            models.UniqueConstraint(fields=["shipment", "bag"], name="shipment_bag_once"),
            models.UniqueConstraint(fields=["shipment", "lot"], name="shipment_lot_once"),
            models.UniqueConstraint(fields=["shipment", "sample"], name="shipment_sample_once"),
        ]


class ShipmentVoid(LabFact):
    shipment = models.OneToOneField(UiebShipment, on_delete=models.PROTECT, related_name="void")
    reason = models.TextField()


class MaterialRequest(LabFact):
    scope_center_lookup = "location__center_id"
    scope_quadrant_lookup = "location__quadrant_id"
    code = models.CharField(max_length=50)
    recipient_institution = models.CharField(max_length=200)
    lot = models.ForeignKey("inventory.Lot", on_delete=models.PROTECT)
    location = models.ForeignKey("inventory.Location", on_delete=models.PROTECT)
    piece = models.ForeignKey("inventory.Piece", null=True, on_delete=models.PROTECT)
    unit_version = models.ForeignKey("inventory.SupplyTypeVersion", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=18, decimal_places=6)

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "code"], name="material_request_org_code"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="material_request_positive"
            ),
        ]


class NotificationEvidence(LabFact):
    request = models.ForeignKey(
        MaterialRequest, on_delete=models.PROTECT, related_name="notifications"
    )
    reference = models.CharField(max_length=200)
    date = models.DateField()
    upload = models.OneToOneField("uploads.Upload", on_delete=models.PROTECT)


class DeliveryReceipt(LabFact):
    request = models.OneToOneField(
        MaterialRequest, on_delete=models.PROTECT, related_name="delivery"
    )
    command_id = models.UUIDField()
    signature = models.OneToOneField("uploads.Upload", on_delete=models.PROTECT)
    expected_revision = models.PositiveIntegerField()
    input_hash = models.CharField(max_length=64)

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="material_delivery_command_once"
            ),
        ]


class MaterialRequestVoid(LabFact):
    request = models.OneToOneField(MaterialRequest, on_delete=models.PROTECT, related_name="void")
    reason = models.TextField()
