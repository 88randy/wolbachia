"""Routes of the privacy app, mounted under `/api/v1/` by `config.urls`."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from privacy.views import (
    ArcoRequestViewSet,
    ExportViewSet,
    PortalCoverageView,
    PortalHomeView,
    PortalReleasesByWeekView,
    PortalSettingsViewSet,
    TransferAuthorizationViewSet,
)

router = SimpleRouter()
router.register("data-transfers", TransferAuthorizationViewSet, basename="data-transfer")
router.register("export", ExportViewSet, basename="export")
router.register("arco-requests", ArcoRequestViewSet, basename="arco-request")
router.register("portal-settings", PortalSettingsViewSet, basename="portal-settings")

urlpatterns = [
    path("portal/<slug:org_slug>/", PortalHomeView.as_view(), name="portal-home"),
    path(
        "portal/<slug:org_slug>/releases-by-week/",
        PortalReleasesByWeekView.as_view(),
        name="portal-releases-by-week",
    ),
    path("portal/<slug:org_slug>/coverage/", PortalCoverageView.as_view(), name="portal-coverage"),
    *router.urls,
]
