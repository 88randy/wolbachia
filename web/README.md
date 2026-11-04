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

`compose.yaml` includes `backend/compose.yaml` (issue #2), so `docker compose up` starts the whole stack and `docker compose up web` only this service. The Django service is `api` on port 8000; `API_PROXY_TARGET` in `compose.yaml` and `vite.config.ts` point to it.

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
| `VITE_API_BASE_URL` | yes | Base URL of the API: an absolute `http(s)` URL or a same-origin path such as `/api/v1`. No default in code |

`VITE_*` variables are **read at build time and written into the public bundle**: never put a secret in them. If the variable is missing or invalid the app shows a translated "not ready" screen and logs `Invalid app configuration: VITE_API_BASE_URL ...` to the console, instead of a blank page. Each environment needs its own build (or image build argument `VITE_API_BASE_URL`).

### Layout of `src/`

| Folder | What |
|---|---|
| `app/` | `startApp` (theme, language, configuration check, first render) and `App` |
| `config/` | `readAppConfig`: validates the environment (the only place that exposes `apiBaseUrl`) |
| `i18n/` | i18next fed by `@wolbachia/i18n` (typed keys, `{param}`), `useLanguage` |
| `theme/` | light by default; `data-theme="dark"` on `<html>`; stored per browser |
| `router/` | code-based TanStack Router routes: one placeholder per area (`areas.ts`) |
| `shell/` | skip link, sidebar (232 px, 64 px collapsed), top bar, offline banner |
| `states/` | placeholder, not found, route error, loading skeleton, configuration error |
| `styles/` | global CSS, shared CSS modules, `no-style-literals.test.ts` |
| `storage/` | `localStorage` wrapper that never throws (preferences are conveniences) |

Rules enforced here: every visual value is a `var(--...)` from `@wolbachia/tokens` (a test fails on hex/rgb colors, literal `font-family`, px font sizes or radii and inline `style`); every user-facing string is an i18n key; one component per file, ESLint clean-code limits apply.

### What the shell does today

- Sidebar with the 13 areas of the table above (`/`, `/incidents`, `/operations`, `/quadrants`, `/releases`, `/community`, `/inventory`, `/fleet`, `/lab`, `/people`, `/dashboards`, `/regulatory`, `/settings`), each an empty placeholder page. It lists **all** areas: filtering by permission comes with `GET /api/v1/me/` in #28.
- Top bar slots: search (the `/` key focuses it; no backend yet), notifications (no panel, no count yet), es-MX / en switch (no reload; remembered). The center selector and the user menu are left for #28.
- Banner when the browser is offline. It only says the screen may be out of date: the web is not offline-first like the phone.
- Not found and route errors render inside the shell, with a way home (and retry).
- Keyboard: the first Tab stop is "Skip to content"; after each navigation focus moves to `<main>`; every link and button is reachable; the focus ring comes from the tokens. The active sidebar item uses `color.action` (4.5:1) instead of `color.brand` (4.2:1 with white text, fails AA).
- Not built here: sign-in and permissions (#28), `packages/api-client` and TanStack Query (#12), DataTable and FilterBar (#29), the void pattern (#32), the public portal layout (#25).

Screenshots of the shell (light, dark, es-MX, en, collapsed, offline): [`docs/screenshots/`](docs/screenshots/).

### Stack

Decided in spike #27, see [`docs/adr/0001-web-stack.md`](../docs/adr/0001-web-stack.md). **Installed so far:** React 19, Vite 8, TanStack Router, i18next + react-i18next, Zod, Lucide icons, Inter (self-hosted with `@fontsource/inter`, no CDN: privacy, CSP and a working app without internet), Vitest + Testing Library + jest-axe, Playwright + `@axe-core/playwright`. TanStack Query, TanStack Table, React Hook Form, Recharts and MapLibre are added by the issues that first use them. TypeScript is the root version (6.0.3).

### Build and deploy

- `web/Dockerfile` (build context = repo root): `dev` stage for compose; `runtime` stage = unprivileged nginx 1.30 serving `dist/` on port 8080 with SPA fallback, CSP, `X-Content-Type-Options`, immutable cache on `/assets/` and never on `index.html`. Build it with `docker build -f web/Dockerfile --target runtime .`.
- CI (`.github/workflows/web.yml`): lint, format, type-check, tests and build; Playwright e2e; and the image build (no push).
- **Default deploy target (decided in #26, [PENDING] client confirmation): the nginx container on the DigitalOcean droplet, next to the backend.** Static hosting remains possible because the output is plain files. The deploy workflow is not part of #26.
- **[ASSUMPTION]** the API is on the same origin as the web (a reverse proxy routes `/api/` to Django), so the CSP says `connect-src 'self'` and `VITE_API_BASE_URL=/api/v1`. For another origin, extend the CSP in `web/nginx/security-headers.conf` and settle cookies/CORS in backend #4 (ADR 0001, open point 2).

## Design source

Design canvas (desktop design system, W1–W71, 10 clickable journeys): Wolbachia web design artifact on claude.ai. Values marked "sample" in the canvas are not product data.
