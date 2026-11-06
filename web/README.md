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

B-01 defines nine seeded profile bundles: courier, supervisor, entomologist, community promoter, admin, coordinator, warehouse, regulatory and government. W65 renders the backend projections as data and never branches on profile names. Government has a read-only portal boundary; the fixed-profile projection gap is documented in the W-03 section.

Shared permission rules:

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
| `theme/` | Light/Dark/System preference, System by default; resolved light/dark `data-theme` on `<html>` before the first render; System follows live `prefers-color-scheme` changes |
| `router/` | code-based TanStack Router routes: public routes, the guarded layout and one placeholder per area (`areas.ts`, each with its `requiredPermissions`); `guards.ts`, `safe-redirect.ts` |
| `shell/` | skip link, sidebar (248 px by default, resizable, 64 px collapsed), top bar, offline banner |
| `states/` | placeholder, not found, route error, loading skeleton, configuration error |
| `styles/` | global CSS, shared CSS modules, `no-style-literals.test.ts` |
| `storage/` | `localStorage` wrapper that never throws (preferences are conveniences) |
| `data-table/` | the shared list table and filter bar (#29): `DataTable`, `FilterBar`, `useTableUrlState`, `table-state.ts` (pure URL rules), `requestExport`. See "Lists" below |
| `format/` | dates and times in the organization's time zone and the interface language (`formatDateTime`, `useFormatDateTime`) |
| `devices/` | W67, phones list (`/settings/phones`): the first screen built on `DataTable` |
| `rules/` | W62, versioned rule parameters (#36): the list (`/settings/rule-parameters`) and one parameter (`/settings/rule-parameters/<key>`) with its new-version form and history. See "Rule parameters (W62)" below |
| `settings/` | Settings home: placeholder plus a link to each built screen the user may open |

Rules enforced here: every visual value is a `var(--...)` from `@wolbachia/tokens` (a test fails on hex/rgb colors, literal `font-family`, px font sizes or radii and inline `style`); every user-facing string is an i18n key; one component per file, ESLint clean-code limits apply.

### What the shell does today

- Sidebar with the 13 areas of the table above (`/`, `/incidents`, `/operations`, `/quadrants`, `/releases`, `/community`, `/inventory`, `/fleet`, `/lab`, `/people`, `/dashboards`, `/regulatory`, `/settings`), each an empty placeholder page. It lists only the areas the user may open (see "Session, guards and permissions"); a group with no visible area loses its heading.
- Top bar slots: search (Ctrl+K / Cmd+K opens the command palette; hint in the field), notifications (announced as not available yet; no panel, no count), es-MX / en switch (no reload; remembered), one sun/moon dark-theme switch on the right; the user menu stays in the sidebar footer. The backend-scoped center selector is a remembered filter; see W65/W68 (#147) below.
- The theme preference uses `storage/safe-storage.ts` (`wolbachia.theme`); absent, invalid or unavailable storage defaults to System (Light only when `matchMedia` is unavailable), and a failed write still applies the choice for the current page. Until the first toggle, the switch announces the resolved System appearance and follows live system changes. Space, Enter or a click selects the opposite resolved theme and stores an explicit Light/Dark preference, removing the system listener. The switch uses the shared focus ring and a target larger than 24 px; narrow top bars put search on its own row so all controls remain reachable.
- Below 768 px (`web.layout.compactBreakpoint`) the sidebar stays collapsed, so the page reflows at 320 CSS px without two-axis scroll (WCAG 1.4.10; e2e checks it). Each page sets its own `document.title` ("<page> · Wolbachia", WCAG 2.4.2).
- Banner when the browser is offline. It only says the screen may be out of date: the web is not offline-first like the phone.
- Not found and route errors render inside the shell, with a way home (and retry).
- Keyboard: the first Tab stop is "Skip to content"; after each navigation focus moves to `<main>`; every link and button is reachable; the focus ring comes from the tokens. The active sidebar item uses `color.action` (4.5:1) instead of `color.brand` (4.2:1 with white text, fails AA).
- Not built here: the screens that call the API (besides sign-in and the phones list), the public portal layout (#25).

### Lists: `DataTable` and `FilterBar` (#29)

Decisions 85 and 86 in `docs/decisions.md`. Every list screen uses these two components; none writes its own table, filters or paging.

- **The address is the state.** `?status=open&ordering=-created_at&page=2` (or `?cursor=...` for cursor lists, plus `include_voided=true`). `useTableUrlState(config)` reads it, validates it on every read and writes it on every change; each change pushes a history entry (the back button restores the previous view) and any change of filters or order goes back to the first page. A parameter the list does not know, or an invalid value, is **ignored** (never sent to the API) and named in a notice with "Remove from the address". The router writes flat string pairs (`router/flat-search.ts`), so `?code=1e3` stays text.
- **The server does the work.** Sorting, filtering and paging are requests; the table only draws the rows of the page in view. `ordering` is sent only when the URL has one, otherwise the API applies its default, which `defaultOrdering` mirrors for `aria-sort`.
- **A screen declares** a constant `TableQueryConfig` (paging mode, page size, filters, sortable column ids, `supportsVoided`), the typed query (`queryOptions` with `client.GET`, `keepPreviousData`), its `DataTableColumn[]` (header key, cell, `align: "end"` for numbers, `link` to make a cell a link: a row link, or the filtered list behind a number) and passes `pageTableData(query, page, size)` or `cursorTableData(query)` as `data`. Optional: `voidOf` (struck-through row with badge, reason and author), `selection` (checkboxes, "n selected" and the screen's actions for the rows of the page; it empties when the rows change), `exportPath` on `FilterBar` (the backend builds the file; pass it only when the user may export). Reference screen: `devices/PhonesPage.tsx`.
- **Accessibility.** Semantic `<table>` with caption and `scope="col"`; sortable headers are buttons with `aria-sort`; two polite live regions (result count, and the sort state in words); native `<select>`, checkbox and buttons; "Previous" and "Next" are `aria-disabled` so keyboard focus is not lost; chips are buttons named "Remove filter <name>: <value>"; no state by color alone; a wide table scrolls inside its card. The void detail is always visible, not on hover (WCAG 1.4.13).
- **Org-scoped queries (#82).** Every query whose answer depends on the user or the organization is defined with `orgScopedQueryOptions(identity, { key, queryFn })` (`session/org-scoped-query.ts`), with `identity` from `useSessionIdentity()`. It prefixes the key with `["org", user.id, organization.slug]` (not the revision: a re-authentication of the same user keeps the screens and their drafts) and keeps the previous page as placeholder (no flicker while paging) **only within the same identity**. Never write a bare `queryKey:` or use `keepPreviousData` in a screen: after a re-authentication into another organization the screen stays mounted and would show the old organization's rows while the new request is pending. An answer that arrives after the revision changed is dropped, and the query waits (`enabled: false`, the screen shows loading) while the tab reconciles with `/me/`. The guard (`org-scoped-query.test.ts`, with `test/find-unscoped-queries.ts`, a TypeScript-AST check) fails if a file outside `session/` and `api/` calls `queryOptions` / `useQuery` with its own `queryKey` (shorthand included), overrides `placeholderData` or uses `keepPreviousData`; `invalidateQueries({ queryKey })` and the other calls that only filter the cache are fine. The `/me/` query is the only exception (it is the identity).
- **Cross-tab session (#82).** All tabs share one session cookie. A login, sign-out or organization switch announces itself to the other tabs (`session/session-sync.ts`: `BroadcastChannel`, or the `storage` event when the browser has none). A tab that hears it (`use-cross-tab-session.ts`) bumps its session revision, cancels requests in flight, removes org-scoped data and placeholders and asks `/me/` again before org-scoped queries run; the route guards then run again. The rule is "the cookie is the truth": a login or sign-out that completed on the server is never dropped; the tab reconciles with `/me/` (`session-reconcile.ts`) and applies its identity (a re-authentication that finishes after another identity was recorded included). State rule: the identity is known(user, org, revision) | reconciling | unknown, and org-scoped queries and mutations run only in `known`; if `/me/` fails while reconciling the tab shows the blocking "session check failed" state with a retry and never falls back to the old identity. Every server-confirmed login broadcasts exactly once and receivers do not echo it; on a revision change pending queries of the old revision are cancelled and the active ones asked again. AppShell renders org-scoped content only in `known`; in `reconciling` and `unknown` a blocking overlay covers the page (screens stay mounted and inert, drafts are kept), and every org-scoped query function and mutation guard refuses to start outside `known`. Leaving `known` for any reason (a failed verification, any 401 of `/me/`, a query or a mutation) goes through the one function `leaveKnown` (`session-controller.ts`), which bumps the revision, cancels pending org-scoped queries and removes org-scoped data, so returning to `known` always starts from an empty org cache; the blocker is a modal `<dialog>` opened last, so it covers a content dialog that was open. Every path that observes a session change (broadcast, storage, focus, visibility, retry) goes through `reconcileSession`, deduplicated. `/me/` is accepted only for the revision that asked for it (`fetchMeCommitted` is the only path into the cache): a stale answer is discarded, and starting a reconcile, a login or a confirmed sign-out aborts the run in flight (latest wins, runs are not queued). The server attests the identity of every response (`X-Session-Identity`, an opaque HMAC of user, organization and session; see `docs/api-conventions.md`): the one api-client middleware (`session/attestation.ts`) compares it with the value learned from the accepted `/me/` and, on a mismatch, never resolves the data, leaves `known` and reconciles. `known` is set only from an accepted `/me/` (never from a cancelled or reverted query), an unrecorded identity does not match, and `installSessionSync` (called by `createAppRouter`) installs the cross-tab listener, the focus verification and the mismatch handler before any guard runs. Switching organization is a leave-known transition (reconciling and the organization data removed BEFORE the slug changes; `known` again only after its `/me/` is accepted), and with no expected value every org-scoped 2xx answer is rejected (only `/me/` and `/auth/` pass). Tests that render below the router use `signInForTest` and the fake server attests every answer. Single writer: `session/session-controller.ts` is the only module that writes the epoch, the session state, the organization slug, the recorded identity and the expected attestation (`session-writers.test.ts` fails if another module does). An operation takes a token with `begin`, and publishes only through `commitKnown`, which commits in one synchronous step if and only if the token is still the epoch; a stale token changes nothing. The candidate (`/me/`, attestation, slug) comes only from the network answer and nothing is ever restored from an earlier value: a failed or superseded operation calls `failIfCurrent`. A late login or sign-out answer with a stale token is not published; the tab reconciles with `/me/` instead. Login, re-authentication and sign-out begin with `begin("leave")` before the request is sent (the tab leaves `known`, org data is cleared); any outcome that is not a published login (abandoned, aborted, failed, indeterminate) ends in a reconcile with `/me/`. Every `begin()` returns a fresh token (epoch + unique operation id) and only the latest begun operation can commit, so a late login body never overwrites what a later verify confirmed. Each tab also verifies `/me/` whenever it becomes visible or focused, so a tab that missed the announcement still reconciles. The message carries no data.
- **Not in the table.** No column visibility, resizing, pinning or virtualization (no screen needs them yet). The table library (TanStack Table 9.3.1, decision 21) is only the row, column and selection model.
- **W67 phones** (`/settings/phones`, permission `device.read` from `/me/`): read only, one filter (`is_revoked`), page-number paging. `GET /devices/` has no `ordering` and no `include_voided`, and its `user` filter needs a user picker that does not exist yet, so the screen has none of those. Revoking a phone, the version cards and the APK upload are other issues. W62 (#36) is the second consumer.
- **Void with reason (#32)**, `src/void/` (import from `src/void/index.ts`): `VoidDialog` (native modal `<dialog>`: focus on the reason select, trap, focus back to the opener, conditional Other textarea and counter with the minimum, no Cancel or Escape while the request runs, errors by `code` translated from `voiding.*` / `errors.api.*`), `submitVoid(queryClient, () => client.POST(".../void/", ...))` (a 401 or `403 no_active_membership` is reported to the session first) with `voidFailureOf`, `useVoidLimits()` (the minimum and maximum come from `GET /me/` `limits`; the server's answer wins) and `voidInfoOf(record, authorLabel, {formatWhen?, reasonLabel?})`, which returns the table's `VoidInfo` `{reason, note?, author, when?}`. `useVoidReasonLabel()` shares the full catalog query (including deactivated items) and resolves a code in the current language, with Spanish fallback; missing codes or an unavailable catalog fall back to the raw code. Other keeps its free text; regular reasons show the catalog label with any note on a separate secondary line. A screen mounts the dialog from its "Void" button and passes `record` (code), `limits`, `submit`, `onVoided`, `onCancel`. The dialog reads all pages of `GET /catalogs/void-reason/items/` through a session-scoped TanStack Query, displays active items in API order (Other last), and uses the user's language with Spanish fallback. Loading disables the select; failures or an empty catalog show a retry and block submission. There is no default selection. `submit` receives `{reasonCode, reason}`: normalized text for Other, otherwise `""`; W62 sends `{reason_code, reason?}`, omitting empty notes. A rejected stale code resets the selection and refreshes the catalog. Other reasons are counted like the server does (`count-characters.ts`: NFC, invisible text and whitespace ignored, control and bidi text refused). Voided rows have ONE rendering: the DataTable's always-visible `VoidedDetail` (badge, reason, author, optional date; `voidOf` returns `voidInfoOf(...)`), not hover-only text (WCAG 1.4.13). The first screen that voids is the W62 history (`rules/VoidVersionDialog.tsx`). Dev-only harness (`web/harness/`): `npm run dev -w @wolbachia/web`, then `/harness/void.html?answer=ok|tooShort|alreadyVoided|blocked|network|slow&lang=en&theme=dark` (not in the build, not a route). No `DELETE` call exists anywhere in the web.

### Rule parameters (W62, #36)

Decision 88 in `docs/decisions.md`; backend contract in `docs/api-conventions.md` (row "Rule parameters (#3)"). All of it is in `src/rules/`.

- **Routes.** `/settings/rule-parameters` (list, `rule_parameter.read`) and `/settings/rule-parameters/<key>` (a parameter by its key, its human code). The key must match the API's `^[a-z][a-z0-9_]*$`; anything else is "not found" without a request. The organization is never in the address.
- **List** (`RuleParametersPage`): `DataTable` + `FilterBar` over `GET /rule-parameters/` (page size 200, the API maximum; no filters, no ordering). Name (link), key, unit, value in force (link, right-aligned), since when and next scheduled change. A parameter with no version is **"Not configured"** (badge with icon), never `0`. `FilterBar` draws nothing when a list has no filters.
- **Parameter page** (`RuleParameterPage`): summary (value, since, next change, allowed range), then, by permission (hidden when missing, never disabled): the **new version form** (`rule_parameter_version.create`) and the **history** (`rule_parameter_version.read`; "Void" needs `rule_parameter_version.void`).
- **New version form.** Value, effective date (a calendar date, `YYYY-MM-DD`) and reason. The value is checked against the parameter's `min_value`/`max_value` and `integer`/`decimal` as it is typed (`version-schema.ts`, the same checks as the server's `validate_value`); once it is valid, a **before / after** card shows what applies today (struck through) against the new value and its date. The server decides: its codes map to catalog keys (`create-version.ts`): `out_of_range` (with `{min, max}`, which win over the loaded limits), `not_an_integer`, `effective_from_in_past`, `effective_from_too_far`, `duplicate_effective_date` and a `reason` error; anything else is an alert (`errors.api.*`). The date is **not** checked against today in the browser: "today" is the server's clock in the organization's time zone, so a past date is answered by the server (`effective_from_in_past`).
- **History.** `DataTable` over `GET .../versions/` with value, day, status (scheduled / in force / superseded / voided, icon + word), reason, author and when it was recorded. Voided versions are hidden until "Include voided" is on, then shown with `VoidedDetail`. The API always returns them and has no `include_voided`, so `hide-voided-versions.ts` hides the voided versions **of the page in view** (a history page holds 100 versions) and says how many ("N voided hidden on this page"); the server's total and paging are never changed, so no page becomes unreachable. Only a **scheduled** version can be voided: its "Void" opens the shared `VoidDialog`; for a version in force or past the button stays visible, `aria-disabled` and described by the note "already in force". A `409` (`version_not_scheduled`, `already_voided`) is answered in the dialog and refreshes the history.
- **Names, units, authors.** The API sends only `key` and `unit`: `parameter-labels.ts` maps the seeded keys and units to `rules.*` messages (a key it does not know shows its own code; units are typed on the API's enum). The API sends author ids only: `use-author-label.ts` names the signed-in user and writes "User <8 characters of the id>" for anybody else (follow-up #88).
- **Queries.** The POSTs (new version, void) run outside TanStack Query, so they use `session/use-session-guard.ts`. One rule: the session revision (`session-revision.ts`) is the ONLY staleness signal. It is bumped synchronously on an accepted login, a confirmed sign-out and when `/me/` names another identity (`recordIdentity` calls `changeIdentity()`), and a guard compares only `revisionAtSubmit !== currentRevision()`, never React-rendered state (which lags behind TanStack's deferred notifications). The request also gets an `AbortSignal`, aborted on unmount; each parameter page is keyed by its key, so another record remounts and keeps nothing of the previous draft or request. A stale answer is dropped before it is reported to the session, shown in the form or used to invalidate queries. A failed background refresh of the parameter keeps the form and its draft and shows a retry notice; only the first load fails the page. Every query and invalidation of W62 is in `rules-query.ts` (one place for the org-scoped keys of #82). No `keepPreviousData` here: it is the placeholder that #82 restricts to the same session identity.
- **Not built (out of the design or the API):** regional override and region tabs (per organization, decision 42), the "Default" and "Origin" columns, the "Affects" text and the epi week of the date (no data in the API), the side panel (the form is on the parameter's page) and the notice to supervisors after saving.

### Session, guards and permissions

Built in #28 (decisions 77 to 81 in `docs/decisions.md`). Backend contract: `docs/api-conventions.md` (rows `GET /me/`, "Auth endpoints", "Error codes (#4)", "Login protection") and `packages/api-client`.

- **Routes.** Public: `/login?redirect=<internal path>&notice=`, `/forgot-password`, `/reset-password#uid=<uid>&token=<token>` (the link the backend writes in the reset email, from `WEB_PASSWORD_RESET_PATH`; see "Reset-link formats"). `/select-organization` needs a session but not an organization. Everything else is inside the shell and behind `requireOrganization`.
- **Reset-link formats (#58, decision 83).** The emailed link keeps `uid` and `token` in the URL fragment, which browsers never send, so no nginx, TLS proxy or log aggregator sees them. `ResetPasswordPage` reads the fragment once with `URLSearchParams` (`auth/reset-link.ts`: one `uid` and one `token`, each `[A-Za-z0-9_-]{1,128}`), keeps the values in memory and replaces the address bar with `/reset-password` before any request. The same happens for every later fragment (a second link pasted into the same tab is a hash-only navigation: the credentials are replaced and the form starts over); a missing or malformed fragment shows the invalid-link state. Neither value is logged. **Old path format** `/reset-password/{uid}/{token}` (emails sent before #58) is still served by `LegacyResetPasswordPage` for one token lifetime (`PASSWORD_RESET_TIMEOUT`, 3600 s). Note dated 2026-11-04: it can be removed 1 hour after the first production deploy of #58, tracked in #62 (route `legacyResetPasswordRoute` in `router/router.tsx`, `LegacyResetPasswordPage`, its tests, and the `location /reset-password/` block in `nginx/default.conf`). CI checks that the nginx log of the e2e run holds no reset token.
- **Session state** is the `["me"]` query (`session/me-query.ts`): fresh for 60 s, refetched on window focus and on guarded navigations after that, so a permission changed by an administrator reaches the navigation. There is no custom auth context.
- **Guards** (`router/guards.ts`, `beforeLoad`): no session (`401`) goes to `/login?redirect=<path>`; `403 no_active_membership` goes to `/login?notice=no-membership`; no active organization goes to `/select-organization`; an area whose permissions are not met throws `ForbiddenError` and its error component renders the "no permission" state inside the shell. `safeRedirect` accepts only internal paths (not `//host`, backslashes, schemes, control characters or `/login`).
- **Permissions.** `can(me, permission)` and `useCan()` look only at the permission codes of `GET /me/`, never at profile names. Each area in `router/areas.ts` has `requiredPermissions`: a list of codes (at least one), `[]` for every member (Home), or `"pending"` until its issue defines a code. `router/area-access.test.ts` lists the pending areas; the issue that builds an area replaces its `"pending"` and removes it from that list. B-01 defines explicit `none|selected|all` modes in both dimensions; an empty selected scope denies access. `can()` intentionally checks the action code only. W65/W68 navigation and queries also require a nonempty explicit center grant; the backend enforces paired action/object scope on every request.
- **Organization.** A multi-organization user chooses on `/select-organization` (not in the design, built with the sign-in layout). The slug is kept in memory and `localStorage` (`wolbachia.organization`), travels only as the `X-Organization` header (never in a URL or body), is forgotten when the server refuses it and is cleared on sign-out. Choosing one drops the cache of the previous organization and refetches `/me/`.
- **Sign-in.** The CSRF cookie is requested when the page opens and again before submit if missing; a `403 permission_denied` refreshes it and retries once. All credential failures read the same; the remaining attempts are not shown (the API does not provide them); a `429` shows the wait in minutes from `Retry-After`.
- **Sign-out** posts `/auth/logout/` (CSRF), clears the slug and the query cache and goes to `/login`. If the server cannot be reached the user stays signed in and is told.
- **Session expiry.** Any `401` after sign-in (from any query or mutation) opens a modal re-authentication dialog over the page (native `<dialog>`; username read-only; Escape does not dismiss it), so drafts survive. After signing in again the active queries are refetched; the failed request is not repeated. A mid-session `403 no_active_membership` forgets the organization and re-runs the guards. **[PENDING backend]** the session is a fixed 12 h (`AUTH_WEB_SESSION_AGE_SECONDS`) and no expiry or keep-alive is exposed, so the design's "your session closes in 0:58 / Stay signed in" banner and its "30 min idle" copy are not built.
- **Not built (no endpoints) [PENDING]:** the 2FA second step and the first-time privacy-notice acceptance of W1; "Request access" and the error reference number of the global states. W68 supports only the authenticated same-origin raster logo; remote URLs fall back to initials.
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


### W20-W21 fleet (#156)

- `/fleet` keeps its placeholder and links to `/fleet/motorcycles`. The area, navigation and both motorcycle routes require `motorcycle.read`; create/void require `motorcycle.manage`, unblock requires `motorcycle.unblock`. Forbidden actions are hidden; state-blocked actions remain keyboard-reachable with visible descriptions.
- W20 uses `DataTable`/`FilterBar`: code (record link), plate and status with icon/text, translated block reason and shared void history. URL-owned `is_blocked`, `include_voided` and page-number paging (25 rows); no ordering controls because #72 orders by code/id and has no ordering parameter. The center/odometer/next-service/efficiency gap is visible.
- W21 resolves a human code with `GET /motorcycles/?code=…&include_voided=true&page=1`, using the returned item without a second detail request. Empty scoped lookups share the same not-found state for unknown and foreign codes. Flat `tab=summary|services|responsibility|fuel|incidents` links preserve all other search parameters; unknown tabs are named in the shared ignored-parameter notice and fall back to Summary without rewriting the address. Back restores the list filters/page.
- Only the existing generated #72 API is consumed. Summary shows code, plate, state, translated block reason and audit references/dates. Other tabs explicitly name unavailable B-05 (#103) history; Fuel says insufficient data. There are no fabricated history rows, counters, source records or efficiency advisories.
- All queries and invalidation live in `src/fleet/fleet-query.ts`, under one ROOT and user/organization-scoped identity. When #83 lands, only that file needs the shared helper. Context changes drop old queries and remount drafts/dialogs; abort signals and session revision guards discard late answers before session reports or invalidation. Writes are explicit attempts and never replay after reauthentication.
- Unblock and void reuse `VoidDialog`/`submitVoid` and `/me/` void limits, including visible-character counting, normalized trimmed reasons, focus/return and preserved evidence after conflicts. A forked, dialog-local i18next resource store changes action wording without changing global translations. `motorcycle_not_blocked`, `motorcycle_in_use` and `already_voided` stay in the dialog and refresh the record. Refreshing or failed refreshes withhold readiness badges and disable record actions; Retry is explicit.
- Create uses React Hook Form/Zod (code up to 50, optional plate up to 20); `duplicate_code` focuses the code field and preserves the draft. No API generation, generated-file edits or new dependencies.
- Follow-ups: B-05 (#103) odometer/next-service data, services/responsibility/fuel/incident history and source links, comparable efficiency intervals/advisory and fault-specific inspection/clearance; plate PATCH UI. The existing unblock endpoint clears the single backend-recorded block, not an invented individual-fault endpoint.
- Verification: component journeys live in `src/fleet/*.test.tsx`; the session suite uses deferred responses for identity/organization isolation and an expired-write reauthentication journey. `e2e/fleet.spec.ts` covers browser wiring, modal keyboard focus, axe and 320 CSS px in es-MX/en and light/dark; it must run in an environment with Playwright available. Component axe cannot establish browser contrast, native modal trapping or visual reflow.

### W65/W68 organization, roles and scope (#147)

`/settings/organization` and `/settings/roles` require their exact read permissions. These organization-global resources do not require a center grant; none/empty dimensional scopes restrict center-bound resources only. Navigation, settings links and query enablement follow the same action-only rule. Configuration writes use `expected_revision`, preserve refused drafts and require explicit review on conflicts. Nine profile bundles are backend data; consultation-only/empty bundles are conservatively read-only. Membership scope uses the generated change-scope action. Scope is shared per bundle; the UI never invents per-action scope payloads.

The shell center selector consumes backend-scoped centers across all server pages, offers all only for an explicit all grant, and remembers its filter per user id + organization slug through safe storage. Changing it cancels/removes org query results, changes their context keys and clears URL filters/chips. Invalid remembered ids are removed after list validation. A changed `/me/` permission/scope projection changes the session authorization identity through the existing controller, drops old results and rechecks deep links. The selector never writes grants. Organization-global B-01 resources remain unfiltered. Quadrant and motorcycle list/code queries pass the explicit URL center first, otherwise the active center, otherwise omit the parameter. Blocks and sampling points do not declare a center parameter and retain their parent quadrant constraint. Backend scope remains authoritative.

Branding accepts PNG/JPEG/WebP; browser raster decoding normalizes all three formats, including grayscale/indexed PNG, to the bounded RGB/RGBA PNG currently accepted by B-01. Only the same-origin authenticated raster endpoint is loaded, via the generated client (organization header + cookie); CSP permits its PNG data URL. Missing/unsafe logos show initials. Country is read-only, as the update contract omits it. Revision history/effective timestamps, exports, voiding and tenant creation are absent from this contract.

See [W-03 README](src/settings/organization/README.md) for the fixed-profile metadata/catalog gaps, design deviations, criterion-to-test map and local verification limits. `e2e/w-03.spec.ts` is one wiring journey across language/theme combinations, reserved for CI.

## W22-W24 geography (#157)

See [quadrants README](src/quadrants/README.md) for architecture, permissions,
contract limits and the criterion-to-test map. W22 is /quadrants; W23 is
/quadrants/<code>/versions; W24 renders inside that record. Every visible list
uses DataTable/FilterBar and server paging. Form drafts stay in memory. The
history dialog uses history_page without changing the background list page.

### Lazy map dependencies and provenance

Exact runtime pins: react-map-gl **8.0.4** (published 2025-04-16) and maplibre-gl
**5.6.2** (published 2025-08-06), verified with npm registry metadata on 2026-11-05;
both exceed the two-week age requirement. react-map-gl is the vis.gl maintained
React binding; MapLibre GL JS is the MapLibre maintained renderer (MIT and BSD-3-Clause,
respectively). These implement accepted decision 23, instead of a new map stack or
hand-written WebGL renderer. Only react-map-gl/maplibre is imported, inside the
lazy map module; no Mapbox renderer/token is used. The coordinate/list path has
no renderer dependency. References: [react-map-gl installation](https://visgl.github.io/react-map-gl/docs/get-started),
[MapLibre API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/),
[npm react-map-gl](https://www.npmjs.com/package/react-map-gl/v/8.0.4),
[npm maplibre-gl](https://www.npmjs.com/package/maplibre-gl/v/5.6.2).

### Tiles, attribution and production migration

Public build configuration:

| Variable | Meaning |
| --- | --- |
| VITE_MAP_TILES_URL | HTTPS raster XYZ template with {z}/{x}/{y}, or a HTTPS/same-origin MapLibre style URL. Empty defaults to the interim OSM raster source. |
| VITE_MAP_ATTRIBUTION | Required plain-text provider/dataset attribution for a custom source; never HTML or a secret. OSM copyright attribution remains visible and linked. |

The interim default is https://tile.openstreetmap.org/{z}/{x}/{y}.png for light,
interactive web use only, under the [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
No tile request starts until the person opens the map; max zoom is 19. There is
no bulk download, scraping, prefetch, service-worker/offline tile cache or
application cache bypass. Browser HTTP caching follows the provider headers.
The visible OpenStreetMap contributors attribution links to its copyright page.
The browser sends its normal User-Agent and an origin-only Referer; strict-origin
never exposes record paths, reset paths or fragments.

**[ASSUMPTION]** The IN10 organization-hosted versioned OSM-derived PMTiles archive
and approved style/font package do not yet exist. Before production, host the
approved archive behind an organization tile service that exposes raster XYZ or
an approved MapLibre style with HTTPS tile/glyph/sprite resources. Set the two
variables to that source/attribution and rebuild. A raw pmtiles:// archive URL is
not supported by this raster/style adapter; serving the archive requires the
organization's tile service. Dataset/style/font licenses and production coverage
still require owner verification. No public OSM bulk/offline download is added.

Vite emits dist/security-headers.conf from web/nginx/security-headers.conf using
its resolved build environment (including --mode). Docker accepts both map build
arguments and copies that generated file into nginx. CSP img-src/connect-src
allow only self and the configured tile origin; worker-src allows self/blob for
MapLibre. Styles must keep tile/glyph/sprite resources on that origin or self;
no broad https wildcard is added. The static source config supports the default
OSM source. API session/CSRF and API network access still use api-client only.

Design differences: fixed center/code identity; no invented responsible/effective
schedule/progress/risk data; evidenced keep/move/remove instead of transferring
points between quadrants; non-blocking API spacing warnings without an invented
save-with-reason endpoint; W24 inside W23; accessible coordinate editing and phone
reflow added to the desktop intent. No production deployment is included.
### Catalogs (W63, #35)

`/settings/catalogs` opens the first catalog returned by the API, or an empty state.
`/settings/catalogs/<slug>` provides API-defined tabs and a generic item editor, gated by
`catalog.read`. Create, edit/reorder, deactivate and activate use their own permission codes.
Queries use `orgScopedQueryOptions` with session identity; keys and `invalidateOrgScoped`
for the `catalogs` resource live in `catalogs-query.ts`. The editor, dialogs and drafts are
keyed by user, organization and catalog slug, so changing identity discards drafts and rows.
See [catalog module](src/catalogs/README.md) for ordering, pagination, session guards and tests.
Inactive items are hidden unless `include_deactivated=true`; configuration is deactivated
after confirmation and can be reactivated, rather than voided. The boolean `in_use` is
shown with an accessible icon/text badge. The usage count, authorship and atomic reorder
remain follow-up #182. Other free-text validation belongs to consumer screens and mobile.

## Visual refresh #202: shared components and approval preview

Source of truth: issue #202 plus the owner's approved Step 1 preview (decision 122).
Historical design CSS is retained. Step 1 provides the approved tokens and
shared components. Step 2 applies them to existing screens without changing behavior.

Run npm run dev -w @wolbachia/web, then open /harness/style-preview.html.
Use ?theme=dark, ?lang=en, or both. This separate dev-only Vite entry uses the
real shell, in-memory history and a fake API with domain demo records. It is
neither a production route nor a production build entry. Preview query themes
do not overwrite the saved theme preference. The owner approved Step 1 with one
theme control in the top bar; regression review targets 1440/1280/768/390/320 px.

Shared components:
- src/ui/: buttons, cards/menus, folder tabs, status pills, notices/banner,
  tooltips, Radix dialog/sheet/irreversible confirmation, queued actionable
  toasts, delayed skeletons, empty/error/refreshing states.
- src/analytics/: linked KPI cells with spoken signed deltas, relative time
  in the organization time zone, SVG trend/mini-bar charts and equivalent tables.
- src/forms/: labeled text/select/search and blur-first validation.
- src/shell/: permission-filtered command palette (Ctrl/Cmd+K), help (?),
  canvas sidebar with user menu and persistent width; the single sun/moon switch
  lives in the top bar.
- DataTable retains its previous API. Optional groupOf, renderDetail, rowActions,
  density, onDensityChange and embedded add grouped headings, accessible expansion,
  focus-visible row actions and controlled comfortable/compact density.
  The embedded option omits the outer table frame when a parent Card supplies it.
  These options never sort, filter or aggregate server-owned records.

The sidebar separator supports ArrowLeft/ArrowRight (16px), Home/End (200/360px),
Enter (collapse) and double-click (reset 248px). Compact mode changes appearance
without overwriting desktop preferences. Width storage is validated and clamped.
System remains the stored default until the first explicit toggle. The top-bar
switch follows the live resolved appearance; there is no separate System picker.
Global scrollbars and existing native-dialog surfaces use the same tokens; native dialog logic is unchanged.

Primitives: [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog),
[Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) and
[cmdk](https://github.com/dip/cmdk), using the exact already-installed versions.
Fonts are self-hosted Inter and latin 400/500 JetBrains Mono. Codequim blue remains
the action/focus accent; chart orange remains provisional until owner approval.
The preview demonstrates skeleton, empty/no-results, scoped error with details,
partial, refreshing and Undo states. Native alert/confirm/prompt is forbidden.

Focused verification (one worker; no Playwright on this host):
npx vitest run --maxWorkers=1 --pool=threads src/shell src/data-table src/styles src/ui src/forms src/analytics src/theme.
If host memory cannot sustain multiple forks, run the same test files individually.

On this low-memory Windows host, npm/fork startup can fail before tests start.
From web/, the installed CLI can run without the npm wrapper:
node ../node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads TEST_FILE.
This still runs Vitest with one worker; no packages or project settings change.
Pool behavior: https://vitest.dev/config/pool.

The shell command palette and shortcut help share one modal slot (#202 review).
Their invocation gate excludes open native/Radix/ARIA modals and blocked,
expired or signed-out sessions. Shell portals unmount immediately on dismissal;
focus restoration never overrides another active modal. Tests cover both modal
opening orders and reauthentication focus without timer-based waits.

The session-expiry regression uses a real rule-version reason draft, including
value retention during and after reauthentication. A local, identity-scoped
parameter definition keeps that editor mounted while organization queries are
cleared and revalidated; it never restores query-cache entries. A changed user,
organization, parameter or authorization boundary clears the old draft. Transient
revalidation failures preserve it with Retry. The e2e session fixture checks the
same real field; its screenshots and browser journey are run in CI.
