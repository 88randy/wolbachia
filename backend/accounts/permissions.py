"""Permission codes of the accounts app.

Kept in one place so the seed tracking of #3 can register them later (per-app `permissions.py`).
"""

DEVICE_READ = "device.read"
DEVICE_REVOKE = "device.revoke"
USER_REVOKE_DEVICE_SESSIONS = "user.revoke_device_sessions"
USER_READ = "user.read"
USER_CREATE = "user.create"
USER_UPDATE = "user.update"
USER_DEACTIVATE = "user.deactivate"
USER_REVEAL_RFC = "user.reveal_rfc"
USER_OPERATIONAL_READ = "user.operational_read"
# Display names only (pickers and "who"); never contact data, devices or trainings.
USER_LOOKUP = "user.lookup"
ACCESS_LOG_READ = "access_log.read"

# Granted to the `admin` profile of new organizations.
ADMIN_AUTH_PERMISSION_CODES = (
    DEVICE_READ,
    DEVICE_REVOKE,
    USER_REVOKE_DEVICE_SESSIONS,
)
ADMIN_PERSONNEL_PERMISSION_CODES = (
    USER_READ,
    USER_CREATE,
    USER_UPDATE,
    USER_DEACTIVATE,
    USER_REVEAL_RFC,
    USER_OPERATIONAL_READ,
    ACCESS_LOG_READ,
)
