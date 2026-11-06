from rest_framework.routers import DefaultRouter

from incidents.views import IncidentTypeViewSet, IncidentViewSet

router = DefaultRouter()
router.register("incidents", IncidentViewSet, basename="fleet-incident")
router.register("incident-types", IncidentTypeViewSet, basename="incident-type")
urlpatterns = router.urls
