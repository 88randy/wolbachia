# ADR 0001: Web stack (issue #27)

- **Status:** Accepted (spike #27) once this PR merges.
- **Date:** 2026-11-03
- **Scope:** `web/` only. Backend, `packages/api-client` generator (#12) and mobile are out of scope.

## Context

React is fixed. These constraints already decided (see `CLAUDE.md` > Web, `docs/api-conventions.md`, `docs/decisions.md` #9, #10, #11):

- All data goes through the client generated from OpenAPI (`packages/api-client`).
- Tokens and i18n catalogs come from shared packages. Placeholders are `{param}`, no ICU. es-MX default, en.
- Web auth is a Django session cookie + CSRF.
- Paging is by page number for admin tables and by cursor for streams. Paging, sorting and filtering are server-side and live in the URL.
- WCAG 2.2 AA; every chart has a data table; maps use MapLibre + OSM.
- Docker image, deploy to DigitalOcean from GitHub Actions.

## How candidates were judged

Criteria, in this order: fit with the constraints above, accessibility, TypeScript support, license (client delivery), maintenance, bundle size.

- **Versions, licenses, dates** come from `npm view <pkg> version license time.modified` run on 2026-11-03. "Modified" is the registry timestamp of the last publish.
- **Sizes** are gzip of the library tree-shaken and minified in isolation, measured with `spikes/web-stack/measure-sizes.mjs` (Vite 8 library build, imports as the PoC uses them). Each number includes a small copy of React where the library imports it. They are comparisons, not the final bundle.
- **PoC** (`spikes/web-stack/`) was run with Node 22.13: type-check (`tsc --noEmit`), 4 Vitest tests (all pass), and `vite build`. The PoC uses a mock module with the same shape as the future generated client, because `packages/api-client` does not exist yet (#12). The real `GET /me/` and paged-list calls are therefore **not** proven (see Open points).
- Anything not checked is marked **[ASSUMPTION]**.

## Decisions

### 1. Build tool: Vite

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **Vite** + `@vitejs/plugin-react` | 8.3.5 / 6.2.1 | MIT | 2026-10-21 / 2026-11-02 | Node `^20.19 \|\| >=22.12`. Vitest runs on the same config. PoC build: 766 modules, 1.2 s. |
| Rsbuild (`@rsbuild/core`) | 2.3.1 | MIT | 2026-11-03 | Active. Rspack-based. Less common with the test runner; no fit advantage for a client-rendered SPA. |
| Parcel | 2.16.4 | MIT | 2026-11-03 | Zero config, but weaker ecosystem for our test and lint setup. [ASSUMPTION: not exercised] |

Not considered: Next.js and other SSR frameworks. The app is an authenticated SPA behind a session cookie; there is no SEO or SSR requirement (the public portal is read-only and can be a route group of the same SPA, #25).

**Pick: Vite.** Static output, so deploy as static files behind nginx or as a container (decision for #26). Sources: npm registry; <https://vite.dev>.
**Revisit if:** the build time or memory in CI becomes a problem, or the portal needs SSR.

### 2. Router: TanStack Router

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **TanStack Router** (`@tanstack/react-router`) | 1.170.46 | MIT | 2026-10-22 | Search params are validated with a schema (`validateSearch`; Zod 4 works directly) and are typed in `Link`/`navigate`. Node `>=20.19`. 32.6 kB gz. |
| React Router (`react-router`) | 8.5.1 | MIT | 2026-10-27 | Mature, largest community. `useSearchParams` gives untyped strings; we would write the validation. **Requires Node `>=22.22.0`** (our dev machine has 22.13). 34.3 kB gz measured on 7.18.5, the version npm resolved for Node 22.13. |
| wouter | 3.13.0 | Unlicense | 2026-09-30 | 80 kB unpacked, minimal. No search-param validation, no nested data loading. |

**Pick: TanStack Router.** The table and filter state is the query string (#29), and the router validates and types it: the PoC test shows `?page=abc&ordering=bogus` falling back to defaults without crashing, and filter, sort and page changes writing history entries (back button restores). Per the official docs, `validateSearch` runs on parse and an invalid value shows the route error component unless `.catch()`/fallback is used; we use `.catch()`. Source: <https://tanstack.com/router/latest/docs/framework/react/guide/search-params>.
**Trade-off:** smaller user base than React Router, and nested objects in search params are stored as JSON in the URL (the docs say only first-level params are plain `URLSearchParams`). Keep filters flat.
**Not decided here:** code-based vs file-based routes. The PoC uses code-based routes (no codegen). #26 decides.
**Revisit if:** the router causes a blocker we cannot work around, or `react-router` 8 gets typed search-params support and we want the larger ecosystem. Both are real options on the same codebase because routes stay thin.

### 3. Server state and data fetching: TanStack Query

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **TanStack Query** | 5.105.3 | MIT | 2026-11-02 | Query keys hold the URL state (`["incidents", search]`); `placeholderData: keepPreviousData` keeps the old page while the next loads. 11.8 kB gz. |
| SWR | 2.5.1 | MIT | 2026-09-22 | Simpler, 9.3 kB gz. Fewer tools for mutations, invalidation and paged data. |
| RTK Query (`@reduxjs/toolkit`) | 2.14.0 | MIT | 2026-11-03 | Requires adopting Redux; we have no other global client state. |

**Pick: TanStack Query.** Sources: npm registry; <https://tanstack.com/query>.
**Constraint for #12:** `packages/api-client` should export plain typed functions (no hooks), so mobile can reuse it; web wraps them in `queryOptions`. Which generator (e.g. `openapi-typescript`, `orval`, `@hey-api/openapi-ts`) is #12's decision. Candidates exist on npm (7.13.0, 8.46.0 and 0.99.0 respectively) but none was evaluated here.
**Auth in the client [ASSUMPTION]:** same-origin requests with `credentials: "same-origin"` and the CSRF token header added in one place in the api-client wrapper. Web and API on one origin is **not decided**; if they are on different origins, CORS and cookie settings change (backend #4).
**Revisit if:** the generator we choose in #12 ships its own data layer that fits better.

### 4. Forms and validation: React Hook Form + Zod

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **React Hook Form** + `@hookform/resolvers` + **Zod** | 7.91.0 / 7.0.2 / 4.6.7 | MIT | 2026-10-24 / 2026-11-03 / 2026-10-12 | Uncontrolled inputs (good for the keyboard-first count field); `setFocus`. Same Zod schemas validate the URL search params (decision 2). RHF + resolver + Zod = 36.2 kB gz. |
| TanStack Form | 1.33.5 | MIT | 2026-10-23 | Same family as the router/query/table. Less mature; [ASSUMPTION: not exercised]. |
| Formik | 2.4.9 | Apache-2.0 | 2025-11-10 | No release in about a year. Not recommended for a new project. |
| Valibot (instead of Zod) | 1.5.0 | MIT | 2026-09-09 | 1.3 kB gz for a simple schema vs Zod. Valid option; the resolver supports both. |

**Pick: React Hook Form + Zod.** The PoC count field (W35 shape) validates a negative number, shows a translated error (the schema returns a code, the text comes from i18n) and keeps focus on the field. Server-side field errors (`fields` in the error envelope) map to `setError`; **not built in the PoC** [ASSUMPTION].
**Revisit if:** bundle size becomes a concern (swap Zod for Valibot; resolver stays).

### 5. Table: TanStack Table (headless) behind our own `DataTable`

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **TanStack Table** (`@tanstack/react-table`) | 9.3.1 | MIT | 2026-10-12 | Headless: we own the markup, so semantic `<table>`, `aria-sort`, live region and keyboard behavior are ours. Supports manual (server) paging, sorting and filtering. 13.0 kB gz. |
| AG Grid Community (`ag-grid-community`) | 36.2.0 | MIT | 2026-09-16 | Full-featured grid with its own DOM and keyboard model; 21.6 MB unpacked. Some features are enterprise (paid) [ASSUMPTION: feature split not re-verified]. Heavy for list screens. |
| MUI X Data Grid (`@mui/x-data-grid`) | 9.17.0 | MIT | 2026-10-30 | Server-side modes and ARIA grid support, but pulls the MUI/Emotion styling stack, which conflicts with "tokens only". Premium features are paid [ASSUMPTION]. |
| React Aria Components (`react-aria-components`) | 1.22.1 | Apache-2.0 | 2026-10-09 | Strong accessibility, includes a Table. Not evaluated in depth for server paging [ASSUMPTION]. |

**Pick: TanStack Table, wrapped once in the shared `DataTable` (#29).**
- v9 is a new major (`latest` is 9.3.1; v8 is the version most online examples show). Its own shipped guide says "React owns the semantic markup, styles, event affordances, and accessibility" and documents the Query-backed server-paging pattern. The PoC uses it in v9 style (`useTable`, `tableFeatures`, `createColumnHelper`, `table.FlexRender`).
- The PoC keeps sort, filter and page in the URL and passes only the server's page to the table (no table-side sorting). A full grid with row selection and sticky headers is **not** proven by the PoC.
- Accessibility: the PoC table has `scope="col"`, `aria-sort` on sortable headers, buttons as sort controls, a `role="status"` result count (announced to screen readers), and passes axe. Keyboard operation of sort/page buttons is native (buttons). Row selection and the "voided" hover/focus detail are #29's work.
- Virtualization is not needed at page sizes of 10 to 100; `@tanstack/react-virtual` 3.14.26 exists if a screen needs it. [ASSUMPTION: no screen needs it]

**Revisit if:** a screen needs spreadsheet-like editing (then evaluate AG Grid Community for that screen only) or v9 turns out unstable in #29.
Sources: npm registry; the guides shipped inside `@tanstack/react-table@9.3.1` (`skills/getting-started`).

### 6. Charts: Recharts, always with its table

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **Recharts** | 3.10.1 | MIT | 2026-11-03 | SVG, React components. `accessibilityLayer` (keyboard + screen reader support) is on by default (checked in the installed type definitions). 107.7 kB gz for a bar chart. |
| Apache ECharts + `echarts-for-react` | 6.1.0 / 3.0.6 | Apache-2.0 / MIT | 2026-05-19 | Powerful (heatmaps, maps). 170.5 kB gz for bar + grid + canvas renderer only. Canvas output is opaque to screen readers; it has an `aria` option with decal patterns per its docs [ASSUMPTION: not verified here]. |
| Chart.js + `react-chartjs-2` | 4.6.1 / 5.3.1 | MIT | 2026-10-22 | 75.5 kB gz. Canvas only: nothing for assistive tech, so the table does all the work. |
| visx (`@visx/visx`) | 4.0.0 | MIT | 2026-06-11 | Low-level SVG primitives. Most control, most code to write and maintain. |

**Pick: Recharts**, with a visible `<table>` of the same rows next to every chart (PoC: `WeeklyIndexChart`, table with caption, same data array, passes axe).
- Keyboard and screen-reader behavior of the chart itself was **not** tested with a screen reader. The data table is the accessible path; the chart is treated as an enhancement.
- Bands must be "color + pattern + label" (#38). SVG `<pattern>` fills are **[ASSUMPTION]**: not built in the PoC. Check them in #38 before building it.
- Colors come from `packages/tokens` only. Chart series 2 and 4 are still [PENDING] approval (`docs/web-tokens-diff.md`).
- At 108 kB gz it is the largest chart option below ECharts. Load chart routes lazily (`React.lazy`) so they do not hit the first paint.

**Revisit if:** #38 or W54/W70 need chart types Recharts does not do well (heatmaps, large point sets); then ECharts for those screens.
Sources: npm registry; recharts type definitions (`accessibilityLayer`, "@defaultValue true").

### 7. Maps: MapLibre GL JS through `react-map-gl/maplibre`

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **MapLibre GL JS** (`maplibre-gl`) + **react-map-gl** (`/maplibre` entry) | 6.16.0 / 8.1.3 | BSD-3-Clause / MIT | 2026-10-25 / 2026-09-02 | MapLibre is already set by the design brief. react-map-gl's docs show `import Map from 'react-map-gl/maplibre'`, and for maplibre-gl v6 `import * as maplibregl from 'maplibre-gl'` plus worker setup with a bundler. |
| `@vis.gl/react-maplibre` | 8.1.3 | MIT | 2026-09-02 | Published from the same repo and version as react-map-gl (`visgl/react-map-gl`). Its docs page was not found in the checks; relationship to react-map-gl is [ASSUMPTION]. |
| MapLibre without a wrapper | n/a | BSD-3-Clause | n/a | Smallest surface, but we write the React lifecycle (refs, cleanup, StrictMode) ourselves. |
| react-leaflet | 5.0.0 | **Hippocratic-2.1** | 2024-12-14 | Rejected: not MapLibre, and the Hippocratic license is not a standard open-source license, which is a risk for client delivery. |

**Pick: `maplibre-gl` + `react-map-gl/maplibre`**, loaded lazily per map screen.
- Bundle: 321.5 kB gz of JS plus 10.3 kB gz of CSS (PoC `vite build` emitted it as its own chunk). It must not be in the main chunk.
- The PoC only proves that the map component type-checks and bundles with Vite. It was **not run in a browser** (WebGL is not available in jsdom), so runtime behavior, the worker setup and tile loading are [ASSUMPTION] until #26/W22.
- Attribution "© OpenStreetMap contributors" is set in the style source (required by the design brief). OSM's public tile server has a usage policy that does not suit production traffic; the tile source for production is an open question.
- Accessibility: a map is not keyboard- or screen-reader-usable by itself. Each map screen needs a list/table alternative of the same areas, and areas need color + pattern (already a project rule).

**Revisit if:** the react-map-gl wrapper blocks a feature we need (e.g. live markers from the WebSocket in #19); then use MapLibre directly in that component.

### 8. i18n runtime: i18next + react-i18next, catalogs stay in `packages/i18n`

| Candidate | Version | License | Modified | Notes |
|---|---|---|---|---|
| **i18next** + **react-i18next** | 26.7.1 / 17.1.12 | MIT | 2026-11-01 / 2026-11-03 | `interpolation: { prefix: "{", suffix: "}" }` makes keys use `{param}` (checked in the official docs and in the PoC tests: `"{count} results, page {page} of {pages}"` renders in es-MX and en). 22.4 kB gz. |
| react-intl (FormatJS) | 12.1.6 | BSD-3-Clause | 2026-10-27 | ICU MessageFormat is its core. We decided no ICU. 17.4 kB gz. |
| Lingui (`@lingui/core`) | 6.12.0 | MIT | 2026-11-03 | 2.4 kB gz, but based on ICU messages and a compile step. Conflicts with shared plain catalogs. |

**Pick: i18next + react-i18next.** The language is set from `/me/` (`user.language`) at start; the PoC initializes in either language and a test renders English. Switching language at runtime without reload (`i18n.changeLanguage`) was **not** tested in the PoC.
**Answer to the pending note ("same runtime shared with mobile?"):** `packages/i18n` should export plain catalogs and the key types only (as #17 already says: the runtime is out of its scope). Each app wires its own runtime. i18next is a candidate for mobile too, but whether it works in React Native with our setup is [ASSUMPTION] and belongs to #6.
**Not done:** typed keys (`MessageKey` from `packages/i18n` wired into i18next types) [ASSUMPTION]; the PoC uses plain strings.
**Formats:** dates and numbers use the browser `Intl` API with the user's language and the organization time zone, no extra library. [ASSUMPTION: epi-week calculation comes from the API/org settings, not from a library]
**Revisit if:** we need plural rules that `{param}` plus i18next plurals cannot express in es-MX/en (unlikely).

### 9. Tests: Vitest + Testing Library + jest-axe; Playwright for e2e

| Layer | Pick | Version | License | Modified | Notes |
|---|---|---|---|---|---|
| Unit/component runner | **Vitest** | 5.1.0 | MIT | 2026-11-02 | Same Vite config. Node `^22.12 \|\| ^24 \|\| >=26`. Alternative: Jest (not evaluated). |
| DOM testing | **@testing-library/react** + `jsdom` + `user-event` | 16.3.3 / 29.1.1 / 14.6.8 | MIT | 2026-08-27 (RTL) | Test by role and label, which also exercises accessibility. |
| Automated a11y in unit tests | **jest-axe** | 11.0.0 | MIT | 2026-07-26 | Works under Vitest with a 3-line shim (`expect.extend`; see `src/setup.ts`). `vitest-axe` (0.1.0, last publish 2025-01-22) is stale, so not used. |
| End-to-end | **Playwright** (`@playwright/test`) + `@axe-core/playwright` | 1.64.1 / 4.14.0 | Apache-2.0 / **MPL-2.0** | 2026-11-03 / 2026-10-30 | Alternative: Cypress 16.2.1 (MIT). |

- Two PoC tests run axe on the table page and on the chart page; both pass. axe only catches a subset of WCAG issues; manual keyboard and screen-reader checks stay in the PR checklist.
- jsdom prints "Not implemented: scrollTo" warnings from the router; harmless, can be silenced in the shared setup.
- **E2E is not run in the PoC** (needs the backend and a built client). Playwright is recommended as the one e2e tool; the first e2e flow is the sign-in + a list page, planned in #28/#29.
- `@axe-core/playwright` is MPL-2.0 (file-level copyleft). It is a dev dependency and is not shipped in the bundle. Confirm this is acceptable for client delivery.

**Revisit if:** Vitest 5 or jsdom 29 cause CI problems on the pinned Node version.

## Cross-cutting findings

- **Node version.** Everything chosen runs on Node 22.13 (the dev machine). Minimum engines among the picks: Vite 8 `>=22.12`, Vitest 5 `^22.12`, TanStack Router `>=20.19`. React Router 8 would need `>=22.22`. Pin one Node version in the Dockerfile, CI and `.nvmrc` (decision for #26; which image tag is [ASSUMPTION] until checked).
- **TypeScript.** The root `package.json` pins TypeScript 6.0.3, because typescript-eslint 8.72.1 requires `<6.1.0`. #26 must use the root version, not its own. The PoC has its own TypeScript 7.0.2 (`latest` on npm), but it also type-checks clean with the root 6.0.3 (`tsc --noEmit` run with both), so nothing in it relies on TypeScript 7-only behavior. `react-i18next` declares TypeScript `^5 || ^6 || ^7` as a peer, so 6.0.3 satisfies it.
- **Main-bundle budget.** The PoC main chunk (React, router, query, table, Recharts, i18next, RHF, Zod, all routes except the map) is 835 kB minified, 256 kB gzip, with no code splitting except the map. Recharts alone is about 108 kB of it. Plan: lazy-load charts and map per route; set a budget in CI in #26 [ASSUMPTION: the number to enforce is for #26].
- **Licenses.** All direct picks are MIT, BSD-3-Clause or Apache-2.0, except `@axe-core/playwright` (MPL-2.0, dev only). A scan of the PoC's production dependency tree (117 packages) found: MIT, ISC, BSD-2/3-Clause, Apache-2.0 (TypeScript, a peer dependency of i18next), `MIT OR Apache-2.0`, `MIT AND ISC AND BSD-3-Clause` (`victory-vendor`), and Unlicense (`isbot`). No GPL/AGPL/Hippocratic. This is an engineering check, not legal advice; the client contract decides. Attribution notices (BSD-3-Clause, Apache-2.0) must be kept in the delivered product.
- **Maintenance.** Every pick had a registry publish after 2026-08-27 (oldest pick: React Testing Library, 2026-08-27; React Hook Form 2026-10-24; Zod 2026-10-12). Formik (2025-11-10) and `vitest-axe` (2025-01-22) are the stale ones and were not picked. A registry timestamp is a weak signal: it does not measure issue response or bus factor.

## Consequences

- **Decided in #26:** code-based routes; `VITE_API_BASE_URL` (build time, required); Node pinned to 22.13.0 in `.nvmrc`, Docker and CI (`jsdom` is held at 29.1.1 because 30 needs Node >=22.22); default deploy target is the nginx container (client confirmation pending); icons from `lucide-react`, font self-hosted with `@fontsource/inter`.
- #26 scaffolds with: Vite, TanStack Router, TanStack Query, i18next, Vitest, Playwright; pins Node; decides route style, env var name and static-vs-container deploy.
- #28 uses Query for `/me/` and a `can()` helper; route guards use router `beforeLoad` [ASSUMPTION: API not exercised in the PoC].
- #29 builds `DataTable` on TanStack Table with the URL as state, as the PoC shows. It adds cursor mode, selection, voided rows and export.
- #38 uses Recharts + a table per chart; verify pattern fills first.
- #12 exports plain typed functions and picks the generator.
- `web/README.md` and `docs/decisions.md` are updated in this PR.

## Open points

1. **Real client call.** `GET /me/` and a paged list through `packages/api-client` are not proven; the PoC uses a mock with the same envelope. Re-run the PoC data layer against the real client when #12 lands.
2. **Same-origin vs cross-origin** web/API (cookie + CSRF details). Owner: PYROBYTE.
3. **Production tile source** for OSM-based maps. Owner: PYROBYTE / client.
4. **Client license review** of the dependency list, including MPL-2.0 dev dependency.
5. **Screen-reader testing** of the table and chart with a real screen reader (NVDA/VoiceOver): not done.
