"""Celery application. Tasks only orchestrate services (docs/engineering-rules.md)."""

import os

from celery import Celery

# Prod by default, like wsgi/asgi (manage.py and compose choose dev explicitly): importing
# `config` loads this module first, so a dev default here would leak into every entry point.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
