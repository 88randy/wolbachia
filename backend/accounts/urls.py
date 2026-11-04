"""Routes of the accounts app, mounted under `/api/v1/` by `config.urls`."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from accounts.views import (
    CsrfView,
    DeviceViewSet,
    LoginView,
    LogoutView,
    RefreshView,
    UserViewSet,
)

router = SimpleRouter()
router.register("devices", DeviceViewSet, basename="device")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    *router.urls,
]
