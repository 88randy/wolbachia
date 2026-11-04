"""Settings for pytest, CI and the django-stubs mypy plugin.

Needs PostgreSQL (`DATABASE_URL`) because the models use `ArrayField`. `REDIS_URL` is only read
to satisfy the shared settings; tests use in-memory caches and never connect to Redis.
"""

from .base import *  # noqa: F403

SECRET_KEY = "test-only-key-not-a-secret"  # noqa: S105
ALLOWED_HOSTS = ["testserver", "localhost"]

# Test-only app with a voidable, org-scoped model to exercise the shared base classes.
INSTALLED_APPS = [*INSTALLED_APPS, "tests.testapp"]  # noqa: F405
ROOT_URLCONF = "tests.urls"

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
