TITLE: [Backend] Deploy backend to DigitalOcean with GitHub Actions
LABELS: backend

## 1. Context
#2 delivers a dockerized backend but leaves deployment out. The PYROBYTE standard is DigitalOcean droplets with Docker, managed PostgreSQL and S3-compatible storage kept separate, deployed by GitHub Actions.

## 2. Goal
A merge to `master` that touches `backend/` deploys a tested image to a staging environment; production deploys are a manual, approved step.

## 3. Scope / Out of scope
**In:** production Dockerfile (non-root, no secrets in the image), image registry, GitHub Actions deploy workflow, environment secrets in GitHub environments, migrations step, health check, rollback to the previous image, `.env.example` updated, runbook in `docs/deploy.md`.
**Out:** web deploy (#26), mobile update server (#1 / #11), infrastructure sizing decisions.

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
`GET /api/v1/health/` (from #2) must return 200 before traffic switches.

## 6. Behavior
- Staging: automatic after CI passes on `master`.
- Production: manual approval through a GitHub environment.
- Migrations run before the new containers start; a failed migration stops the deploy.

## 7. Edge cases & errors
- Health check fails → keep the previous containers running and fail the job.
- Missing secret → the job fails before building.
- Destructive migration → requires a separate approved PR (no automatic data loss).

## 8. Acceptance criteria
- [ ] Staging deploy runs from `master` and passes the health check.
- [ ] Rollback procedure tested once and documented in `docs/deploy.md`.
- [ ] No secret in the repo or in the image (scan in CI).

## Notes
[PENDING] Droplet size, region, domain names, registry choice (DigitalOcean Container Registry vs GHCR), and who approves production deploys. Needs the client/infra owner.
From #4: production needs `DRF_NUM_PROXIES` (no default), `EMAIL_URL`, `DEFAULT_FROM_EMAIL` and an https `WEB_BASE_URL`. The TLS proxy must overwrite `X-Forwarded-For` and the app servers must never be reachable directly (throttles and login lockout key on the client address). Schedule `manage.py clearsessions` for web sessions.
