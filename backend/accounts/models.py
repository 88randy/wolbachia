import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models

from core.models import OrgScopedModel

TOKEN_HASH_LENGTH = 64  # hex SHA-256


class User(AbstractUser):
    """Custom user from the first migration so the model can evolve (swapping it later is costly).

    The primary key is a UUID like every other API-visible record. Authentication flows (login,
    tokens, devices) live in this app; permissions come from organization memberships, not from
    here.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)


class Device(OrgScopedModel):
    """A registered phone. The primary key is the UUID the app generates at install time.

    Devices are revoked (`is_revoked`), never deleted. `serial` stays blank until a source for it
    exists [ASSUMPTION]: Android 10+ hides the hardware serial from normal apps, so it would come
    from dedicated-mode management.
    """

    label = models.CharField(max_length=100, blank=True)
    serial = models.CharField(max_length=100, blank=True)
    app_version = models.CharField(max_length=50, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    is_revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(is_revoked=False, revoked_at__isnull=True)
                    | models.Q(is_revoked=True, revoked_at__isnull=False)
                ),
                name="device_revoked_fields_consistent",
            )
        ]

    def __str__(self) -> str:
        return str(self.pk)


class RevokeReason(models.TextChoices):
    LOGOUT = "logout"
    ADMIN_REVOKE = "admin_revoke"
    DEVICE_REVOKED = "device_revoked"
    REFRESH_REUSE = "refresh_reuse"
    PASSWORD_CHANGED = "password_changed"  # noqa: S105
    USER_DEACTIVATED = "user_deactivated"
    SUPERSEDED = "superseded"  # a new login of the same user on the same device
    MEMBERSHIP_INACTIVE = "membership_inactive"  # the pinned organization membership ended


class DeviceSession(OrgScopedModel):
    """One login of a user on a device. Its token pairs are `TokenPair` rows (hashes only).

    A session is revoked, never deleted. `organization` pins the session: the tokens only work
    in that organization.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="device_sessions"
    )
    device = models.ForeignKey(Device, on_delete=models.PROTECT, related_name="sessions")
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    revoke_reason = models.CharField(max_length=30, choices=RevokeReason.choices, blank=True)
    final_upload_deadline = models.DateTimeField(null=True, blank=True)
    final_upload_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(revoked_at__isnull=True, revoke_reason="")
                    | (models.Q(revoked_at__isnull=False) & ~models.Q(revoke_reason=""))
                ),
                name="devicesession_revoke_fields_consistent",
            )
        ]
        indexes = [models.Index(fields=["user", "organization"], name="devicesession_user_org_idx")]

    def __str__(self) -> str:
        return str(self.pk)


class TokenPair(OrgScopedModel):
    """An access + refresh pair issued to a session. Only SHA-256 digests are stored.

    The tokens are 256-bit random values, so a fast hash is enough and lookups use the unique
    indexes. `created_at` is the issue time. A refresh exchanges a pair for a child pair
    (`parent`): the parent is `consumed_at` (refresh used) and `superseded_at` (its access token
    keeps working only for the grace window). A duplicate refresh inside the window adds a
    sibling child instead; `access_used_at` is the first time an access token was used, which
    closes the window for further duplicates. Rows are never deleted.
    """

    session = models.ForeignKey(DeviceSession, on_delete=models.PROTECT, related_name="token_pairs")
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="children"
    )
    access_hash = models.CharField(max_length=TOKEN_HASH_LENGTH, unique=True)
    access_expires_at = models.DateTimeField()
    refresh_hash = models.CharField(max_length=TOKEN_HASH_LENGTH, unique=True)
    refresh_expires_at = models.DateTimeField()
    access_used_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    superseded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(consumed_at__isnull=True, superseded_at__isnull=True)
                | models.Q(consumed_at__isnull=False, superseded_at__isnull=False),
                name="tokenpair_consumed_and_superseded_together",
            )
        ]
        indexes = [models.Index(fields=["session", "created_at"], name="tokenpair_session_idx")]

    def __str__(self) -> str:
        return str(self.pk)
