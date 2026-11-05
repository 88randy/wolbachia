from django.urls import path
from rest_framework.routers import DefaultRouter

from fleet.views import (
    ClearanceViewSet,
    FuelLoadViewSet,
    IncidentViewSet,
    LetterViewSet,
    ServiceViewSet,
)

router = DefaultRouter()
router.register("fuel-loads", FuelLoadViewSet, basename="fuel-load")
router.register("incidents", IncidentViewSet, basename="fleet-incident")
urlpatterns = [
    path(
        "motorcycles/<uuid:pk>/clear-fault/",
        ClearanceViewSet.as_view({"post": "create"}),
        name="motorcycle-clear-fault",
    ),
    path(
        "motorcycles/<uuid:motorcycle_id>/services/",
        ServiceViewSet.as_view({"get": "list", "post": "create"}),
        name="motorcycle-services",
    ),
    path(
        "motorcycles/<uuid:motorcycle_id>/services/<uuid:pk>/void/",
        ServiceViewSet.as_view({"post": "void"}),
        name="motorcycle-service-void",
    ),
    path(
        "motorcycles/<uuid:motorcycle_id>/responsibility-letters/",
        LetterViewSet.as_view({"get": "list", "post": "create"}),
        name="motorcycle-letters",
    ),
    path(
        "motorcycles/<uuid:motorcycle_id>/responsibility-letters/<uuid:pk>/void/",
        LetterViewSet.as_view({"post": "void"}),
        name="motorcycle-letter-void",
    ),
    *router.urls,
]
