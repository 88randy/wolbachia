"""B-12 routes; no organization selector, DELETE or void route."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from scheduling.views import (
    AssignmentViewSet,
    ImportViewSet,
    RiskCategoryViewSet,
    ScheduleViewSet,
    UploadViewSet,
)

router = SimpleRouter()
router.register(
    "risk-category-import-uploads", UploadViewSet, basename="risk-category-import-upload"
)
router.register("risk-category-imports", ImportViewSet, basename="risk-category-import")
router.register("risk-categories", RiskCategoryViewSet, basename="risk-category")
router.register("schedule", ScheduleViewSet, basename="schedule")
urlpatterns = [
    path(
        "quadrant-assignments/",
        AssignmentViewSet.as_view({"get": "list", "put": "update"}),
        name="quadrant-assignment-list",
    ),
    *router.urls,
]
