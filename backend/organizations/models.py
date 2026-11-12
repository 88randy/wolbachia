import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Now

from core.models import ImmutableMixin, OrgScopedModel
from organizations.validators import (
    validate_country_code,
    validate_permission_code,
    validate_timezone,
)

DEFAULT_LANGUAGE = "es-MX"
LANGUAGE_MAX_LENGTH = 10
PERMISSION_CODE_MAX_LENGTH = 100


def default_languages() -> list[str]:
    return [DEFAULT_LANGUAGE]


def default_scope() -> dict[str, dict[str, object]]:
    """A missing grant denies both dimensions; all is never inferred from an empty list."""
    return {"centers": {"mode": "none", "ids": []}, "quadrants": {"mode": "none", "ids": []}}


def all_scope() -> dict[str, dict[str, object]]:
    """Explicit organization-wide grant used only by the platform bootstrap/seed."""
    return {"centers": {"mode": "all", "ids": []}, "quadrants": {"mode": "all", "ids": []}}


class Organization(models.Model):
    """A company using the system. It is the tenant, so it is not itself org-scoped."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=64, unique=True)
    country = models.CharField(max_length=2, validators=[validate_country_code])
    timezone = models.CharField(max_length=64, validators=[validate_timezone])
    languages = ArrayField(
        models.CharField(max_length=LANGUAGE_MAX_LENGTH), default=default_languages
    )
    logo = models.FileField(upload_to="organizations/logos/", blank=True)
    epi_week = models.CharField(
        max_length=16, choices=[("iso", "ISO"), ("mmwr", "MMWR")], default="iso"
    )
    label_phone = models.CharField(max_length=40, blank=True)
    support_contact = models.CharField(max_length=200, blank=True)
    logo_content = models.BinaryField(default=bytes, blank=True)
    revision = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.slug


class Profile(OrgScopedModel):
    """A role as data: labels and permission codes configured per organization."""

    slug = models.SlugField(max_length=64)
    label_es = models.CharField(max_length=100)
    label_en = models.CharField(max_length=100)
    permission_codes = ArrayField(
        models.CharField(
            max_length=PERMISSION_CODE_MAX_LENGTH, validators=[validate_permission_code]
        ),
        default=list,
        blank=True,
    )
    scope = models.JSONField(default=default_scope)
    revision = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    # Seed bookkeeping: the default permission seed grants a code at most once (so a code an admin
    # revoked is never granted again) and only to profiles the seed itself created.
    seeded_permission_codes = ArrayField(
        models.CharField(max_length=PERMISSION_CODE_MAX_LENGTH), default=list, blank=True
    )
    created_by_seed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="profile_unique_slug_per_organization"
            )
        ]

    def __str__(self) -> str:
        return self.slug


class Membership(OrgScopedModel):
    """A user's place in one organization: profiles (roles) and work scope."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="memberships"
    )
    profiles = models.ManyToManyField(Profile, related_name="memberships", blank=True)
    scope = models.JSONField(default=default_scope)
    revision = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"], name="membership_unique_user_per_organization"
            )
        ]

    def clean(self) -> None:
        from organizations.scope import normalize_scope

        try:
            normalize_scope(self.scope)
        except ValueError as error:
            raise ValidationError({"scope": str(error)}) from error


class Center(OrgScopedModel):
    """An operational center; deactivate rather than delete."""

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    # Database defaults keep inserts from code that predates these columns working.
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    deactivated_reason = models.CharField(max_length=500, blank=True, db_default="")

    class Meta:
        ordering = ["code", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="center_unique_code_per_organization"
            )
        ]

    def __str__(self) -> str:
        return self.code


class ConfigurationRevision(ImmutableMixin, OrgScopedModel):
    """Append-only settings, ProfilePermission and Membership audit snapshots."""

    kind = models.CharField(
        max_length=16,
        choices=[("organization", "Organization"), ("role", "Role"), ("membership", "Membership")],
    )
    target_id = models.UUIDField()
    revision = models.PositiveIntegerField()
    snapshot = models.JSONField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "kind", "target_id", "revision"],
                name="configuration_revision_unique",
            )
        ]


class CodeCounter(OrgScopedModel):
    """The last number handed out for one kind of short human code (LIB-0042) in an organization.

    A row is locked with FOR UPDATE NOWAIT while a code is allocated (see
    `organizations.codes.allocate_code`), so two writers never get the same number. It is the one
    mutable table next to the insert-only records: the counter only ever grows.
    """

    kind = models.CharField(max_length=30)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "kind"], name="organizations_codecounter_kind"
            )
        ]
