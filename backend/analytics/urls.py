from django.urls import path

from analytics.views import AnalyticsViewSet

urlpatterns = [
    path(
        "analytics/operations/",
        AnalyticsViewSet.as_view({"get": "operations"}),
        name="analytics-operations",
    ),
    path(
        "analytics/entomology/",
        AnalyticsViewSet.as_view({"get": "entomology"}),
        name="analytics-entomology",
    ),
    path(
        "analytics/wolbachia-prevalence/",
        AnalyticsViewSet.as_view({"get": "wolbachia"}),
        name="analytics-wolbachia-prevalence",
    ),
    path(
        "analytics/comparison/",
        AnalyticsViewSet.as_view({"get": "comparison"}),
        name="analytics-comparison",
    ),
]
