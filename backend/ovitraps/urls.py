from rest_framework.routers import SimpleRouter

from ovitraps.views import BagViewSet, OvitrapViewSet, ReadingViewSet

router = SimpleRouter()
router.register("ovitraps", OvitrapViewSet, basename="ovitrap")
router.register("readings", ReadingViewSet, basename="reading")
router.register("bags", BagViewSet, basename="bag")
urlpatterns = router.urls
