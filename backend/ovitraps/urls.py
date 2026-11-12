from rest_framework.routers import SimpleRouter

from ovitraps.label_views import FieldOvitrapLabelViewSet, OvitrapLabelViewSet
from ovitraps.views import BagViewSet, OvitrapViewSet, ReadingViewSet

router = SimpleRouter()
router.register("ovitraps", OvitrapViewSet, basename="ovitrap")
router.register("readings", ReadingViewSet, basename="reading")
router.register("bags", BagViewSet, basename="bag")
router.register("ovitrap-labels", OvitrapLabelViewSet, basename="ovitrap-label")
router.register("field/ovitrap-labels", FieldOvitrapLabelViewSet, basename="field-ovitrap-label")
urlpatterns = router.urls
