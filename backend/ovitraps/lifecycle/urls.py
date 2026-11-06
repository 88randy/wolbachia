from rest_framework.routers import SimpleRouter

from ovitraps.lifecycle.views import RelocationViewSet, RemovalViewSet

router = SimpleRouter()
router.register("relocations", RelocationViewSet, basename="relocation")
router.register("ovitrap-removals", RemovalViewSet, basename="ovitrap-removal")
urlpatterns = router.urls
