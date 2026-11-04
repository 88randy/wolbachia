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

**[ASSUMPTION]** Everything below is a placeholder until the scaffold (issue 26) lands.

- Runs as a `web` service in the repo's Docker Compose setup, next to `backend`.
- The API base URL comes from an environment variable (name **[PENDING]**). No secrets in the web bundle.
- `packages/api-client` is regenerated from the backend OpenAPI schema; do not edit generated code by hand.
- Stack (decided in spike #27, see [`docs/adr/0001-web-stack.md`](../docs/adr/0001-web-stack.md)): Vite, TanStack Router, TanStack Query, TanStack Table, React Hook Form + Zod, Recharts, MapLibre via `react-map-gl/maplibre`, i18next, Vitest + Testing Library + jest-axe, Playwright. Node version to pin: **[PENDING]** (issue 26).
- Deploy: GitHub Actions to DigitalOcean, as the rest of the stack. Static hosting vs container: **[PENDING]**.

```bash
# [ASSUMPTION] final commands to be defined in issue 26
docker compose up web
```

## Design source

Design canvas (desktop design system, W1–W71, 10 clickable journeys): Wolbachia web design artifact on claude.ai. Values marked "sample" in the canvas are not product data.
