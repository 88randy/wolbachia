from rest_framework.routers import SimpleRouter

from field_sync.views import FieldBootstrapViewSet, FieldSyncViewSet

router = SimpleRouter()
router.register("field/sync", FieldSyncViewSet, basename="field-sync")

router.register("field/bootstrap", FieldBootstrapViewSet, basename="field-bootstrap")

urlpatterns = router.urls
