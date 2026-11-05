from django.urls import path
from rest_framework.routers import SimpleRouter

from organizations.views import (
    CenterViewSet,
    MembershipViewSet,
    OrganizationViewSet,
    ProfileViewSet,
)

router = SimpleRouter()
router.register("centers", CenterViewSet, basename="center")
router.register("roles", ProfileViewSet, basename="role")
router.register("memberships", MembershipViewSet, basename="membership")

urlpatterns = [
    path(
        "organization/",
        OrganizationViewSet.as_view({"get": "retrieve", "patch": "partial_update"}),
        name="organization",
    ),
    path(
        "organization/logo/",
        OrganizationViewSet.as_view({"get": "logo", "post": "upload_logo"}),
        name="organization-logo",
    ),
    *router.urls,
]
