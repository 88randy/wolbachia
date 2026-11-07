from django.urls import path
from rest_framework.routers import SimpleRouter

from inventory.allocations.views import (
    InventoryIntentViewSet,
    MaterialMappingViewSet,
    SupplyAssignmentViewSet,
    SupplyReconciliationViewSet,
    TransitConfigurationViewSet,
    WriteOffViewSet,
)

router = SimpleRouter()
router.register("courier-assignments", SupplyAssignmentViewSet, basename="courier-assignment")
router.register("reconciliations", SupplyReconciliationViewSet, basename="supply-reconciliation")
router.register("inventory-intents", InventoryIntentViewSet, basename="inventory-intent")
router.register("write-offs", WriteOffViewSet, basename="write-off")

urlpatterns = [
    *router.urls,
    path(
        "supply-types/<uuid:supply_id>/transit-policies/",
        TransitConfigurationViewSet.as_view({"get": "list", "post": "create"}),
        name="supply-transit-policy",
    ),
    path(
        "supply-types/<uuid:supply_id>/material-mappings/",
        MaterialMappingViewSet.as_view({"get": "list", "post": "create"}),
        name="supply-material-mapping",
    ),
]
