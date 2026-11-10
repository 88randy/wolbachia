from django.urls import path
from rest_framework.routers import SimpleRouter

from geography.decisions.views import InterventionViewSet
from geography.map_tiles import MapTilesView
from geography.release_point_views import ReleasePointViewSet
from geography.views import BlockViewSet, QuadrantViewSet, SamplingPointViewSet

router = SimpleRouter()
router.register("quadrants", QuadrantViewSet, basename="quadrant")
router.register("blocks", BlockViewSet, basename="block")
router.register("sampling-points", SamplingPointViewSet, basename="sampling-point")
router.register("release-points", ReleasePointViewSet, basename="release-point")
router.register(
    "third-party-interventions", InterventionViewSet, basename="third-party-intervention"
)
urlpatterns = [
    path("map-tiles/<str:name>.pmtiles", MapTilesView.as_view(), name="map-tiles"),
    *router.urls,
]
