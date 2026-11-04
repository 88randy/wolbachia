"""Read-only serializers for `GET /me/` (plain `Serializer`s: the payload is not a model)."""

from typing import Any

from rest_framework import serializers

from organizations.models import Organization


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
    logo_url = serializers.SerializerMethodField()

    def get_logo_url(self, organization: Organization) -> str | None:
        return organization.logo.url if organization.logo else None


class MeOrganizationChoiceSerializer(serializers.Serializer[Any]):
    slug = serializers.SlugField()
    name = serializers.CharField()


class MeProfileSerializer(serializers.Serializer[Any]):
    slug = serializers.SlugField()
    label_es = serializers.CharField()
    label_en = serializers.CharField()


class MeScopeSerializer(serializers.Serializer[Any]):
    centers = serializers.ListField(child=serializers.CharField())
    quadrants = serializers.ListField(child=serializers.CharField())


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
