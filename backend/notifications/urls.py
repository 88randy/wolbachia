from django.urls import path

from notifications.views import NotificationPreferencesViewSet, NotificationViewSet

urlpatterns = [
    path("notifications/", NotificationViewSet.as_view({"get": "list"}), name="notification-list"),
    path(
        "notifications/read-all/",
        NotificationViewSet.as_view({"post": "read_all"}),
        name="notification-read-all",
    ),
    path(
        "notifications/<str:pk>/read/",
        NotificationViewSet.as_view({"post": "read"}),
        name="notification-read",
    ),
    path(
        "me/notification-preferences/",
        NotificationPreferencesViewSet.as_view({"get": "retrieve", "patch": "partial_update"}),
        name="notification-preferences",
    ),
]
