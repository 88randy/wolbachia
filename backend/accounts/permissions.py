"""Permission codes of the accounts app.

Kept in one place so the seed tracking of #3 can register them later (per-app `permissions.py`).
"""

DEVICE_READ = "device.read"
DEVICE_REVOKE = "device.revoke"
USER_REVOKE_DEVICE_SESSIONS = "user.revoke_device_sessions"

# Granted to the `admin` profile of new organizations.
ADMIN_AUTH_PERMISSION_CODES = (DEVICE_READ, DEVICE_REVOKE, USER_REVOKE_DEVICE_SESSIONS)
