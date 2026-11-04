import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models

from core.models import OrgScopedModel
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


def default_scope() -> dict[str, list[str]]:
    """Until Center and Quadrant models exist, scope holds their ids as plain lists."""
    return {"centers": [], "quadrants": []}


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
    is_active = models.BooleanField(default=True)

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
    is_active = models.BooleanField(default=True)

    def clean(self) -> None:
        """`scope` is a JSON object whose known keys hold lists (ids of centers and quadrants)."""
        known_keys = default_scope().keys()
        scope = self.scope
        if not isinstance(scope, dict) or not all(
            isinstance(scope.get(key, []), list) for key in known_keys
        ):
            raise ValidationError(
                {"scope": "Use an object with list values for centers and quadrants."}
            )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"], name="membership_unique_user_per_organization"
            )
        ]
