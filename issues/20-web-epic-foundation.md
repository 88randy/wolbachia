TITLE: [Web] Epic: Web app foundation (shell, auth, permissions, i18n, tokens)
LABELS: web,epic,priority:high

## 1. Context
`web/` is the React client for Supervisor, Entomologist, Promoter and Admin, plus a read-only public portal. It consumes the single DRF API through `packages/api-client` and shares `packages/tokens` and `packages/i18n` with mobile. The screen inventory is in `docs/web-screens.md` (W1–W71).

## 2. Goal
Have a running web app that every feature epic can build on. It provides:
- app shell (sidebar, top bar, search slot, notifications slot);
- sign-in and session;
- permission-aware navigation;
- i18n;
- shared tokens;
- the shared list, filter and void patterns.

## 3. Scope / Out of scope
**Scope:**
- stack spike (#27);
- scaffold and CI (#26);
- auth + `/me` + permission gating (#28);
- shared DataTable / FilterBar (#29);
- void-with-reason pattern (#32);
- global states (loading, empty, error, offline, no permission, blocked, voided).

**Out of scope:** feature screens (other epics); public portal content (#25).

## 4. Data model
No new backend models. Consumes `User`, `Organization`, `Role` and `Permission` as exposed by `/me/`.

## 5. Contract (API / interfaces)
- `POST /api/v1/auth/login/`, `POST /api/v1/auth/logout/`, `GET /api/v1/me/`.
- Generated client from OpenAPI in `packages/api-client`.
- Conventions in `docs/web-api-needs.md` § Cross-cutting.

## 6. Behavior
- Unauthenticated users go to W1.
- After sign-in, navigation is built from `me.permissions`.
- Organization is never selected in the UI; it comes from the session.
- Language comes from user preference, with es-MX as default.

## 7. Edge cases & errors
- Expired session mid-form: keep the draft locally, re-authenticate, resume.
- API unreachable: offline banner, read-only where possible.
- A user with no permissions at all: empty home with "contact your admin".

## 8. Acceptance criteria
- [ ] Child issues #26, #27, #28, #29, #32 closed.
- [ ] Lighthouse/axe pass with no WCAG 2.2 AA violations on the shell.
- [ ] es-MX and en switch without reload, with no hard-coded strings in the shell.
- [ ] CLAUDE.md "### Web" section merged.

## Notes
- [PENDING] Whether Coordinator, Warehouse, Regulatory and Government are separate profiles.
- Decided: session cookie + CSRF for web (`docs/decisions.md` #9).
