from rest_framework.routers import SimpleRouter

from geography.views import BlockViewSet, QuadrantViewSet, SamplingPointViewSet

router = SimpleRouter()
router.register("quadrants", QuadrantViewSet, basename="quadrant")
router.register("blocks", BlockViewSet, basename="block")
router.register("sampling-points", SamplingPointViewSet, basename="sampling-point")
urlpatterns = router.urls
