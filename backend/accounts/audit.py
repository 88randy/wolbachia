"""Structured access log of authentication events (logger `accounts.auth`).

The model for the access log arrives with W60; until then these records are the trail. Fields are
organization, user id, device id, client IP and a keyed fingerprint of the username. Passwords,
tokens and emails are never logged: callers cannot even pass them.
"""

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from django.utils.crypto import salted_hmac

logger = logging.getLogger("accounts.auth")

FINGERPRINT_SALT = "accounts.auth.username"


class AuthEvent(StrEnum):
    LOGIN_SUCCEEDED = "login_succeeded"
    LOGIN_FAILED = "login_failed"
    LOGIN_LOCKED_OUT = "login_locked_out"
    LOGIN_REFUSED = "login_refused"
    REFRESH = "refresh"
    REFRESH_GRACE_RETRY = "refresh_grace_retry"
    REFRESH_REUSE_DETECTED = "refresh_reuse_detected"
    LOGOUT = "logout"
    SESSIONS_REVOKED = "sessions_revoked"
    DEVICE_REVOKED = "device_revoked"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"  # noqa: S105
    PASSWORD_RESET_CONFIRMED = "password_reset_confirmed"  # noqa: S105


@dataclass(frozen=True)
class AuditContext:
    """Who and where. Every field is an identifier or a fingerprint, never a secret."""

    organization_id: object = None
    user_id: object = None
    device_id: object = None
    ip: str | None = None
    username_fingerprint: str | None = None


def fingerprint(value: str) -> str:
    """Keyed, case-insensitive fingerprint of a username or other identifier (HMAC-SHA256).

    Keyed with the secret key so the logs and cache keys that hold it cannot be reversed by
    hashing a list of guessed usernames.
    """
    normalized = value.strip().lower()
    return salted_hmac(FINGERPRINT_SALT, normalized, algorithm="sha256").hexdigest()


def log_auth_event(
    event: AuthEvent, context: AuditContext, details: Mapping[str, object] | None = None
) -> None:
    """Write one auth event. `details` is for non-sensitive extras (e.g. `reason`, `count`)."""
    fields = {
        "organization": context.organization_id,
        "user": context.user_id,
        "device": context.device_id,
        "ip": context.ip,
        "username_fp": context.username_fingerprint,
        **(details or {}),
    }
    rendered = " ".join(f"{key}={value}" for key, value in fields.items() if value is not None)
    logger.info("event=%s %s", event.value, rendered)
