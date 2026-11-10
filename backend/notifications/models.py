"""Immutable content, read receipts and preference versions; no physical deletion."""

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class NotificationKind(models.TextChoices):
    CRITICAL = "critical"
    INCIDENT = "incident"
    TRAINING = "training"
    SYSTEM = "system"


class Notification(ImmutableMixin, OrgScopedModel):
    recipient = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    kind = models.CharField(max_length=16, choices=NotificationKind.choices)
    code = models.CharField(max_length=64)
    params = models.JSONField(default=dict)
    center_id = models.UUIDField(null=True)
    quadrant_id = models.UUIDField(null=True)
    object_kind = models.CharField(max_length=16, blank=True)
    object_id = models.UUIDField(null=True)

    class Meta(ImmutableMixin.Meta):
        indexes = [models.Index(fields=["organization", "recipient", "-created_at", "-id"])]


class NotificationRead(ImmutableMixin, OrgScopedModel):
    notification = models.OneToOneField(
        Notification, on_delete=models.PROTECT, related_name="read_receipt"
    )


class PreferenceVersion(ImmutableMixin, OrgScopedModel):
    recipient = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    kind = models.CharField(max_length=16, choices=NotificationKind.choices)
    revision = models.PositiveIntegerField()
    in_app = models.BooleanField()
    email = models.BooleanField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "kind", "revision"], name="notification_preference_revision"
            )
        ]
