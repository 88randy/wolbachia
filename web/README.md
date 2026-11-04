# web — Wolbachia back-office and public portal

React web client of the Wolbachia platform. It talks only to the single Django + DRF API in `backend/` through `packages/api-client` and uses the shared `packages/tokens` and `packages/i18n` packages.

> Items marked **[ASSUMPTION]** or **[PENDING]** are not decided yet. Do not treat them as fact; resolve them in the related issue.

## What the web does

The mobile app (`mobile/`) is for the courier in the field. The web is where everything else happens:

| Area | What it covers | Screens |
|---|---|---|
| Core | Sign-in, home with "needs your attention", universal search, universal record with full history, notifications | W1–W5 |
| Incidents | Incident tray, detail, escalation, closing with evidence | W6–W7 |
| Inventory | Supply catalog, lots, locations, transfers, reception, discrepancies, courier assignment, daily reconciliation, write-offs, biological lot conditions, QR labels | W8–W19 |
| Fleet | Motorcycles, services, responsibility letters, fuel | W20–W21 |
| Quadrants & sampling | Quadrant map and versioned editor, blocks and sampling points, assignment, scheduling, risk categories | W22–W27 |
| Operations / supervision | Live shifts, shift validation, review queue, relocations, third-party interventions, quadrant closure | W28–W33 |
| Entomology lab | Bag reception, **egg counting** (only here, never in mobile), recounts, recycled egg paddles, UIEB shipment, biological write-offs, Wolbachia results, third-party material requests, larval studies (optional module) | W34–W42 |
| Releases & permits | Permit types, permits, suspension, releases (with block reason), release devices | W43–W47 |
| People | Users, person record (masked RFC), trainings, evaluation sheet | W48–W51 |
| Community | Community activities and complaints, never with neighbors' personal data | W52 |
| Dashboards | Entomology, Wolbachia prevalence, operations, comparison, official exports | W53–W57 |
| Regulatory / privacy | ARCO requests, data transfer authorizations, access log, retention | W58–W61 |
| Configuration | Versioned rule parameters, catalogs, incident types, roles & permissions, API keys, mobile app versions, organization | W62–W68 |
| Public portal | Read-only, aggregated view for government users | W69–W71 |

Full inventory with states: [`docs/web-screens.md`](../docs/web-screens.md). Endpoints the web needs: [`docs/web-api-needs.md`](../docs/web-api-needs.md).

## Profiles

Decided: **Supervisor**, **Entomologist**, **Promoter**, **Admin**.

The design also uses these profiles. **[PENDING]** Decide whether each one is its own profile or a permission set inside one of the four:

- **Coordinator:** a supervisor of supervisors; receives escalations.
- **Warehouse:** inventory and dispatch.
- **Regulatory:** permits, ARCO, data transfers, retention.
- **Government (external, read-only):** public portal only.

Rules that do not depend on that decision:

- A user only sees data of their own organization (`organization_id` comes from the session, never from the URL or the request body).
- What a user can do comes from `GET /api/v1/me/` (permissions + scope). The UI hides what the user cannot see, and disables (with the reason and who can unblock it) what is blocked.

## Non-negotiable rules

- Nothing is deleted. Correcting = **void with reason** (`POST …/void/`). Voided records stay visible, marked as voided.
- The courier does not count eggs. Mobile only records whether the egg paddle is present and, if so, whether it has eggs (Yes/No). The count is captured by the entomologist in W35.
- Rules and catalogs are configured per organization in the web (W62–W65). Thresholds such as 50 m and 10 km/h are never hard-coded.
- Every open option list ends with **"Other (specify)"** ("Otro (especificar)"), which cannot be deactivated.
- Every number on screen links to the records behind it.
- Minimal personal data: RFC is masked, and revealing it is logged. No neighbor data, ever.
- Maps: MapLibre with OpenStreetMap tiles and the "© OpenStreetMap contributors" attribution.
- Accessibility: WCAG 2.2 AA. Languages: es-MX (default) and en.

## Running locally

Node **22.13.0** (`.nvmrc`; `engines.node >=22.13`). Run everything from the repo root.

```bash
npm ci                                   # once, installs every workspace
cp web/.env.example web/.env             # then adjust if needed
npm run dev -w @wolbachia/web            # http://localhost:5173
```

