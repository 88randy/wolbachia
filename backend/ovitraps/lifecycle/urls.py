from rest_framework.routers import SimpleRouter

from ovitraps.lifecycle.field_views import FieldOvitrapAdvisoryViewSet
from ovitraps.lifecycle.views import RelocationViewSet, RemovalViewSet

router = SimpleRouter()
router.register("relocations", RelocationViewSet, basename="relocation")
router.register("ovitrap-removals", RemovalViewSet, basename="ovitrap-removal")
router.register(
    "field/ovitrap-advisories", FieldOvitrapAdvisoryViewSet, basename="ovitrap-advisory"
)
urlpatterns = router.urls
