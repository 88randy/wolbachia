"""Routes of the accounts app, mounted under `/api/v1/` by `config.urls`."""

from django.urls import path

from accounts.views import CsrfView, LoginView

urlpatterns = [
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
]
