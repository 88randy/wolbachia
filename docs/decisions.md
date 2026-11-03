# Decisions log (ADR-lite)

| # | Decision | Status | Owner |
|---|----------|--------|-------|
| 1 | Single PostgreSQL DB, row-level isolation by `organization_id` | Accepted | PYROBYTE |
| 2 | Offline-first mobile with idempotent event batches | Accepted | PYROBYTE |
| 3 | Immutable records; void-with-reason instead of delete | Accepted | Client rule |
| 4 | Egg count captured on web by entomologist; courier marks Yes/No (`has_eggs`) only when the egg paddle is present (`paddle_present`) | Accepted | Client |
| 5 | Configurable rules/catalogs per organization served by backend | Accepted | Client |
| 6 | Internal distribution, dedicated-mode devices, server-driven updates | Accepted, mechanism pending spike | Client / internal IT |
| 7 | Local DB library (WatermelonDB vs op-sqlite), QR lib, MapLibre offline tiles | Pending spike | PYROBYTE |
| 8 | Monorepo: backend + mobile + web + shared packages | Accepted | PYROBYTE |
| 9 | Web auth: Django session cookie + CSRF. Mobile: access + refresh token bound to a device | Accepted (2026-11-03) | PYROBYTE |
| 10 | Paging: page number for admin tables, cursor for streams (sync, access log, notifications) | Accepted (2026-11-03) | PYROBYTE |
| 11 | Error envelope `{code, detail, fields}`; the API never returns user-facing text, clients translate `code` via `packages/i18n` | Accepted (2026-11-03) | PYROBYTE |
| 12 | Objects by human code via `?code=` on list endpoints | Accepted (2026-11-03) | PYROBYTE |
| 13 | Profiles are data (profile + permission codes). Coordinator, warehouse, regulatory and government are added as data if the client confirms them | Accepted (2026-11-03); profile list pending client | PYROBYTE / Client |
| 14 | Glossary term for *papeleta* is **egg paddle** (`paddle_present`, `has_eggs`) in backend, mobile and web | Accepted (2026-11-03) | PYROBYTE |
| 15 | OpenAPI + `packages/api-client` (#12) lands right after #2, before #3–#5, so every API PR regenerates the client | Accepted (2026-11-03) | PYROBYTE |
| 16 | GitHub Issues are the source of truth for specs; `issues/NN-*.md` mirrors them with `NN` = GitHub number | Accepted (2026-11-03) | PYROBYTE |
| 17 | Web build tool: Vite + `@vitejs/plugin-react` | Accepted (spike #27) | PYROBYTE |
| 18 | Web router: TanStack Router (schema-validated, typed search params as table/filter state) | Accepted (spike #27) | PYROBYTE |
| 19 | Web server state: TanStack Query over plain typed functions exported by `packages/api-client` | Accepted (spike #27) | PYROBYTE |
| 20 | Web forms: React Hook Form + Zod (via `@hookform/resolvers`) | Accepted (spike #27) | PYROBYTE |
| 21 | Web tables: TanStack Table (headless) behind the shared `DataTable` (#29) | Accepted (spike #27) | PYROBYTE |
| 22 | Web charts: Recharts, every chart with its data table | Accepted (spike #27) | PYROBYTE |
| 23 | Web maps: MapLibre GL JS via `react-map-gl/maplibre`, lazy-loaded; OSM attribution | Accepted (spike #27); production tile source pending | PYROBYTE |
| 24 | Web i18n runtime: i18next + react-i18next with `{param}` interpolation; `packages/i18n` stays runtime-agnostic (catalogs + key types) | Accepted (spike #27); mobile runtime decided in #6 | PYROBYTE |
| 25 | Web tests: Vitest + Testing Library + jest-axe; Playwright for e2e. Details in `docs/adr/0001-web-stack.md` | Accepted (spike #27) | PYROBYTE |
