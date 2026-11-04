DEVICE_READ = "device.read"
DEVICE_REVOKE = "device.revoke"
USER_REVOKE_DEVICE_SESSIONS = "user.revoke_device_sessions"

# Added to the `admin` profile of every organization (idempotent service in organizations).
ADMIN_AUTH_PERMISSION_CODES = (DEVICE_READ, DEVICE_REVOKE, USER_REVOKE_DEVICE_SESSIONS)

# A session's `last_used_at` and its device's `last_seen_at` are written at most this often.
LAST_USED_UPDATE_INTERVAL_SECONDS = 60

# Password reset emails sent to one address per hour (mail-bombing guard; the per-IP throttle of
# the endpoint cannot stop an attacker who rotates IPs).
PASSWORD_RESET_EMAILS_PER_ADDRESS_PER_HOUR = 3
