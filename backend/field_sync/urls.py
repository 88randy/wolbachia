from rest_framework.routers import SimpleRouter

from field_sync.views import FieldSyncViewSet

router = SimpleRouter()
router.register("field/sync", FieldSyncViewSet, basename="field-sync")

urlpatterns = router.urls
