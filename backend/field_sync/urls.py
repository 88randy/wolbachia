from rest_framework.routers import SimpleRouter

from field_sync.views import FieldBootstrapViewSet, FieldSyncViewSet, FieldZonesViewSet

router = SimpleRouter()
router.register("field/sync", FieldSyncViewSet, basename="field-sync")

router.register("field/zones", FieldZonesViewSet, basename="field-zones")
router.register("field/bootstrap", FieldBootstrapViewSet, basename="field-bootstrap")

urlpatterns = router.urls
