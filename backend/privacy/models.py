"""Minimal B-24 transfer facts; protected personal values remain in their owner."""

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class TransferFact(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False),
                name="%(app_label)s_%(class)s_author",
            )
        ]


class DataTransferAuthorization(TransferFact):
    recipient_institution = models.CharField(max_length=200)
    purpose = models.CharField(max_length=32, choices=[("uieb_shipment", "uieb_shipment")])
    fields = models.JSONField()
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", null=True, on_delete=models.PROTECT, related_name="+"
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    reference = models.CharField(max_length=1000)

    class Meta(TransferFact.Meta):
        constraints = [
            *TransferFact.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(valid_until__gt=models.F("valid_from")),
                name="privacy_transfer_valid_interval",
            ),
            models.CheckConstraint(
                condition=models.Q(purpose="uieb_shipment", fields=["rfc"]),
                name="privacy_transfer_supported_fields",
            ),
        ]


class DataTransferRevocation(TransferFact):
    authorization = models.OneToOneField(
        DataTransferAuthorization, on_delete=models.PROTECT, related_name="revocation"
    )
    reason = models.TextField()
