TITLE: [Web] Sign-in, session and permission-aware navigation (W1)
LABELS: web,backend,security,priority:high

## 1. Context
Part of epic #20. Every web screen depends on knowing who the user is, their organization and what they can do.

## 2. Goal
Users sign in (W1), get a session scoped to their organization, and see only the navigation and actions their permissions allow.

## 3. Scope / Out of scope
**Scope:**
- W1 with its states;
- logout;
- password reset request;
- `/me/` consumption;
- a `can(permission, scope?)` helper;
- route guards;
- "no permission" global state.

**Out of scope:** user management (#37); SSO; 2FA ([PENDING]).

## 4. Data model
`/me/` returns:
- `user {id, name, language}`;
- `organization {name, time_zone, epi_week_start, languages, logo_url}`;
- `profiles[]`;
- `permissions[]`;
- `scope {centers[], quadrants[]}`.

## 5. Contract (API / interfaces)
- `POST /api/v1/auth/login/`: generic error for wrong credentials.
- `POST /api/v1/auth/logout/`.
- `POST /api/v1/auth/password-reset/`: same `202` response whether the account exists or not.
- `GET /api/v1/me/`.

## 6. Behavior
- No "create account" on W1.
- After login, redirect to the originally requested route.
- Hidden: anything without view permission. Disabled with reason: actions blocked by state.

## 7. Edge cases & errors
- Rate limiting on login (backend), with a generic message on lockout.
- Session expired mid-form: re-authenticate and keep the draft.
- Deactivated user: generic message.
- A user whose permissions changed: the next `/me/` refresh updates the navigation.

## 8. Acceptance criteria
- [ ] Login error never reveals whether the account exists.
- [ ] Deep links to a forbidden route show "no permission", not a crash.
- [ ] Organization id never appears in URLs or request bodies.
- [ ] Unit tests for `can()` and the route guards.

## Notes
- Decided: Django session cookie + CSRF (`docs/decisions.md` #9); backend side in #4.
- [PENDING] Login lockout thresholds (organization-configurable or global).
