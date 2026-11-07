from rest_framework.routers import DefaultRouter

from community.views import CommunityActivityViewSet

router = DefaultRouter()
router.register("community-activities", CommunityActivityViewSet, basename="community-activity")
urlpatterns = router.urls
