"""Routes of the accounts app, mounted under `/api/v1/` by `config.urls`."""

from django.urls import path

from accounts.views import CsrfView, LoginView, LogoutView, RefreshView

urlpatterns = [
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
]
