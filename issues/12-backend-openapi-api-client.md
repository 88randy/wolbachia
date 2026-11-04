TITLE: [Backend] OpenAPI schema and shared api-client package for mobile and web
LABELS: backend,web,mobile,priority:high

## 1. Context
Monorepo with one backend for mobile and web. Web needs are in `docs/web-api-needs.md`; shared conventions in `docs/api-conventions.md`.

## 2. Goal
Every client uses a generated, typed client; API changes break CI in the clients before reaching production.

## 3. Scope / Out of scope
**In:** drf-spectacular config, schema export in CI, `packages/api-client` generation (TypeScript types + client), CI check that fails if the committed client is outdated, the `?code=` lookup convention; the shared paging classes and error handler land in #2.
**Out:** implementing every endpoint in `web-api-needs.md` (each lands in its epic).

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
- `GET /api/v1/schema/` (OpenAPI 3).
- `packages/api-client` exports types and a client used by `mobile/` and `web/`.

## 6. Behavior
A PR that changes the API regenerates the client in the same PR (CI enforces it).

## 7. Edge cases & errors
Breaking change detected (removed field/endpoint) → CI requires label `api:breaking`.

## 8. Acceptance criteria
- [ ] Schema generated in CI and published as artifact.
- [ ] Client consumed by a smoke test in mobile and web.
- [ ] `?code=` lookup implemented once as a shared DRF filter, with tests (paging and error envelope come from #2).

## Notes
Runs right after #2, in parallel with #3 and #4, so every API PR can regenerate the client in the same PR.
Generator (e.g. openapi-typescript, orval) to choose here; not verified yet for our setup [ASSUMPTION].
