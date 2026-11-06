from rest_framework.routers import SimpleRouter

from ovitraps.lifecycle.views import RelocationViewSet

router = SimpleRouter()
router.register("relocations", RelocationViewSet, basename="relocation")
urlpatterns = router.urls
