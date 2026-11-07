"""Root URL configuration. Everything lives under `/api/v1/` (docs/api-conventions.md).

Django admin is intentionally not mounted: it can delete records, and nothing is deleted.
"""

from django.urls import URLPattern, URLResolver, include, path
from drf_spectacular.views import SpectacularAPIView

from accounts.urls import urlpatterns as accounts_urlpatterns
from core.views import HealthView
from organizations.views import MeView

api_v1_patterns: list[URLPattern | URLResolver] = [
    path("health/", HealthView.as_view(), name="health"),
    path("me/", MeView.as_view(), name="me"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    *accounts_urlpatterns,
    path("", include("organizations.urls")),
    path("", include("catalogs.urls")),
    path("", include("rules.urls")),
    path("", include("field_sync.urls")),
    path("", include("uploads.urls")),
    path("", include("reviews.urls")),
    path("", include("fleet.urls")),
    path("", include("incidents.urls")),
    path("", include("inventory.urls")),
    path("", include("lab.urls")),
    path("", include("shifts.urls")),
    path("", include("geography.urls")),
    path("", include("ovitraps.urls")),
    path("", include("ovitraps.lifecycle.urls")),
    path("", include("scheduling.urls")),
]

urlpatterns = [path("api/v1/", include(api_v1_patterns))]
