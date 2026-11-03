TITLE: [Backend] Field worker authentication, device binding and remote session revoke
LABELS: backend,security,priority:high

## 1. Context
Users are created by the company. First login needs signal; afterwards the phone unlocks offline with PIN or fingerprint. Sessions can be closed remotely.

## 2. Goal
Secure token auth for field devices with refresh, device registration and remote revoke.

## 3. Scope / Out of scope
**In:** login, refresh, device registration, revoke, rate limiting, audit log.
**Out:** PIN storage (lives on device, see mobile issue), web login.

## 4. Data model
- `Device` (OrgScoped): id uuid, serial/label, app_version, last_seen_at, is_revoked.
- `DeviceSession`: user, device, refresh token hash, created_at, revoked_at, revoke_reason.

## 5. Contract (API / interfaces)
- `POST /api/auth/login/` {username, password, device_id} → {access, refresh, user, organization, server_time}
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/` (blocked by client if pending records; server allows)
- Revoked session → 401 with `code: "session_revoked"` so the app shows "Tu sesión se cerró por seguridad".

## 6. Behavior
`server_time` in login and every sync response lets the phone detect clock skew.

## 7. Edge cases & errors
- Wrong credentials → generic message, rate limited per user+IP.
- Revoked device with pending events → still accept upload of pending events once (configurable), then block.

## 8. Acceptance criteria
- [ ] Tests for login, refresh, revoke, rate limit.
- [ ] Passwords never logged; tokens stored hashed server side.

## Notes
"Forgot password" only tells the user to call the supervisor (no reset flow in app).
