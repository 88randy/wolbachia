TITLE: [Backend] Bootstrap Django project, Docker, CI and multi-organization foundation
LABELS: backend,priority:high

## 1. Context
Single PostgreSQL database for now, but data must be separable by organization (company) without mixing, in case other organizations join.

## 2. Goal
A dockerized Django + DRF project with an `organizations` app, row-level isolation helpers, and CI running on GitHub Actions.

## 3. Scope / Out of scope
**In:** `backend/` project, settings by env vars, Docker Compose (web, db, redis, celery), `organizations` app, base model mixins, queryset scoping, DRF permission, pytest + coverage in CI, ruff.
**Out:** deploy to DigitalOcean (separate issue), auth flows (#accounts issue).

## 4. Data model
- `Organization`: id (uuid), name, slug (unique), is_active, created_at.
- `OrgScopedModel` (abstract): organization FK (required, indexed), created_at, created_by.
- `Membership`: user FK, organization FK, role (field_worker | supervisor | community_promoter | entomologist | admin), is_active. Unique (user, organization).

## 5. Contract (API / interfaces)
- `OrgScopedQuerySet.for_org(org)`; default manager never returns rows without an org filter in API views.
- DRF: `IsMemberOfOrganization` permission + `OrgScopedViewSetMixin` that resolves the active org from the authenticated membership.
- Health endpoint: `GET /api/health/` → `{"status":"ok"}`.

## 6. Behavior
Every business table inherits `OrgScopedModel`. A request can only read/write rows of the user's active organization.

## 7. Edge cases & errors
- User with no active membership → 403.
- User in more than one organization → must send `X-Organization` header; otherwise 400.
- Attempt to create a row for another org → 403, logged.

## 8. Acceptance criteria
- [ ] `docker compose up` starts the stack locally.
- [ ] CI runs lint + tests on every PR.
- [ ] Tests prove a user of org A cannot list, read or write data of org B.
- [ ] No secrets in repo; `.env.example` documented.

## Notes
- Conscious deviation from the PYROBYTE default (DB per tenant), decided by the client: one DB, row-level isolation. Revisit if an organization requires physical separation.
