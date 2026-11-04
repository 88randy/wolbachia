"""Production settings. `python manage.py check --deploy` must stay clean with these."""

from .base import *  # noqa: F403
from .base import env

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS")

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False  # the web client reads the CSRF token from this cookie

SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
# Only enable behind a reverse proxy that sets X-Forwarded-Proto and strips it from clients.
if env.bool("DJANGO_TRUST_PROXY_SSL_HEADER", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

HSTS_ONE_YEAR_SECONDS = 31_536_000
SECURE_HSTS_SECONDS = HSTS_ONE_YEAR_SECONDS
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# [PENDING] HSTS preload is a long-term commitment for the whole domain; decide it when the
# production domain is known (#18). Until then the check is silenced on purpose.
SILENCED_SYSTEM_CHECKS = ["security.W021"]
