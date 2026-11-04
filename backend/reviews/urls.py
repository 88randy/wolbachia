from rest_framework.routers import SimpleRouter

from reviews.views import ReviewItemViewSet

router = SimpleRouter()
router.register("review-items", ReviewItemViewSet, basename="review-item")

urlpatterns = router.urls
