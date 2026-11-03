TITLE: [Backend] Authentication for mobile devices and web, device registry and remote revoke
LABELS: backend,security,priority:high

## 1. Context
Users are created by the company. Mobile: first login needs signal, then offline PIN/biometric unlock. Web: login + password reset (W1). Admin can revoke a user's phone sessions (W49) and see devices (W67).

## 2. Goal
Secure auth for both clients sharing users and permissions.

## 3. Scope / Out of scope
**In:** login/refresh/logout, device registration, revoke-device-sessions, password reset for web, rate limiting, access logging.
**Out:** PIN storage (device only); role matrix editor.

## 4. Data model
- `Device` (OrgScoped): id uuid, label/serial, app_version, last_seen_at, is_revoked.
- `DeviceSession`: user, device, refresh hash, created_at, revoked_at, revoke_reason.

## 5. Contract (API / interfaces)
- `POST /api/v1/auth/login/` → mobile: `{access, refresh, me, server_time}` (requires `device_id`); web: per decision below.
- `POST /api/v1/auth/refresh/`, `POST /api/v1/auth/logout/`, `POST /api/v1/auth/password-reset/` (202 always).
- `POST /api/v1/users/{id}/revoke-device-sessions/` (ADM). `GET /api/v1/devices/` (ADM).
- Revoked → `401` with `code: "session_revoked"`.

## 6. Behavior
`server_time` in login and every sync response for clock-skew detection.

## 7. Edge cases & errors
- Generic error on bad credentials; rate limit per user+IP.
- Revoked device with pending events: allow a final upload (configurable), then block.

## 8. Acceptance criteria
- [ ] Tests for login, refresh, revoke, reset, rate limit.
- [ ] Tokens stored hashed; credentials never logged.

## Notes
Decided (`docs/decisions.md`): web uses Django session cookie + CSRF; mobile uses access + refresh token bound to a registered device.
[PENDING] Login lockout thresholds and web 2FA: rule parameters with documented defaults until the client decides.
