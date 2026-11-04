"""URLs for tests: the real API plus the test-only routes of `tests.testapp`."""

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from config.urls import urlpatterns as api_urlpatterns
from tests.testapp.views import (
    BoomView,
    RestrictedWidgetViewSet,
    StreamWidgetViewSet,
    ThrottledView,
    WidgetViewSet,
)

router = SimpleRouter()
router.register("widgets", WidgetViewSet, basename="widget")
router.register("restricted-widgets", RestrictedWidgetViewSet, basename="restricted-widget")
router.register("stream-widgets", StreamWidgetViewSet, basename="stream-widget")

urlpatterns = [
    *api_urlpatterns,
    path("api/v1/", include(router.urls)),
    path("api/v1/boom/", BoomView.as_view()),
    path("api/v1/throttled/", ThrottledView.as_view()),
]
