"""Settings for pytest, CI and the django-stubs mypy plugin.

Needs PostgreSQL (`DATABASE_URL`) because the models use `ArrayField`. `REDIS_URL` is only read
to satisfy the shared settings; tests use in-memory caches and never connect to Redis.
"""

import os

from ._env import load_dotenv

# The mypy plugin imports this module with no environment at all (pre-commit, fresh clones), so
# the two required URLs get harmless local defaults. `.env` is read first so it still wins.
load_dotenv()
os.environ.setdefault("DATABASE_URL", "postgres://wolbachia:wolbachia@127.0.0.1:5432/wolbachia")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")

from .base import *  # noqa: E402, F403

SECRET_KEY = "test-only-key-not-a-secret"  # noqa: S105
ALLOWED_HOSTS = ["testserver", "localhost"]

# Test-only app with a voidable, org-scoped model to exercise the shared base classes.
INSTALLED_APPS = [*INSTALLED_APPS, "tests.testapp"]  # noqa: F405
ROOT_URLCONF = "tests.urls"

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
