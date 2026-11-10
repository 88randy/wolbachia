"""Organization configuration and explicit scope API contracts."""

from typing import Any

from rest_framework import serializers

from core.author_names import AuthorNameField
from core.serializers import OrgScopedModelSerializer
from organizations.models import Center, Membership, Organization, Profile
from organizations.validators import validate_permission_code, validate_timezone


class MeUserSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class MeOrganizationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    slug = serializers.SlugField()
    name = serializers.CharField()
    country = serializers.CharField()
    timezone = serializers.CharField()
    languages = serializers.ListField(child=serializers.CharField())
    epi_week = serializers.ChoiceField(choices=["iso", "mmwr"])
    label_phone = serializers.CharField(allow_blank=True)
    support_contact = serializers.CharField(allow_blank=True)
    logo_url = serializers.SerializerMethodField()

    def get_logo_url(self, organization: Organization) -> str | None:
        return "/api/v1/organization/logo/" if organization.logo_content else None


class MeOrganizationChoiceSerializer(serializers.Serializer[Any]):
    slug = serializers.SlugField()
    name = serializers.CharField()


class MeProfileSerializer(serializers.Serializer[Any]):
    slug = serializers.SlugField()
    label_es = serializers.CharField()
    label_en = serializers.CharField()


class ScopeDimensionSerializer(serializers.Serializer[Any]):
    mode = serializers.ChoiceField(choices=["none", "selected", "all"])
    ids = serializers.ListField(child=serializers.CharField(), allow_empty=True)


class MeScopeSerializer(serializers.Serializer[Any]):
    centers = ScopeDimensionSerializer()
    quadrants = ScopeDimensionSerializer()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        from organizations.scope import normalize_scope

        try:
            return dict(normalize_scope(attrs))
        except ValueError as error:
            raise serializers.ValidationError("Invalid scope.", code="invalid_scope") from error


class MeLimitsSerializer(serializers.Serializer[Any]):
    void_reason_min_length = serializers.IntegerField()
    void_reason_max_length = serializers.IntegerField()


class MeSerializer(serializers.Serializer[Any]):
    """`organization` is null when the user has several organizations and sent no header."""

    user = MeUserSerializer()
    organization = MeOrganizationSerializer(allow_null=True)
    profiles = MeProfileSerializer(many=True)
    permissions = serializers.ListField(child=serializers.CharField())
    scope = MeScopeSerializer()
    organizations = MeOrganizationChoiceSerializer(many=True)
    limits = MeLimitsSerializer()
    is_platform_admin = serializers.BooleanField()
    must_change_password = serializers.BooleanField(source="user.must_change_password")


class CenterSerializer(OrgScopedModelSerializer):
    class Meta:
        model = Center
        fields = ["id", "code", "name"]
        read_only_fields = fields


class OrganizationSettingsSerializer(MeOrganizationSerializer):
    revision = serializers.IntegerField()


class OrganizationUpdateSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=200, required=False)
    timezone = serializers.CharField(max_length=64, validators=[validate_timezone], required=False)
    languages = serializers.ListField(
        child=serializers.ChoiceField(choices=["es-MX", "en"]), allow_empty=False, required=False
    )
    epi_week = serializers.ChoiceField(choices=["iso", "mmwr"], required=False)
    label_phone = serializers.CharField(max_length=40, allow_blank=True, required=False)
    support_contact = serializers.CharField(max_length=200, allow_blank=True, required=False)


class ProfileSerializer(OrgScopedModelSerializer):
    permissions = serializers.ListField(
        source="permission_codes", child=serializers.CharField(), read_only=True
    )
    scope = MeScopeSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = [
            "id",
            "slug",
            "label_es",
            "label_en",
            "permissions",
            "scope",
            "is_active",
            "revision",
        ]
        read_only_fields = fields


class ProfilePermissionSerializer(serializers.Serializer[Any]):
    permissions = serializers.ListField(
        child=serializers.CharField(max_length=100, validators=[validate_permission_code])
    )
    scope = MeScopeSerializer()
    expected_revision = serializers.IntegerField(min_value=1)


class MembershipSerializer(OrgScopedModelSerializer):
    scope = MeScopeSerializer(read_only=True)
    user_display_name = AuthorNameField("user")

    class Meta:
        model = Membership
        fields = [
            "id",
            "user",
            "user_display_name",
            "profiles",
            "scope",
            "is_active",
            "revision",
            "created_at",
            "created_by",
        ]
        read_only_fields = fields


class MembershipChangeSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=1)
    scope = MeScopeSerializer()
    profiles = serializers.ListField(child=serializers.UUIDField(), required=False)
    is_active = serializers.BooleanField(required=False)


class MembershipCreateSerializer(serializers.Serializer[Any]):
    user = serializers.UUIDField()
    profiles = serializers.ListField(child=serializers.UUIDField())
    scope = MeScopeSerializer()


class LogoUploadSerializer(serializers.Serializer[Any]):
    expected_revision = serializers.IntegerField(min_value=1)
    logo = serializers.FileField(max_length=100)
