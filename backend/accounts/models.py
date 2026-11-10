import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models

from core.models import ImmutableMixin, OrgScopedModel

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


class SessionEndBasis(models.TextChoices):
    TOKEN_EXPIRY = "token_expiry"  # noqa: S105 -- persisted non-secret end basis.
    REVOCATION_WINDOW = "revocation_window"
    LEGACY_EMPTY = "legacy_empty"


class SessionHoldPurpose(models.TextChoices):
    SECURITY_INVESTIGATION = "security_investigation"


class DeviceSession(OrgScopedModel):
    """One login of a user on a device. Its token pairs are `TokenPair` rows (hashes only).

    A session is revoked, never deleted. `organization` pins the session: the tokens only work
    in that organization.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="device_sessions",
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
    ended_at = models.DateTimeField(null=True, blank=True)
    end_basis = models.CharField(max_length=30, choices=SessionEndBasis.choices, blank=True)
    end_reason = models.CharField(
        max_length=30,
        choices=[*RevokeReason.choices, ("expired", "Expired"), ("unknown", "Unknown")],
        blank=True,
    )
    retention_anchor = models.DateTimeField(null=True, blank=True)
    dissociated_at = models.DateTimeField(null=True, blank=True)
    hold_until = models.DateTimeField(null=True, blank=True)
    hold_purpose = models.CharField(max_length=30, choices=SessionHoldPurpose.choices, blank=True)
    hold_reference = models.UUIDField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(revoked_at__isnull=True, revoke_reason="")
                    | (models.Q(revoked_at__isnull=False) & ~models.Q(revoke_reason=""))
                ),
                name="devicesession_revoke_fields_consistent",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(user__isnull=False, dissociated_at__isnull=True)
                    | models.Q(
                        user__isnull=True,
                        dissociated_at__isnull=False,
                        created_by__isnull=True,
                        revoked_by__isnull=True,
                        last_used_at__isnull=True,
                        final_upload_deadline__isnull=True,
                        final_upload_used_at__isnull=True,
                        hold_until__isnull=True,
                        hold_purpose="",
                        hold_reference__isnull=True,
                        retention_anchor__isnull=False,
                    )
                    & ~models.Q(end_basis="")
                ),
                name="devicesession_dissociated_fields",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        end_basis="",
                        end_reason="",
                        ended_at__isnull=True,
                        retention_anchor__isnull=True,
                    )
                    | models.Q(
                        end_basis=SessionEndBasis.LEGACY_EMPTY,
                        end_reason="unknown",
                        ended_at__isnull=True,
                        retention_anchor__isnull=False,
                        revoked_at__isnull=True,
                    )
                    | models.Q(
                        end_basis=SessionEndBasis.TOKEN_EXPIRY,
                        end_reason="expired",
                        ended_at__isnull=False,
                        retention_anchor=models.F("ended_at"),
                        retention_anchor__isnull=False,
                        revoked_at__isnull=True,
                    )
                    | models.Q(
                        end_basis=SessionEndBasis.REVOCATION_WINDOW,
                        ended_at__isnull=False,
                        retention_anchor=models.F("ended_at"),
                        retention_anchor__isnull=False,
                        revoked_at__isnull=False,
                        end_reason=models.F("revoke_reason"),
                        ended_at__gte=models.F("revoked_at"),
                    )
                ),
                name="devicesession_end_proof_consistent",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(hold_until__isnull=True, hold_purpose="", hold_reference__isnull=True)
                    | models.Q(
                        hold_until__isnull=False,
                        hold_purpose=SessionHoldPurpose.SECURITY_INVESTIGATION,
                        hold_reference__isnull=False,
                    )
                ),
                name="devicesession_hold_consistent",
            ),
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
    closes the window for further duplicates. Ended families are pruned together by the
    retention service (#54); the DeviceSession audit row is always kept.
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


class Personnel(OrgScopedModel):
    """Organization-private personnel state; the shared login identity is never edited here."""

    membership = models.OneToOneField(
        "organizations.Membership", on_delete=models.PROTECT, related_name="personnel"
    )
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", on_delete=models.PROTECT, related_name="+", null=True, blank=True
    )
    display_name = models.CharField(max_length=200)
    work_email = models.EmailField(blank=True)
    work_phone = models.CharField(max_length=40, blank=True)
    revision = models.PositiveIntegerField(default=1)
    rfc_ciphertext = models.BinaryField(default=bytes, blank=True)
    rfc_nonce = models.BinaryField(default=bytes, blank=True)
    rfc_wrapped_key = models.BinaryField(default=bytes, blank=True)
    rfc_key_version = models.CharField(max_length=2048, blank=True)
    rfc_fingerprint = models.CharField(max_length=64, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "rfc_fingerprint"],
                condition=~models.Q(rfc_fingerprint=""),
                name="personnel_unique_org_rfc",
            ),
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False), name="personnel_real_author"
            ),
        ]


class AccessLog(ImmutableMixin, OrgScopedModel):
    """Durable, closed-vocabulary receipts: never RFC, contact data, URLs or request bodies."""

    class Action(models.TextChoices):
        CREATE = "user.create"
        UPDATE = "user.update"
        DEACTIVATE = "user.deactivate"
        REVEAL_RFC = "user.reveal_rfc"
        ROTATE_RFC = "user.rotate_rfc"

    class Origin(models.TextChoices):
        WEB = "web"
        DEVICE = "device"
        INTERNAL = "internal"

    target = models.ForeignKey(Personnel, on_delete=models.PROTECT, related_name="access_receipts")
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", on_delete=models.PROTECT, related_name="+", null=True, blank=True
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    origin = models.CharField(max_length=16, choices=Origin.choices)
    result = models.CharField(max_length=32, choices=[("success", "Success")], default="success")
    revision = models.PositiveIntegerField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False), name="accesslog_real_actor"
            ),
        ]
        indexes = [models.Index(fields=["organization", "-created_at", "id"])]
