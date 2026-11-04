from rest_framework.routers import SimpleRouter

from catalogs.views import CatalogItemViewSet, CatalogSnapshotViewSet, CatalogViewSet

router = SimpleRouter()
router.register("field/catalog", CatalogSnapshotViewSet, basename="field-catalog")
router.register("catalogs", CatalogViewSet, basename="catalog")
# Nested by hand (a regex prefix) instead of adding drf-nested-routers as a dependency.
router.register(
    r"catalogs/(?P<catalog_slug>[\w-]+)/items", CatalogItemViewSet, basename="catalog-item"
)

urlpatterns = router.urls
