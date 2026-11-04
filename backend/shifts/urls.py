from rest_framework.routers import SimpleRouter

from shifts.views import ShiftViewSet

router = SimpleRouter()
router.register("shifts", ShiftViewSet, basename="shift")

urlpatterns = router.urls
