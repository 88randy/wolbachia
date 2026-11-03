TITLE: [Backend] Bootstrap Django project, Docker, CI and multi-organization foundation
LABELS: backend,priority:high

## 1. Context
One PostgreSQL database, but data must stay separated by organization (company) in case other organizations join. Mobile and web share this backend (see `docs/api-conventions.md`, `docs/web-api-needs.md`).

## 2. Goal
Dockerized Django + DRF project with organizations, memberships/roles, row-level isolation, OpenAPI generation and CI.

## 3. Scope / Out of scope
**In:** `backend/` project, env-based settings, Docker Compose (web, db, redis, celery), apps `organizations` and `accounts` (models only), base mixins, org-scoped querysets, DRF permissions, drf-spectacular at `/api/v1/schema/`, pytest + coverage, ruff, GitHub Actions with `paths: backend/**`.
**Out:** auth flows (#4), deploy to DigitalOcean (#18), role × action matrix editor (web W65).

## 4. Data model
- `Organization`: id uuid, name, slug unique, country, timezone, languages, logo, is_active.
- `OrgScopedModel` (abstract): organization FK (required, indexed), created_at, created_by.
- `VoidableMixin`: voided_at, voided_by, void_reason (no physical delete).
- `Membership`: user, organization, profiles (multi), scope (centers/quadrants), is_active. Unique (user, organization).
- `Profile` (OrgScoped, data not code): slug, name, permission codes. Seeded: field_worker, supervisor, entomologist, community_promoter, admin. Coordinator, warehouse, regulatory and government read-only are added as data if the client confirms them (`docs/decisions.md`); no code change needed.

## 5. Contract (API / interfaces)
- `OrgScopedQuerySet.for_org(org)`, `OrgScopedViewSetMixin` resolving the active org per `docs/api-conventions.md`.
- `GET /api/v1/health/` → `{"status":"ok"}`.
- `GET /api/v1/me/` → user, organization, profiles, `permissions[]`, scope.

## 6. Behavior
Every business table inherits `OrgScopedModel` (+ `VoidableMixin` where it applies). Objects of another org return `404`.

## 7. Edge cases & errors
- No active membership → 403.
- More than one membership without `X-Organization` → 400.
- `organization_id` in body is ignored.

## 8. Acceptance criteria
- [ ] `docker compose up` runs the stack.
- [ ] CI runs lint + tests + schema generation on backend changes.
- [ ] Tests prove org A cannot list/read/write org B data (404).
- [ ] No `DELETE` routes on business resources (test).
- [ ] `.env.example` documented; no secrets in repo.

## Notes
Conscious deviation from the PYROBYTE default (DB per tenant), decided by the client.
