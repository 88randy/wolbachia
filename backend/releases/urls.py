from rest_framework.routers import SimpleRouter

from releases.views import PermitTypeViewSet, PermitViewSet, ReleaseDeviceViewSet, ReleaseViewSet

router = SimpleRouter()
router.register("permit-types", PermitTypeViewSet, basename="permit-type")
router.register("permits", PermitViewSet, basename="permit")
router.register("release-devices", ReleaseDeviceViewSet, basename="release-device")
router.register("releases", ReleaseViewSet, basename="release")
urlpatterns = router.urls
