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


class ArcoRequest(OrgScopedModel):
    """ARCO (access, rectification, cancellation, opposition) request; status moves forward."""

    class Kind(models.TextChoices):
        ACCESS = "access"
        RECTIFICATION = "rectification"
        CANCELLATION = "cancellation"
        OPPOSITION = "opposition"

    class Status(models.TextChoices):
        RECEIVED = "received"
        IN_PROGRESS = "in_progress"
        RESOLVED = "resolved"
        REJECTED = "rejected"

    request_type = models.CharField(max_length=16, choices=Kind.choices)
    # Opaque reference chosen by the officer; never the holder's name or contact data.
    requester_reference = models.CharField(max_length=200)
    received_on = models.DateField()
    due_on = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RECEIVED)
    owner = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    resolution_note = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["due_on", "id"]
        indexes = [models.Index(fields=["organization", "status", "due_on"])]


class PortalSettings(OrgScopedModel):
    """Public portal switches of one organization (disabled until an admin enables it)."""

    organization = models.OneToOneField(
        "organizations.Organization", on_delete=models.PROTECT, related_name="portal_settings"
    )
    enabled = models.BooleanField(default=False)
    # Subset of portal.PORTAL_INDICATORS.
    indicators = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)


class ExportLog(OrgScopedModel):
    """One receipt per official export (W57 history); filters only, never row values."""

    dataset = models.CharField(max_length=16)
    date_from = models.DateField()
    date_to = models.DateField()
    recipient_institution = models.CharField(max_length=200, blank=True)
    row_count = models.PositiveIntegerField()
    rfc_rows_released = models.PositiveIntegerField()

    class Meta:
        ordering = ["-created_at", "-id"]
