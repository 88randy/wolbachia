"""Routes of the platform app, mounted under `/api/v1/platform/` by `config.urls`."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from platform_admin.views import PlatformAvailabilityView, PlatformOrganizationViewSet

router = SimpleRouter()
router.register("organizations", PlatformOrganizationViewSet, basename="platform-organization")

urlpatterns = [
    path("availability/", PlatformAvailabilityView.as_view(), name="platform-availability"),
    *router.urls,
]
