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
| 26 | npm workspaces at the root (`mobile`, `web`, `packages/*`); folders without `package.json` are ignored | Accepted (Phase 0) | PYROBYTE |
| 27 | TypeScript pinned to 6.0.3 at the root: typescript-eslint 8.72.1 declares peer `typescript` `>=4.8.4 <6.1.0`. Packages and apps use the root version | Accepted (Phase 0) | PYROBYTE |
| 28 | ESLint 9.39.5 with React, a11y, React Native and i18next plugins; Prettier; ruff + mypy (strict on `services.py` / `selectors.py`); pre-commit; Conventional Commits. Plugin peers checked on npm: `eslint-plugin-react` 7.37.5 `^9.7`, `eslint-plugin-jsx-a11y` 6.10.2 and `eslint-plugin-react-native` 5.0.0 `^9`, `eslint-plugin-react-hooks` 7.1.1 `^9 \|\| ^10`, `eslint-plugin-i18next` 6.1.5 declares no peer | Accepted (Phase 0) | PYROBYTE |
| 29 | Shared packages (`packages/tokens`, `packages/i18n`) are consumed as TypeScript source (`main` / `exports` point to `src/index.ts`, no build step); `packages/tokens` generates `dist/tokens.css` on demand (`build:css`) | Accepted (Phase 0) | PYROBYTE |
| 30 | Active organization is resolved in a viewset mixin (`initial()`) from the user's membership and `X-Organization`, not in middleware, so token auth (#4) and Channels (#19) reuse `resolve_active_membership`. `/me/` is exempt from the multi-membership `400` | Accepted (2026-11-03) | PYROBYTE |
| 31 | Custom `accounts.User` (UUID primary key) from the first migration; Django admin is not mounted (it can delete) | Accepted (2026-11-03) | PYROBYTE |
| 32 | `Profile` carries `label_es` / `label_en` as organization data (like catalog items) instead of a single `name`; the API returns no other user-facing text | Accepted (2026-11-03) | PYROBYTE |
| 33 | Profile assignment changes (`Membership.profiles`, M2M `set()`) are configuration, not business records, so they are not voided; an audit log arrives with the role editor (W65) | Accepted (2026-11-03) | PYROBYTE |
| 34 | API client generator (#12), refining decision 19: the client exposes typed `client.GET(path)` calls (`openapi-fetch`) instead of hand-written per-endpoint functions; web wraps them in `queryOptions`, mobile calls them directly. `openapi-typescript` (dev, types only) + `openapi-fetch` (runtime, ~3 kB gzip with our wrapper, works in Metro and Vite, middleware for auth). The package exports `createApiClient`, `unwrap` and `ApiError`, no per-endpoint functions and no hooks. `openapi-typescript` declares peer `typescript` `^5`, so npm installs a private TypeScript 5 inside `packages/api-client` for the generator only (exception to #27: the package itself is still type-checked with the root 6.0.3). Rejected: `orval` (more generated runtime), `@hey-api/openapi-ts` (0.x) | Accepted (2026-11-03) | PYROBYTE |
| 35 | No automatic breaking-change detection (oasdiff, `api:breaking` label) yet: there are no clients in production, so the committed schema diff plus the PR template checkbox "API breaking change" is enough. Revisit before the first production release | Accepted (2026-11-03) | PYROBYTE |
