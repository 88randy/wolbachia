from rest_framework.routers import SimpleRouter

from lab.samples.views import SampleViewSet

router = SimpleRouter()
router.register("wolbachia-samples", SampleViewSet, basename="wolbachia-sample")
urlpatterns = router.urls
