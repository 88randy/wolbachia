TITLE: [Web] Sign-in, session and permission-aware navigation (W1)
LABELS: web,backend,security,priority:high

## 1. Context
Part of epic #20. Every web screen depends on knowing who the user is, their organization and what they can do. The backend side (session login, CSRF, logout, password reset, lockout, `/me/`) is #4. The real contract is in `docs/api-conventions.md` (rows `GET /me/`, Auth endpoints, Error codes and Login protection) and `packages/api-client`.

## 2. Goal
Users sign in (W1) and get a session in their organization, choosing one when they belong to several. They see only the navigation and actions their permissions allow, and they can reset a forgotten password from the email link.

## 3. Scope / Out of scope
**Scope:**
- W1 sign-in with its states: wrong credentials, lockout or rate limit, no active membership, network and server errors;
- CSRF bootstrap;
- sign-out;
- password reset request and confirm (the confirm screen is the target of the reset email link);
- organization selection for users with several memberships;
- `/me/` consumption with TanStack Query;
- a `can(permission)` helper;
- route guards with redirect to the requested route;
- permission-aware sidebar and a user menu (name, profiles, organization, change organization, sign out);
- "no permission" state;
- re-authentication dialog on session expiry that keeps the draft.

**Out of scope:**
- user management (#37);
- SSO;
- 2FA and first-time privacy-notice acceptance ([PENDING]: no endpoints);
- the "session about to expire / Stay signed in" banner ([PENDING]: the backend exposes no expiry and has no keep-alive);
- the center selector;
- scope checks in `can()` ([PENDING]: scope semantics not defined by the backend);
- "Request access", and the error reference number on the server-error state;
- the organization logo (CSP);
- the generic "disabled with reason" component (lands with the first screen that needs it).

## 4. Data model
No new tables. The web reads `GET /api/v1/me/` (also returned as `me` by the web login):

- `user {id, username, email, first_name, last_name}`
- `organization {id, slug, name, country, timezone, languages[], logo_url} | null`: `null` when the user has several active memberships and sent no `X-Organization`.
- `profiles[{slug, label_es, label_en}]`
- `permissions[]`: sorted, unique `<resource>.<action>` codes, the union of the active profiles.
- `scope {centers[], quadrants[]}`: [PENDING] whether an empty list means "whole organization" or "nothing".
- `organizations[{slug, name}]`: the user's active organizations.

Browser state:
- The selected organization slug, in `localStorage` (`wolbachia.organization`), cleared on sign-out.
- No user data is stored in the browser.

## 5. Contract (API / interfaces)
All calls go through `packages/api-client` (same origin, session cookie, `X-CSRFToken` on unsafe methods, `X-Organization` from the selected slug).

- `GET /api/v1/auth/csrf/`: `204`, sets the `csrftoken` cookie.
- `POST /api/v1/auth/login/`:
  - Body (web, no `device_id`): `{username, password}`.
  - Success: `200 {me, server_time}` plus the session cookie.
  - CSRF is required; without it the answer is `403 permission_denied`.
- `POST /api/v1/auth/logout/`: `204`, idempotent.
- `POST /api/v1/auth/password-reset/`: body `{email}`, always `202` with an empty body.
- `POST /api/v1/auth/password-reset/confirm/`:
  - Body: `{uid, token, new_password}`.
  - Success: `204`.
  - Bad link: `400 invalid_reset_token` (also for expired, used or tampered links).
  - Bad password: `400 validation_error` with `fields.new_password` codes `password_too_short`, `password_too_common`, `password_entirely_numeric` or `password_too_similar`.
- `GET /api/v1/me/`: shape in section 4. No active membership gives `403 no_active_membership`.

Error codes the web handles:
- `invalid_credentials` (401): bad password, unknown or inactive user, always the same answer.
- `throttled` (429, `Retry-After`): rate limit or lockout, indistinguishable.
- `not_authenticated` (401).
- `no_active_membership` (403).
- `organization_header_required` (400).
- `permission_denied` (403).
- `invalid_reset_token` (400).
- `validation_error` (400).

Web routes:
- `/login?redirect=<internal path>`
- `/forgot-password`
- `/reset-password/{uid}/{token}`: must match the backend `WEB_PASSWORD_RESET_PATH` (default `/reset-password`).
- `/select-organization`

Web interfaces:
- `can(me, permission): boolean`
- `useCan()`
- each area declares `requiredPermissions: readonly string[] | "pending"`

## 6. Behavior
- **W1 sign-in:**
  - Username, password, a show/hide toggle, "Forgot my password", and a language switch.
  - No "create account".
  - "Accounts are created by your organization's administrator."
- **CSRF bootstrap:**
  - The sign-in page calls `GET /auth/csrf/`; it is called again before submit when the cookie is missing.
  - If the login gets `403` because of CSRF, the token is refreshed and the login retried once.
- **After sign-in:**
  - The user goes to the originally requested route. Only internal paths are accepted.
  - If `me.organization` is `null`, the user goes to organization selection first.
- **Organization selection:**
  - The user chooses from `me.organizations`.
  - The slug is stored, the cache cleared and `/me/` refetched.
  - "Change organization" in the user menu repeats this.
- **Navigation:**
  - The sidebar hides areas the user cannot see, and a group heading when its group is empty.
  - Home is always visible.
  - Areas whose permission codes do not exist yet are `"pending"` and visible to members until their issue defines a code. A test lists them.
- **Guards:**
  - An unauthenticated visit to an authenticated route redirects to `/login?redirect=…`.
  - A deep link to a forbidden route renders the "no permission" state inside the shell.
- **Sign-out:** `POST /auth/logout/`, then clear the query cache and the stored slug, then go to `/login`.
- **Password reset request:**
  - The same confirmation message is shown whatever the email.
- **Password reset confirm:**
  - New password and its confirmation.
  - On success, the user goes to `/login` with a notice.
- **Permission refresh:** `/me/` refetches on window focus and when stale, so changed permissions update the navigation.
- **Session expiry:**
  - A 401 after the user signed in opens a re-authentication dialog (username read-only, password) over the current page, so drafts are kept.
  - Afterwards the queries are refetched and the user resubmits.
- **Copy:** all text comes from `packages/i18n` (es-MX, en).

## 7. Edge cases & errors
- **Wrong credentials, unknown user or deactivated user:** the same generic message. Remaining attempts are not shown, because the backend does not provide them.
- **Lockout or rate limit (`429`):** one generic message with the wait in minutes taken from `Retry-After`. Lockout is decided in decision 39: global, 5 failures per username + address in 15 min lock that pair for 15 min, env-configurable.
- **Correct password but no active membership (`403 no_active_membership`):** a generic message telling the user to contact the administrator.
- **A stored slug that is no longer valid** (`403 no_active_membership` with the header): clear it and retry once without the header.
- **`403 no_active_membership` mid-session:** clear the state, then go to sign-in or organization selection.
- **Missing CSRF cookie or token:** refetch it and retry once, then show the generic error.
- **Invalid, expired or used reset link:** an explanatory message with a link to request a new one.
- **Weak new password:** field errors translated from the validator codes.
- **Unsafe `redirect` parameter** (`//host`, a scheme, `javascript:`): ignored; the user goes home.
- **Network failure or 5xx on sign-in:** the `errors.api.*` messages. The form keeps its values.
- **Permissions removed while the user is on a page:** the next `/me/` refresh hides the navigation, and API `403`s render "no permission".

## 8. Acceptance criteria
- [ ] Login error never reveals whether the account exists (same text for unknown and existing users; unit test).
- [ ] Deep links to a forbidden route show "no permission", not a crash (unit test and e2e).
- [ ] Organization id never appears in URLs or request bodies; the selected organization travels only as the `X-Organization` slug header (unit test).
- [ ] After sign-in the user lands on the originally requested route; an external `redirect` is rejected (unit test).
- [ ] The password reset confirm screen at `/reset-password/{uid}/{token}` completes a reset and maps `invalid_reset_token` and password validator codes (unit test).
- [ ] Multi-organization users choose an organization before entering; single-organization users never see the chooser.
- [ ] The sidebar shows only permitted areas, with no profile names hard-coded; a test lists the `"pending"` areas.
- [ ] A 401 mid-session opens re-authentication and the draft survives (unit test).
- [ ] Unit tests for `can()` and the route guards.
- [ ] E2E with a mocked API (`page.route`) covering sign-in, redirect back, lockout, forbidden deep link, sign-out and reset. Axe WCAG 2.2 AA passes on every new screen in light and dark, and the flows work by keyboard.
- [ ] All copy in `packages/i18n` (es-MX, en).

## Notes
- Decided:
  - Django session cookie + CSRF (`docs/decisions.md` #9).
  - One login endpoint for web and mobile (#37).
  - Lockout and rate limits are global (#39).
  - The reset email text lives in backend templates (#41).
  - Backend side in #4.
- Stack: TanStack Query for `/me/`, TanStack Router `beforeLoad` guards, React Hook Form + Zod forms (ADR 0001). New dependencies: `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`.
- Depends on #4 being merged; the branch starts from master after that.
- Design deviations to note in the PR:
  - no "remaining attempts" count;
  - no "30 min idle" copy (the session is a fixed 12 h, `AUTH_WEB_SESSION_AGE_SECONDS`);
  - a minimal organization selection screen that is not in the design.
- [PENDING] Web 2FA and privacy-notice acceptance (client).
- [PENDING] A session expiry or keep-alive contract (backend), needed for the "Stay signed in" banner.
- [PENDING] `scope` semantics (backend).
- [PENDING] Same-origin web/API (ADR 0001, open point 2).
