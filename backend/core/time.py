"""The one place that reads the server clock for API payloads."""

from datetime import datetime

from django.utils import timezone


def server_now() -> datetime:
    """Current server time, timezone-aware UTC. Sent as `server_time` so clients detect clock skew."""
    return timezone.now()