Or in Docker, as the rest of the stack (Vite dev server with live reload, port 5173):

```bash
docker compose up web
```

The web port is bound to `127.0.0.1:${WEB_PORT:-5173}`. Start the stack **only from the repo root**: `backend/compose.yaml` has its own project name, so `-f backend/compose.yaml` creates a second, separate stack. `compose.yaml` includes `backend/compose.yaml` (issue #2), so `docker compose up` starts the whole stack and `docker compose up web` only this service. The Django service is `api` on port 8000; `API_PROXY_TARGET` in `compose.yaml` and `vite.config.ts` point to it.

| Command (root) | What it does |
|---|---|
| `npm run dev -w @wolbachia/web` | Generates `packages/tokens/dist/tokens.css`, starts Vite |
| `npm run build -w @wolbachia/web` | Same CSS step, then `vite build` into `web/dist/` (needs `VITE_API_BASE_URL`) |
| `npm run preview -w @wolbachia/web` | Serves `web/dist/` |
| `npm test --workspaces --if-present` | Unit and component tests (Vitest, Testing Library, jest-axe) |
| `npm run e2e -w @wolbachia/web` | Playwright on a production build: layout, keyboard flow, axe (WCAG 2.2 AA) in light and dark. First time: `npx playwright install chromium`. `E2E_BASE_URL=<url>` runs it against a running instance (e.g. the container) instead |
| `npm run lint`, `npm run format:check`, `npm run typecheck` | As in CI |

### Configuration

| Variable | Required | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Base URL of the API: an absolute URL or a same-origin path such as `/api/v1` (no `//host`, no backslashes). In a production build (`vite build`) an absolute URL must be `https:`. No default in code |

`VITE_*` variables are **read at build time and written into the public bundle**: never put a secret in them. If the variable is missing or invalid the app shows a translated "not ready" screen and logs `Invalid app configuration: VITE_API_BASE_URL ...` to the console, instead of a blank page. Each environment needs its own build (or image build argument `VITE_API_BASE_URL`).

### Layout of `src/`

| Folder | What |
|---|---|
| `app/` | `startApp` (theme, language, configuration check, first render) and `App` |
| `api/` | the one `@wolbachia/api-client` client (same-origin session, CSRF from the `csrftoken` cookie, `X-Organization` from the chosen slug, base URL from `VITE_API_BASE_URL` minus `/api/v1`), `useApiClient`, the TanStack `QueryClient` (`query-client.ts`), `Retry-After` parsing and the CSRF helpers; no `fetch` anywhere else |
| `session/` | `GET /me/` as a query (`me-query.ts`, `useMe`), `can()` / `useCan()`, the organization slug, sign-out, switching organization, session events (expiry, lost membership) and the re-authentication dialog |
| `auth/` | public pages: sign-in (W1), forgot and reset password, organization selection; their schemas, request functions and form hooks |
| `forms/` | shared form pieces: `TextField`, `PasswordField`, `FormAlert`, `FormNotice`, `SubmitButton`, field-error translation |
| `config/` | `readAppConfig`: validates the environment (the only place that exposes `apiBaseUrl`) |
| `i18n/` | i18next fed by `@wolbachia/i18n` (typed keys, `{param}`), `useLanguage` |
| `theme/` | light by default; `data-theme="dark"` on `<html>`; stored per browser |
| `router/` | code-based TanStack Router routes: public routes, the guarded layout and one placeholder per area (`areas.ts`, each with its `requiredPermissions`); `guards.ts`, `safe-redirect.ts` |
| `shell/` | skip link, sidebar (232 px, 64 px collapsed), top bar, offline banner |
| `states/` | placeholder, not found, route error, loading skeleton, configuration error |
| `styles/` | global CSS, shared CSS modules, `no-style-literals.test.ts` |
| `storage/` | `localStorage` wrapper that never throws (preferences are conveniences) |
| `data-table/` | the shared list table and filter bar (#29): `DataTable`, `FilterBar`, `useTableUrlState`, `table-state.ts` (pure URL rules), `requestExport`. See "Lists" below |
| `format/` | dates and times in the organization's time zone and the interface language (`formatDateTime`, `useFormatDateTime`) |
| `devices/` | W67, phones list (`/settings/phones`): the first screen built on `DataTable` |
| `settings/` | Settings home: placeholder plus a link to each built screen the user may open |

Rules enforced here: every visual value is a `var(--...)` from `@wolbachia/tokens` (a test fails on hex/rgb colors, literal `font-family`, px font sizes or radii and inline `style`); every user-facing string is an i18n key; one component per file, ESLint clean-code limits apply.

### What the shell does today

- Sidebar with the 13 areas of the table above (`/`, `/incidents`, `/operations`, `/quadrants`, `/releases`, `/community`, `/inventory`, `/fleet`, `/lab`, `/people`, `/dashboards`, `/regulatory`, `/settings`), each an empty placeholder page. It lists only the areas the user may open (see "Session, guards and permissions"); a group with no visible area loses its heading.
- Top bar slots: search (Ctrl+K / Cmd+K focuses it, hint in the field; no backend yet), notifications (announced as not available yet; no panel, no count), es-MX / en switch (no reload; remembered) and the user menu. The center selector is **[PENDING]**: `scope.centers` are plain strings and there is no centers endpoint.
- Below 768 px (`web.layout.compactBreakpoint`) the sidebar stays collapsed, so the page reflows at 320 CSS px without two-axis scroll (WCAG 1.4.10; e2e checks it). Each page sets its own `document.title` ("<page> · Wolbachia", WCAG 2.4.2).
- Banner when the browser is offline. It only says the screen may be out of date: the web is not offline-first like the phone.
- Not found and route errors render inside the shell, with a way home (and retry).
- Keyboard: the first Tab stop is "Skip to content"; after each navigation focus moves to `<main>`; every link and button is reachable; the focus ring comes from the tokens. The active sidebar item uses `color.action` (4.5:1) instead of `color.brand` (4.2:1 with white text, fails AA).
- Not built here: the screens that call the API (besides sign-in and the phones list), the void pattern (#32), the public portal layout (#25).

### Lists: `DataTable` and `FilterBar` (#29)

Decisions 85 and 86 in `docs/decisions.md`. Every list screen uses these two components; none writes its own table, filters or paging.

- **The address is the state.** `?status=open&ordering=-created_at&page=2` (or `?cursor=...` for cursor lists, plus `include_voided=true`). `useTableUrlState(config)` reads it, validates it on every read and writes it on every change; each change pushes a history entry (the back button restores the previous view) and any change of filters or order goes back to the first page. A parameter the list does not know, or an invalid value, is **ignored** (never sent to the API) and named in a notice with "Remove from the address". The router writes flat string pairs (`router/flat-search.ts`), so `?code=1e3` stays text.
- **The server does the work.** Sorting, filtering and paging are requests; the table only draws the rows of the page in view. `ordering` is sent only when the URL has one, otherwise the API applies its default, which `defaultOrdering` mirrors for `aria-sort`.
- **A screen declares** a constant `TableQueryConfig` (paging mode, page size, filters, sortable column ids, `supportsVoided`), the typed query (`queryOptions` with `client.GET`, `keepPreviousData`), its `DataTableColumn[]` (header key, cell, `align: "end"` for numbers, `link` to make a cell a link: a row link, or the filtered list behind a number) and passes `pageTableData(query, page, size)` or `cursorTableData(query)` as `data`. Optional: `voidOf` (struck-through row with badge, reason and author), `selection` (checkboxes, "n selected" and the screen's actions for the rows of the page; it empties when the rows change), `exportPath` on `FilterBar` (the backend builds the file; pass it only when the user may export). Reference screen: `devices/PhonesPage.tsx`.
- **Accessibility.** Semantic `<table>` with caption and `scope="col"`; sortable headers are buttons with `aria-sort`; two polite live regions (result count, and the sort state in words); native `<select>`, checkbox and buttons; "Previous" and "Next" are `aria-disabled` so keyboard focus is not lost; chips are buttons named "Remove filter <name>: <value>"; no state by color alone; a wide table scrolls inside its card. The void detail is always visible, not on hover (WCAG 1.4.13).
- **Not in the table.** No column visibility, resizing, pinning or virtualization (no screen needs them yet). The table library (TanStack Table 9.3.1, decision 21) is only the row, column and selection model.
- **W67 phones** (`/settings/phones`, permission `device.read` from `/me/`): read only, one filter (`is_revoked`), page-number paging. `GET /devices/` has no `ordering` and no `include_voided`, and its `user` filter needs a user picker that does not exist yet, so the screen has none of those. Revoking a phone, the version cards and the APK upload are other issues. W62 (#36) is the second consumer.

### Session, guards and permissions

Built in #28 (decisions 77 to 81 in `docs/decisions.md`). Backend contract: `docs/api-conventions.md` (rows `GET /me/`, "Auth endpoints", "Error codes (#4)", "Login protection") and `packages/api-client`.

- **Routes.** Public: `/login?redirect=<internal path>&notice=`, `/forgot-password`, `/reset-password#uid=<uid>&token=<token>` (the link the backend writes in the reset email, from `WEB_PASSWORD_RESET_PATH`; see "Reset-link formats"). `/select-organization` needs a session but not an organization. Everything else is inside the shell and behind `requireOrganization`.
- **Reset-link formats (#58, decision 83).** The emailed link keeps `uid` and `token` in the URL fragment, which browsers never send, so no nginx, TLS proxy or log aggregator sees them. `ResetPasswordPage` reads the fragment once with `URLSearchParams` (`auth/reset-link.ts`: one `uid` and one `token`, each `[A-Za-z0-9_-]{1,128}`), keeps the values in memory and replaces the address bar with `/reset-password` before any request. The same happens for every later fragment (a second link pasted into the same tab is a hash-only navigation: the credentials are replaced and the form starts over); a missing or malformed fragment shows the invalid-link state. Neither value is logged. **Old path format** `/reset-password/{uid}/{token}` (emails sent before #58) is still served by `LegacyResetPasswordPage` for one token lifetime (`PASSWORD_RESET_TIMEOUT`, 3600 s). Note dated 2026-11-04: it can be removed 1 hour after the first production deploy of #58, tracked in #62 (route `legacyResetPasswordRoute` in `router/router.tsx`, `LegacyResetPasswordPage`, its tests, and the `location /reset-password/` block in `nginx/default.conf`). CI checks that the nginx log of the e2e run holds no reset token.
- **Session state** is the `["me"]` query (`session/me-query.ts`): fresh for 60 s, refetched on window focus and on guarded navigations after that, so a permission changed by an administrator reaches the navigation. There is no custom auth context.
- **Guards** (`router/guards.ts`, `beforeLoad`): no session (`401`) goes to `/login?redirect=<path>`; `403 no_active_membership` goes to `/login?notice=no-membership`; no active organization goes to `/select-organization`; an area whose permissions are not met throws `ForbiddenError` and its error component renders the "no permission" state inside the shell. `safeRedirect` accepts only internal paths (not `//host`, backslashes, schemes, control characters or `/login`).
- **Permissions.** `can(me, permission)` and `useCan()` look only at the permission codes of `GET /me/`, never at profile names. Each area in `router/areas.ts` has `requiredPermissions`: a list of codes (at least one), `[]` for every member (Home), or `"pending"` until its issue defines a code. `router/area-access.test.ts` lists the pending areas; the issue that builds an area replaces its `"pending"` and removes it from that list. **[PENDING backend]** scope (`centers`, `quadrants`): whether an empty list means "whole organization" or "nothing" is not defined, so `can()` takes no scope argument and the server enforces scope on every request.
- **Organization.** A multi-organization user chooses on `/select-organization` (not in the design, built with the sign-in layout). The slug is kept in memory and `localStorage` (`wolbachia.organization`), travels only as the `X-Organization` header (never in a URL or body), is forgotten when the server refuses it and is cleared on sign-out. Choosing one drops the cache of the previous organization and refetches `/me/`.
- **Sign-in.** The CSRF cookie is requested when the page opens and again before submit if missing; a `403 permission_denied` refreshes it and retries once. All credential failures read the same; the remaining attempts are not shown (the API does not provide them); a `429` shows the wait in minutes from `Retry-After`.
- **Sign-out** posts `/auth/logout/` (CSRF), clears the slug and the query cache and goes to `/login`. If the server cannot be reached the user stays signed in and is told.
- **Session expiry.** Any `401` after sign-in (from any query or mutation) opens a modal re-authentication dialog over the page (native `<dialog>`; username read-only; Escape does not dismiss it), so drafts survive. After signing in again the active queries are refetched; the failed request is not repeated. A mid-session `403 no_active_membership` forgets the organization and re-runs the guards. **[PENDING backend]** the session is a fixed 12 h (`AUTH_WEB_SESSION_AGE_SECONDS`) and no expiry or keep-alive is exposed, so the design's "your session closes in 0:58 / Stay signed in" banner and its "30 min idle" copy are not built.
- **Not built (no endpoints) [PENDING]:** the 2FA second step and the first-time privacy-notice acceptance of W1; "Request access" and the error reference number of the global states; the organization logo (`logo_url` may live on S3, which the CSP `img-src 'self' data:` blocks).
- **Tests.** Unit tests use `src/test/fake-api.ts` (a fake `fetch` keyed by method and path; `makeMe()`, `apiError()`) and `renderApp({ path, me, fetch })`. Passwords in tests are `fakePassword()` (`pw-for-<uuid>`, generated at runtime: the secret scan only allows its fake-password exception under `backend/tests/`). End-to-end tests fake the API with `page.route` (`e2e/fixtures/mock-api.ts`, no MSW) and run axe (WCAG 2.2 AA) on every screen and state in light and dark, es-MX and en (`e2e/auth-a11y.spec.ts`).

Screenshots of the shell (light, dark, es-MX, en, collapsed, offline) and of the #28 screens (sign-in in four combinations; sign-in error and lockout, forgot and reset password, organization selection, no permission, user menu and the re-authentication dialog): [`docs/screenshots/`](docs/screenshots/). Regenerate the #28 ones with `E2E_SCREENSHOTS=1 npm run e2e -w @wolbachia/web -- screenshots`.

### Stack

Decided in spike #27, see [`docs/adr/0001-web-stack.md`](../docs/adr/0001-web-stack.md). **Installed so far:** React 19, Vite 8, TanStack Router, TanStack Query, React Hook Form, i18next + react-i18next, Zod, Lucide icons, Inter (self-hosted with `@fontsource/inter`, no CDN: privacy, CSP and a working app without internet), Vitest + Testing Library + jest-axe, Playwright + `@axe-core/playwright`. TanStack Query 5.105.3, React Hook Form 7.91.0 and `@hookform/resolvers` 7.0.2 (all MIT) came with #28; TanStack Table 9.3.1 (MIT, `@tanstack/react-table` plus `@tanstack/table-core`; `@tanstack/react-store` was already installed by the router) came with #29; Recharts and MapLibre are added by the issues that first use them. TypeScript is the root version (6.0.3).

### Build and deploy

- `web/Dockerfile` (build context = repo root): `dev` stage for compose; `runtime` stage = unprivileged nginx 1.30 serving `dist/` on port 8080 with SPA fallback, CSP, `X-Content-Type-Options`, immutable cache on `/assets/` and never on `index.html`. Build it with `docker build -f web/Dockerfile --target runtime .`.
- CI (`.github/workflows/web.yml`): lint, format, type-check, tests and build; Playwright e2e; and the image build (no push).
- **Default deploy target (decided in #26, [PENDING] client confirmation): the nginx container on the DigitalOcean droplet, next to the backend.** Static hosting remains possible because the output is plain files. The deploy workflow is not part of #26.
- TLS and HSTS: the container serves plain HTTP on 8080. The TLS-terminating proxy in front (backend deploy, #18) must provide HTTPS and the `Strict-Transport-Security` header; nginx here does not set it.
- **[ASSUMPTION]** the API is on the same origin as the web (a reverse proxy routes `/api/` to Django), so the CSP says `connect-src 'self'` and `VITE_API_BASE_URL=/api/v1`. For another origin, extend the CSP in `web/nginx/security-headers.conf` and settle cookies/CORS in backend #4 (ADR 0001, open point 2).

## Design source

Design canvas (desktop design system, W1–W71, 10 clickable journeys): Wolbachia web design artifact on claude.ai. Values marked "sample" in the canvas are not product data.
