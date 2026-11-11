"""Platform-level role and its audit trail: the only cross-organization records of the system.

A platform admin manages organizations (create, configure, suspend) through `/api/v1/platform/`
only. The role grants NO access to organization business data: that still requires a normal
membership with profiles in that organization.
"""

import uuid

from django.conf import settings
from django.db import models

from core.exceptions import PhysicalDeleteForbiddenError
from core.models import DELETE_FORBIDDEN_MESSAGE, ImmutableMixin


class PlatformAdmin(models.Model):
    """A user allowed to manage organizations. Deactivated, never deleted."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="platform_admin"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )

    def __str__(self) -> str:
        return str(self.user_id)

    def delete(
        self, using: str | None = None, keep_parents: bool = False
    ) -> tuple[int, dict[str, int]]:
        raise PhysicalDeleteForbiddenError(DELETE_FORBIDDEN_MESSAGE)


class PlatformAuditEntry(ImmutableMixin, models.Model):
    """Insert-only receipt of one platform action. Never holds passwords, tokens or file bytes."""

    class Action(models.TextChoices):
        ORGANIZATION_CREATE = "organization.create"
        ORGANIZATION_DEFAULTS_APPLY = "organization.defaults_apply"
        ORGANIZATION_LOGO_UPLOAD = "organization.logo_upload"
        ORGANIZATION_SUSPEND = "organization.suspend"
        ORGANIZATION_REACTIVATE = "organization.reactivate"
        CENTER_CREATE = "center.create"
        CENTER_UPDATE = "center.update"
        CENTER_DEACTIVATE = "center.deactivate"
        CENTER_REACTIVATE = "center.reactivate"
        ADMIN_CREATE = "admin.create"
        PLATFORM_ADMIN_GRANT = "platform_admin.grant"
        PLATFORM_ADMIN_REVOKE = "platform_admin.revoke"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=40, choices=Action.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    target_id = models.UUIDField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta(ImmutableMixin.Meta):
        indexes = [models.Index(fields=["organization", "-created_at"], name="platform_audit_org")]

    def __str__(self) -> str:
        return f"{self.action} {self.created_at}"

    def delete(
        self, using: str | None = None, keep_parents: bool = False
    ) -> tuple[int, dict[str, int]]:
        raise PhysicalDeleteForbiddenError(DELETE_FORBIDDEN_MESSAGE)
