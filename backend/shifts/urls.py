from rest_framework.routers import SimpleRouter

from shifts.motorcycle_views import MotorcycleViewSet
from shifts.views import ShiftViewSet

router = SimpleRouter()
router.register("shifts", ShiftViewSet, basename="shift")

router.register("motorcycles", MotorcycleViewSet, basename="motorcycle")

urlpatterns = router.urls
