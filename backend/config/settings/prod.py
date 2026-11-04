"""Production settings. `python manage.py check --deploy` must stay clean with these."""

import os

# Production never reads backend/.env unless explicitly asked: real environment only.
os.environ.setdefault("DJANGO_READ_DOT_ENV_FILE", "false")

from django.core.exceptions import ImproperlyConfigured  # noqa: E402

from .base import *  # noqa: E402, F403
from .base import REST_FRAMEWORK, env  # noqa: E402

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS")

# Password reset email: no silent defaults in production (the console backend would print the
# reset links to the logs). [PENDING] email provider: any django-environ EMAIL_URL works.
globals().update(env.email_url("EMAIL_URL"))
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")
WEB_BASE_URL = env("WEB_BASE_URL").rstrip("/")
if not WEB_BASE_URL.startswith("https://"):
    raise ImproperlyConfigured("WEB_BASE_URL must be an https:// URL in production.")

# Number of trusted reverse proxies in front of the API: required, no default. Throttles and the
# login lockout key on the client address, so a wrong value either lets a client forge it with
# `X-Forwarded-For` (too high) or throttles everyone as one address (0 behind a proxy). The TLS
# proxy must overwrite `X-Forwarded-For` and the app servers must never be reachable directly.
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": env.int("DRF_NUM_PROXIES")}

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
