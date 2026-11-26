"""Contracts of `/api/v1/platform/`. Inputs are validated here; outputs never carry secrets
except the one-time `temporary_password` of a create response."""

import re
from collections.abc import Callable
from typing import Any

from django.contrib.auth.validators import UnicodeUsernameValidator
from rest_framework import serializers

from accounts.models import User
from core.void_reason import VOID_REASON_MAX_LENGTH, void_reason_min_length
from organizations.centers import CENTER_CODE_PATTERN
from organizations.models import Center, Organization
from organizations.validators import validate_country_code, validate_timezone
from platform_admin.models import PlatformAuditEntry

SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
MAX_CENTERS = 20
LANGUAGES = ["es-MX", "en"]
DELIVERIES = ["password", "invite"]


RESERVED_SLUGS = frozenset({"new-organization"})  # the web wizard's own path segment


def _validate_slug(value: str) -> None:
    if not SLUG_PATTERN.fullmatch(value) or value in RESERVED_SLUGS:
        raise serializers.ValidationError("Invalid slug.", code="invalid_slug")


def _validate_center_code(value: str) -> None:
    if not CENTER_CODE_PATTERN.fullmatch(value):
        raise serializers.ValidationError("Invalid center code.", code="invalid_code")


def _django_validator(validator: Callable[[str], object]) -> Callable[[str], None]:
    """Run a Django validator and keep its machine code in the DRF error."""
    from django.core.exceptions import ValidationError

    def run(value: str) -> None:
        try:
            validator(value)
        except ValidationError as error:
            raise serializers.ValidationError(
                error.messages[0], code=error.code or "invalid"
            ) from error

    return run


class CenterInputSerializer(serializers.Serializer[Any]):
    code = serializers.CharField(max_length=50, validators=[_validate_center_code])
    name = serializers.CharField(max_length=200)


class AdminInputSerializer(serializers.Serializer[Any]):
    admin_first_name = serializers.CharField(max_length=150)
    admin_last_name = serializers.CharField(max_length=150)
    admin_username = serializers.CharField(
        max_length=150, validators=[_django_validator(UnicodeUsernameValidator())]
    )
    admin_email = serializers.EmailField(max_length=254)
    admin_delivery = serializers.ChoiceField(choices=DELIVERIES)


class ProvisionSerializer(AdminInputSerializer):
    name = serializers.CharField(max_length=200)
    slug = serializers.CharField(max_length=64, validators=[_validate_slug])
    country = serializers.CharField(
        max_length=2, validators=[_django_validator(validate_country_code)]
    )
    timezone = serializers.CharField(
        max_length=64, validators=[_django_validator(validate_timezone)]
    )
    epi_week = serializers.ChoiceField(choices=["iso", "mmwr"])
    languages = serializers.ListField(
        child=serializers.ChoiceField(choices=LANGUAGES), allow_empty=False, max_length=2
    )
    centers = CenterInputSerializer(many=True, allow_empty=False)

    def validate_centers(self, value: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(value) > MAX_CENTERS:
            raise serializers.ValidationError(f"At most {MAX_CENTERS} centers.", code="max_length")
        return value

    def validate_languages(self, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Repeated language.", code="duplicate")
        return value


class ReasonSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(max_length=VOID_REASON_MAX_LENGTH, trim_whitespace=True)

    def validate_reason(self, value: str) -> str:
        minimum = void_reason_min_length()
        if len(value) < minimum:
            raise serializers.ValidationError(f"At least {minimum} characters.", code="min_length")
        return value


class LogoInputSerializer(serializers.Serializer[Any]):
    logo = serializers.FileField(max_length=100)


class AvailabilityQuerySerializer(serializers.Serializer[Any]):
    slug = serializers.CharField(max_length=64, required=False, allow_blank=True)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)


class AvailabilitySerializer(serializers.Serializer[Any]):
    slug_available = serializers.BooleanField(allow_null=True)
    username_available = serializers.BooleanField(allow_null=True)


class PlatformOrganizationQuerySerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=["active", "suspended"], required=False)


class PlatformOrganizationSerializer(serializers.ModelSerializer[Organization]):
    users_count = serializers.IntegerField(read_only=True)
    centers_count = serializers.IntegerField(read_only=True)
    has_logo = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "slug",
            "name",
            "country",
            "timezone",
            "is_active",
            "users_count",
            "centers_count",
            "has_logo",
            "created_at",
        ]
        read_only_fields = fields

    def get_has_logo(self, organization: Organization) -> bool:
        return bool(organization.logo_content)


class PlatformCenterSerializer(serializers.ModelSerializer[Center]):
    class Meta:
        model = Center
        fields = ["code", "name", "is_active"]
        read_only_fields = fields


class PlatformAdminUserSerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "email", "is_active"]
        read_only_fields = fields


class PlatformHistorySerializer(serializers.ModelSerializer[PlatformAuditEntry]):
    actor_name = serializers.SerializerMethodField()
    reason = serializers.SerializerMethodField()

    class Meta:
        model = PlatformAuditEntry
        fields = ["action", "created_at", "actor_name", "reason"]
        read_only_fields = fields

    def get_actor_name(self, entry: PlatformAuditEntry) -> str:
        actor = entry.actor
        if actor is None:
            return ""
        return actor.get_full_name() or actor.username

    def get_reason(self, entry: PlatformAuditEntry) -> str:
        value = entry.details.get("reason", "") if isinstance(entry.details, dict) else ""
        return value if isinstance(value, str) else ""


class PlatformOrganizationDetailSerializer(serializers.Serializer[Any]):
    slug = serializers.CharField()
    name = serializers.CharField()
    country = serializers.CharField()
    timezone = serializers.CharField()
    languages = serializers.ListField(child=serializers.CharField())
    epi_week = serializers.CharField()
    is_active = serializers.BooleanField()
    has_logo = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    centers = PlatformCenterSerializer(many=True)
    admins = PlatformAdminUserSerializer(many=True)
    history = PlatformHistorySerializer(many=True)


class CreatedAdminSerializer(serializers.Serializer[Any]):
    username = serializers.CharField()
    delivery = serializers.ChoiceField(choices=DELIVERIES)
    temporary_password = serializers.CharField(allow_null=True)


class ProvisionResponseSerializer(serializers.Serializer[Any]):
    organization = PlatformOrganizationDetailSerializer()
    admin = CreatedAdminSerializer()


class DefaultsResultSerializer(serializers.Serializer[Any]):
    profiles = serializers.IntegerField()
    catalogs = serializers.IntegerField()
    parameters = serializers.IntegerField()
