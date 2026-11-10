from django.urls import path

from discovery.views import DiscoveryViewSet

urlpatterns = [
    path("home/summary/", DiscoveryViewSet.as_view({"get": "summary"}), name="home-summary"),
    path("search/", DiscoveryViewSet.as_view({"get": "search"}), name="search"),
    path(
        "records/<str:record_type>/<str:code>/history/",
        DiscoveryViewSet.as_view({"get": "history"}),
        name="record-history",
    ),
]
