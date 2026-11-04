"""Login lockout: failed attempts per username and address, counted in the cache.

After `AUTH_LOGIN_MAX_FAILURES` failures inside a window of `AUTH_LOGIN_LOCKOUT_MINUTES` the pair
is locked for that long: even the right password gets `429 throttled`. Failures for usernames
that do not exist count too, so the lockout never reveals whether an account exists. It is keyed
by username *and* address on purpose: a per-username lockout would let anyone lock a user out.
An attacker who rotates addresses is stopped only by the per-address throttle (accepted).
"""

import math
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import Throttled

from accounts.audit import fingerprint

SECONDS_PER_MINUTE = 60


def _subject(username: str, ip: str | None) -> str:
    return f"{fingerprint(username)}:{ip or ''}"


def _failures_key(subject: str) -> str:
    return f"auth_login_failures:{subject}"


def _lock_key(subject: str) -> str:
    return f"auth_login_lock:{subject}"


def _lockout_seconds() -> int:
    return settings.AUTH_LOGIN_LOCKOUT_MINUTES * SECONDS_PER_MINUTE


def ensure_not_locked_out(username: str, ip: str | None) -> None:
    """Raise `Throttled` (429 with `Retry-After`) while the username+address pair is locked."""
    locked_until = cache.get(_lock_key(_subject(username, ip)))
    if locked_until is None:
        return
    remaining = math.ceil(float(locked_until) - time.time())
    if remaining > 0:
        raise Throttled(wait=remaining)


def register_failure(username: str, ip: str | None) -> bool:
    """Count a failed attempt. Returns True when this failure locks the pair."""
    subject = _subject(username, ip)
    cache.add(_failures_key(subject), 0, timeout=_lockout_seconds())
    try:
        failures = cache.incr(_failures_key(subject))
    except ValueError:  # the counter expired between `add` and `incr`
        cache.set(_failures_key(subject), 1, timeout=_lockout_seconds())
        failures = 1
    if failures < settings.AUTH_LOGIN_MAX_FAILURES:
        return False
    cache.set(_lock_key(subject), time.time() + _lockout_seconds(), timeout=_lockout_seconds())
    cache.delete(_failures_key(subject))
    return True


def clear_failures(username: str, ip: str | None) -> None:
    """Forget the failed attempts of the pair (after a successful login)."""
    cache.delete(_failures_key(_subject(username, ip)))
