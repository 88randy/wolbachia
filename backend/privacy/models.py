"""Minimal B-24 transfer facts; protected personal values remain in their owner."""

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

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


class ApiKey(OrgScopedModel):
    """Read access of one institution to the portal data (W66). The secret is never stored.

    Only a SHA-256 digest of the secret is kept (it is 256 random bits, so a slow hash adds
    nothing); `prefix` is the public part used to find the row. Revocation is a fact on the row
    (who, when, why); nothing is deleted and the audit trail lives in `ApiKeyEvent`.
    """

    institution = models.CharField(max_length=200)
    prefix = models.CharField(max_length=12, unique=True)
    secret_digest = models.CharField(max_length=64)
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    # Subset of portal.PORTAL_INDICATORS.
    endpoints = models.JSONField()
    rate_limit_per_day = models.PositiveIntegerField()
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    revoke_reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(valid_until__gt=models.F("valid_from")),
                name="privacy_apikey_valid_interval",
            ),
            models.CheckConstraint(
                condition=models.Q(rate_limit_per_day__gt=0),
                name="privacy_apikey_rate_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(revoked_at__isnull=True, revoked_by__isnull=True, revoke_reason="")
                    | (
                        models.Q(revoked_at__isnull=False, revoked_by__isnull=False)
                        & ~models.Q(revoke_reason="")
                    )
                ),
                name="privacy_apikey_revocation_consistent",
            ),
            # One live key per institution: revoke it before issuing another.
            models.UniqueConstraint(
                models.F("organization"),
                Lower("institution"),
                condition=models.Q(revoked_at__isnull=True),
                name="privacy_apikey_one_live_per_institution",
            ),
        ]


class ApiKeyEvent(ImmutableMixin, OrgScopedModel):
    """Insert-only audit trail of a key: created or revoked, by whom (never the secret)."""

    key = models.ForeignKey(ApiKey, on_delete=models.PROTECT, related_name="events")
    kind = models.CharField(max_length=16, choices=[("created", "created"), ("revoked", "revoked")])
    detail = models.TextField(blank=True, default="")

    class Meta(ImmutableMixin.Meta):
        ordering = ["-created_at", "-id"]
