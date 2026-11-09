from rest_framework.routers import SimpleRouter

from lab.views import (
    EggCountViewSet,
    LabDiscrepancyViewSet,
    LabMethodViewSet,
    LabReceptionViewSet,
    LabRejectionViewSet,
    ReceptionPolicyViewSet,
    RecountRequestViewSet,
)

router = SimpleRouter()
router.register("egg-counts", EggCountViewSet, basename="egg-count")
router.register("lab-rejections", LabRejectionViewSet, basename="lab-rejection")
router.register("lab-receptions", LabReceptionViewSet, basename="lab-reception")
router.register(
    "lab-reception-discrepancies", LabDiscrepancyViewSet, basename="lab-reception-discrepancy"
)
router.register("lab-methods", LabMethodViewSet, basename="lab-method")
router.register(
    "lab-reception-incident-policy",
    ReceptionPolicyViewSet,
    basename="lab-reception-incident-policy",
)
router.register("recount-requests", RecountRequestViewSet, basename="recount-request")
urlpatterns = router.urls
