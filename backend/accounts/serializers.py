"""Request and response shapes of the authentication endpoints (docs/api-conventions.md)."""

from typing import Any

from rest_framework import serializers

from accounts.models import Device
from core.serializers import OrgScopedModelSerializer
from organizations.serializers import MeSerializer

USERNAME_MAX_LENGTH = 150
PASSWORD_MAX_LENGTH = 1024  # long passphrases are fine; this only bounds the hashing work
APP_VERSION_MAX_LENGTH = 50
LABEL_MAX_LENGTH = 100
TOKEN_MAX_LENGTH = 512


class LoginSerializer(serializers.Serializer[Any]):
    """With `device_id` the login is a mobile one (tokens); without it, a web session."""

    username = serializers.CharField(max_length=USERNAME_MAX_LENGTH)
    password = serializers.CharField(
        max_length=PASSWORD_MAX_LENGTH, trim_whitespace=False, write_only=True
    )
    device_id = serializers.UUIDField(required=False)
    app_version = serializers.CharField(
        max_length=APP_VERSION_MAX_LENGTH, required=False, allow_blank=True
    )
    # Declared fields are stripped from the class by DRF's metaclass, so `label` does not clash
    # with `Field.label` at runtime; mypy cannot know that.
    label = serializers.CharField(  # type: ignore[assignment]
        max_length=LABEL_MAX_LENGTH, required=False, allow_blank=True
    )


class MobileLoginResponseSerializer(serializers.Serializer[Any]):
    access = serializers.CharField()
    refresh = serializers.CharField()
    me = MeSerializer()
    server_time = serializers.DateTimeField()


class WebLoginResponseSerializer(serializers.Serializer[Any]):
    me = MeSerializer()
    server_time = serializers.DateTimeField()


class RefreshSerializer(serializers.Serializer[Any]):
    refresh = serializers.CharField(max_length=TOKEN_MAX_LENGTH, trim_whitespace=False)
    device_id = serializers.UUIDField()


class RefreshResponseSerializer(serializers.Serializer[Any]):
    access = serializers.CharField()
    refresh = serializers.CharField()
    server_time = serializers.DateTimeField()


class DeviceSerializer(OrgScopedModelSerializer):
    """Read-only view of a device for administrators (W67)."""

    last_user_username = serializers.CharField(
        source="last_user.username", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = Device
        fields = [
            "id",
            "label",
            "serial",
            "app_version",
            "last_seen_at",
            "last_user",
            "last_user_username",
            "is_revoked",
            "revoked_at",
            "revoked_by",
            "created_at",
        ]
        read_only_fields = fields


class DeviceFilterSerializer(serializers.Serializer[Any]):
    """Query parameters of `GET /devices/`."""

    is_revoked = serializers.BooleanField(required=False, allow_null=True)
    user = serializers.UUIDField(required=False)


class RevokedSessionsSerializer(serializers.Serializer[Any]):
    revoked_sessions = serializers.IntegerField()
