from rest_framework.routers import SimpleRouter

from inventory.transfers.urls import urlpatterns as transfer_patterns
from inventory.views import LocationViewSet, LotViewSet, SupplyTypeViewSet

router = SimpleRouter()
router.register("supply-types", SupplyTypeViewSet, basename="supply-type")
router.register("locations", LocationViewSet, basename="location")
router.register("lots", LotViewSet, basename="lot")

urlpatterns = [*router.urls, *transfer_patterns]
