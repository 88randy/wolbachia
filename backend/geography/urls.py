from rest_framework.routers import SimpleRouter

from geography.decisions.views import InterventionViewSet
from geography.views import BlockViewSet, QuadrantViewSet, SamplingPointViewSet

router = SimpleRouter()
router.register("quadrants", QuadrantViewSet, basename="quadrant")
router.register("blocks", BlockViewSet, basename="block")
router.register("sampling-points", SamplingPointViewSet, basename="sampling-point")
router.register(
    "third-party-interventions", InterventionViewSet, basename="third-party-intervention"
)
urlpatterns = router.urls
