TITLE: [Backend] Authentication for mobile devices and web, device registry and remote revoke
LABELS: backend,security,priority:high

## 1. Context
Users are created by the company. Mobile: first login needs signal, then offline PIN/biometric unlock. Web: login + password reset (W1). Admin can revoke a user's phone sessions (W49) and see devices (W67).

## 2. Goal
Secure auth for both clients sharing users and permissions.

## 3. Scope / Out of scope
**In:** login/refresh/logout, device registration, revoke-device-sessions, revoke device, password reset for web (request + confirm), rate limiting, login lockout, access logging (structured log).
**Out:** PIN storage (device only); role matrix editor; access log model (W60); web 2FA ([PENDING]).

## 4. Data model
- `Device` (OrgScoped): id uuid (client-generated at install), label, serial, app_version, last_seen_at, last_user, is_revoked, revoked_at, revoked_by.
- `DeviceSession` (OrgScoped): user, device, access_hash, access_expires_at, refresh_hash, previous_refresh_hash, refresh_expires_at, rotated_at, last_used_at, revoked_at, revoked_by, revoke_reason (`logout`, `admin_revoke`, `device_revoked`, `refresh_reuse`, `password_changed`, `user_deactivated`), final_upload_deadline, final_upload_used_at. Tokens are stored only as SHA-256 hashes.

## 5. Contract (API / interfaces)
- `POST /api/v1/auth/login/` `{username, password, device_id?, app_version?, label?}`:
  - with `device_id` (mobile) → `{access, refresh, me, server_time}`; registers/updates the `Device` in the active organization.
  - without `device_id` (web) → `200 {me, server_time}` + Django session cookie; CSRF enforced.
- `GET /api/v1/auth/csrf/` → `204`, sets the CSRF cookie (`ensure_csrf_cookie`).
- `POST /api/v1/auth/refresh/` `{refresh, device_id}` → `{access, refresh, server_time}` (rotation; reuse detection with 60 s grace).
- `POST /api/v1/auth/logout/` → `204` (web: ends session; mobile: revokes current `DeviceSession`; idempotent).
- `POST /api/v1/auth/password-reset/` `{email}` → `202` always.
- `POST /api/v1/auth/password-reset/confirm/` `{uid, token, new_password}` → `204`; revokes the user's device sessions (`password_changed`).
- `POST /api/v1/users/{id}/revoke-device-sessions/` (ADM, `user.revoke_device_sessions`).
- `GET /api/v1/devices/`, `GET /api/v1/devices/{id}/` (ADM, `device.read`); `POST /api/v1/devices/{id}/revoke/` (ADM, `device.revoke`).
- Mobile auth header: `Authorization: Bearer <access>`. Token sessions pin the organization; an `X-Organization` that differs → `403 no_active_membership`.
- Error codes: `401 invalid_credentials` (generic), `401 invalid_token`, `401 token_expired`, `401 session_revoked`, `403 device_revoked`, `403 device_organization_mismatch`, `400 invalid_reset_token`, `429 throttled` (rate limit and lockout, with `Retry-After`).

## 6. Behavior
`server_time` in login, refresh and every sync response for clock-skew detection.
Login rate limit per user+IP and per IP; lockout after N failed attempts per user+IP.
Auth events go to the structured logger `accounts.auth` (no passwords, tokens or emails).
Reset email text lives in backend Django templates per locale (es-MX default, en).

## 7. Edge cases & errors
- Generic error on bad credentials (also for nonexistent or inactive users); rate limit per user+IP.
- Revoked device with pending events: allow a final upload (configurable, default 72 h, single use, only on views that opt in, e.g. `/field/sync/` in #5), then block. No grace for `refresh_reuse` or `password_changed`.
- Old refresh token reused outside the grace window → session revoked (`refresh_reuse`).
- `device_id` registered in another organization → `403 device_organization_mismatch`.

## 8. Acceptance criteria
- [ ] Tests for login (web + mobile), refresh (rotation, reuse), revoke (user and device), reset (request + confirm), rate limit and lockout, final upload.
- [ ] Tokens stored hashed; credentials never logged.
- [ ] `docs/` updated and `packages/api-client` regenerated.

## Notes
Decided (`docs/decisions.md`): web uses Django session cookie + CSRF; mobile uses opaque access + refresh tokens (stdlib `secrets` + SHA-256, no simplejwt) bound to a registered device.
[PENDING] Login lockout thresholds (default 5 failures / 15 min), token lifetimes (access 15 min, refresh 30 days idle), final upload window (72 h) and web 2FA: env-configurable globals with documented defaults until the client decides.
[PENDING] Email provider: `EMAIL_URL` (console in dev).
Seed: `admin` profile gets `device.read`, `device.revoke`, `user.revoke_device_sessions` via an idempotent service.
Full implementation plan: see the planner comment on this issue.
Decided in review: refresh tokens form families (`TokenPair` rows): reuse of a consumed refresh token revokes the session, except a duplicate inside the 60 s grace window while no later token was used. Final upload only when an admin revokes with `allow_final_upload: true`; it is enforced by `FinalUploadMixin` and #5 marks those events `in_review`. Same-device re-login revokes the old session as `superseded`. Production requires `DRF_NUM_PROXIES` and an https `WEB_BASE_URL`.
Decided in review (round 2): per parent only the first sibling pair ever used is valid (another one is revoked as `refresh_reuse`, max 3 siblings); password hash upgrades are saved under the user lock; one lock order User, Device, DeviceSession, TokenPair; authentication never writes a revocation; the final upload is spent only by the declared upload method.
