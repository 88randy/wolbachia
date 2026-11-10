from django.urls import include, path
from rest_framework.routers import SimpleRouter

from lab.independent_qa.views import EggPaddleViewSet, LabQAPolicyViewSet, RecountViewSet
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
router.register("recounts", RecountViewSet, basename="recount")
router.register("lab-qa-policy", LabQAPolicyViewSet, basename="lab-qa-policy")
router.register("egg-paddles", EggPaddleViewSet, basename="egg-paddle")
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
urlpatterns = [path("", include("lab.samples.urls")), *router.urls]
