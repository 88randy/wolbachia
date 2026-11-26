from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from platform_admin.selectors import is_platform_admin


class IsPlatformAdmin(BasePermission):
    """Only an active user with an active platform role (403 `permission_denied` otherwise)."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return is_platform_admin(request.user)


class PlatformReadThrottle(UserRateThrottle):
    scope = "platform"


class PlatformWriteThrottle(UserRateThrottle):
    """Writes (create, logo, suspend...) have their own, lower budget per user."""

    scope = "platform_write"
