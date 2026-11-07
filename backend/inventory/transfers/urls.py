from rest_framework.routers import SimpleRouter

from inventory.transfers.views import DiscrepancyViewSet, TransferViewSet

router = SimpleRouter()
router.register("transfers", TransferViewSet, basename="transfer")
router.register("discrepancies", DiscrepancyViewSet, basename="discrepancy")
urlpatterns = router.urls
