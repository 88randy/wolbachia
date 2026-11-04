# backend

Django + DRF API shared by the mobile app and the web (single API under `/api/v1/`).

## Rules

- Read [`docs/engineering-rules.md`](../docs/engineering-rules.md) and [`docs/glossary.md`](../docs/glossary.md) first.
- Thin views and serializers; business logic in `services.py`, complex reads in `selectors.py` (both type-checked strictly by mypy).
- API contract: [`docs/api-conventions.md`](../docs/api-conventions.md). If the API changes, update `docs/` and regenerate `packages/api-client` in the same PR.
- Every business table inherits `core.models.OrgScopedModel` (and `VoidableMixin` when it can be voided). Nothing is deleted: model and queryset `delete()` raise `PhysicalDeleteForbiddenError`.
- New org-scoped resources subclass `core.views.OrgScopedViewSet` (no destroy) and, when voidable, add `VoidActionMixin`. Every viewset must declare `required_permissions = {"<action>": "<resource>.<action>"}` (list, retrieve, create, update, partial_update, void...): the base class already uses `HasPermissionCode` (OPTIONS is denied too: there is no code for `metadata`), which denies any action missing from the map. Updates lock the row and answer `409 already_voided` on voided records.
- **Mandatory:** serializers of org-scoped models extend `core.serializers.OrgScopedModelSerializer`, whose relational fields are `OrgScopedPrimaryKeyRelatedField` (never a plain `PrimaryKeyRelatedField`), so an id from another organization fails like a nonexistent one. Expose `created_by` and other non-org-scoped relations as read-only.
- A list endpoint that must resolve human codes sets `code_lookup_field = "code"` on its viewset: `?code=` then filters by exact match (`core/filters.py`, see `docs/api-conventions.md`). Two list endpoints of different paging style need different serializer classes (OpenAPI component names).
- Django admin is not mounted on purpose (it can delete).

## Layout

| Path | What lives there |
| --- | --- |
| `config/` | Settings (`base`, `dev`, `test`, `prod`), URLs, WSGI/ASGI, Celery app |
| `accounts/` | Custom `User` (UUID pk); authentication (#4): login, refresh, logout, password reset, `Device`, `DeviceSession`, bearer authentication, throttles, lockout, final-upload hook |
| `organizations/` | `Organization`, `Profile`, `Membership`; services, selectors, `GET /me/`, `bootstrap_organization` |
| `core/` | Org-scoped base model and viewset, void service, error handler, pagination, permissions, schema hooks, health |
| `tests/` | pytest suite; `tests/testapp` is a test-only app (installed by `config.settings.test`) |

## Run with Docker

From the repo root (needs Docker with Compose):

```bash
docker compose -f backend/compose.yaml up --build
# Host port: API_PORT (default 8000)
curl http://127.0.0.1:8000/api/v1/health/    # {"status":"ok"}
```

Services: `api` (migrate + runserver), `worker` (Celery), `db` (PostgreSQL 18; keep the major equal to the DigitalOcean managed cluster [PENDING: #18]), `redis`. If a host port is taken: `POSTGRES_PORT=55432 REDIS_PORT=56379 API_PORT=18000 docker compose -f backend/compose.yaml up`. Postgres and Redis are published on 127.0.0.1 so the code can also run outside Docker; the venv lives in the image (`/opt/venv`), so rebuild with `--build` after changing `uv.lock`. In dev a Redis outage makes throttled requests fail with 500 (the cache backend does not ignore errors). The compose file carries throwaway dev credentials only; production deploy is #18.

## Run and test without Docker

```bash
cd backend
uv sync                                   # installs the locked dependencies (uv.lock)
cp .env.example .env                      # then edit; .env is git-ignored. Use 127.0.0.1, not localhost, in URLs
docker compose -f compose.yaml up -d db redis   # PostgreSQL is required (ArrayField)
uv run python manage.py migrate
uv run python manage.py runserver
uv run pytest --cov                       # coverage gate: 85 % (pyproject.toml)
uv run mypy .
uvx ruff@0.17.3 check --config pyproject.toml . && uvx ruff@0.17.3 format --check --config pyproject.toml .
uv run python manage.py makemigrations --check --dry-run
cd .. && npm run api:generate             # validate the schema, re-export openapi.yaml and regenerate packages/api-client (commit both)
```

Tests use `config.settings.test` (PostgreSQL via `DATABASE_URL`, in-memory cache); with no environment at all it falls back to local defaults, which is what lets the mypy plugin run in pre-commit. `pre-commit run --all-files` from the repo root runs ruff and mypy too (run `uv sync` in `backend/` once first: mypy needs Django installed).

## Settings and environment

All variables are documented in [`.env.example`](.env.example). Settings are chosen only by a real `DJANGO_SETTINGS_MODULE` environment variable or `--settings`, never by `.env`. Required everywhere: `DATABASE_URL`, `REDIS_URL`; `DJANGO_SECRET_KEY` in dev and prod (tests use a fixed key). Production also requires `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS`; `manage.py check --deploy` is clean with `config.settings.prod`.

Authentication, token and email settings are described in [Authentication](#authentication-4). Defaults (all env-configurable): page size 50 (max 200 via `?page_size=`), cursor page 100, throttles 60/min anonymous and 600/min per user (`DRF_NUM_PROXIES`=0: `X-Forwarded-For` is ignored), schema endpoint public only in dev.

## Organizations and the first admin

Create an organization with its default profiles (`courier`, `supervisor`, `entomologist`, `community_promoter`, `admin`) and an admin user:

```bash
uv run python manage.py bootstrap_organization --name "Acme" --slug acme \
  --country MX --timezone America/Mexico_City \
  --admin-username boss --admin-email boss@example.com
uv run python manage.py changepassword boss     # a new admin is created without a password
# An existing username with a different email is refused unless you pass --reuse-existing-user
```

Profiles are data configured per organization. They start with no permission codes, except `admin`, which gets the codes of the device and session administration (see Authentication).

## Authentication (#4)

Contract: [`docs/api-conventions.md`](../docs/api-conventions.md) (rows "Auth endpoints", "Tokens", "Devices and revocation", "Error codes", "Login protection"). Decisions 36 to 49 in [`docs/decisions.md`](../docs/decisions.md).

- **Mobile**: `POST /auth/login/` with `device_id` returns opaque `access` and `refresh` tokens; send `Authorization: Bearer <access>`. Tokens exist only in the response: the database keeps SHA-256 digests (`DeviceSession.access_hash`, `refresh_hash`). Never log or store a plaintext token, password or email.
- **Web**: `POST /auth/login/` without `device_id` sets the Django session cookie. Call `GET /auth/csrf/` first and send the cookie value as `X-CSRFToken` on every unsafe request, login included. Same origin is assumed [ASSUMPTION].
- **Organization**: a token session is pinned to the organization it was issued for; `OrgScopedViewSetMixin` and `/me/` take it from `request.auth` (`accounts.selectors.requested_organization_slug`).
- **Throttles** live in `accounts/throttling.py` and key on DRF's `get_ident`: set `DRF_NUM_PROXIES` to the real number of proxies in front of the API (0 ignores `X-Forwarded-For`). The login lockout is in `accounts/login_attempts.py` (cache counters: it needs Redis in dev and prod).
- **Auth log**: logger `accounts.auth` (`event=login_failed ip=... username_fp=...`). `username_fp` is a keyed HMAC; there is no model until W60.
- **Password reset**: the request endpoint only enqueues the Celery task `accounts.tasks.send_password_reset_email`; run the `worker` service to get emails. In dev `EMAIL_URL=consolemail://` prints the message (with the link) in the worker log. Texts: `accounts/templates/accounts/email/` (es-MX, en).
- **Admin permission codes**: new organizations get `device.read`, `device.revoke` and `user.revoke_device_sessions` on their `admin` profile. For organizations created earlier run `python manage.py grant_admin_permissions [--organization slug]` once: it adds the codes that are missing, so it would also give back a code an administrator removed on purpose. Do not run it on every deploy; seed tracking with revocable defaults arrives with #3, and these codes (`accounts/permissions.py`) get registered there.
- **Web sessions** are stored in the database: schedule `python manage.py clearsessions` (daily) when the deployment exists (#18).
- **Final upload (for #5)**: only when an administrator revokes with `allow_final_upload: true`. A view that accepts it is declared `class SyncView(FinalUploadMixin, APIView)` (`accounts/final_upload.py`): the mixin opts the view in for `final_upload_methods` (default `POST`; `OPTIONS`/`GET` never spend it), opens one transaction after authentication, spends the single final upload first (a failed request gives it back), adds `X-Session-Revoked: true` and sets `self.is_final_upload`, which the view must use to mark the events it records as `in_review`. Nothing else to remember. `tests/testapp/views.py::FinalUploadView` is the reference.
- **Lock order**: User, Device, DeviceSession, TokenPair everywhere ([`accounts/README.md`](accounts/README.md)).
- **Transactions**: revocation and rotation commit before they raise, so they must not run inside an outer `atomic()`; `ATOMIC_REQUESTS` stays off (a test checks it).
- **Token rows**: every refresh adds a `TokenPair` (hashes only); rows are never deleted, so the table grows with use [PENDING retention policy].
- **Production proxy**: `DRF_NUM_PROXIES` is required (the app fails at startup without it). The TLS proxy in front must overwrite `X-Forwarded-For` (never append to what the client sent) and the app servers must not be reachable except through it (#18). `WEB_BASE_URL` must be https.
- A refresh response lost outside the 60 s grace window drops the session: the courier must log in again (needs signal and password).

| Variable | Default | Meaning |
| --- | --- | --- |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | `900` | Access token lifetime |
| `AUTH_REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token idle lifetime (slides on every refresh) [PENDING absolute maximum] |
| `AUTH_REFRESH_REUSE_GRACE_SECONDS` | `60` | A consumed refresh token presented again inside this window (and before any later token was used) is accepted once more; otherwise the session is revoked |
| `AUTH_REVOKED_FINAL_UPLOAD_HOURS` | `72` | Final upload window after an admin revoke that allows it; `0` disables it [PENDING client] |
| `AUTH_PASSWORD_RESET_EMAILS_PER_ADDRESS_PER_HOUR` | `3` | Reset emails sent to one address per hour (anyone who knows the address can use the quota: trade-off in decision 46) |
| `DRF_NUM_PROXIES` | `0` (**required in prod**) | Trusted reverse proxies in front of the API |
| `AUTH_LOGIN_MAX_FAILURES` / `AUTH_LOGIN_LOCKOUT_MINUTES` | `5` / `15` | Lockout of a username + address pair [PENDING client] |
| `AUTH_WEB_SESSION_AGE_SECONDS` | `43200` | Web session cookie age (12 h) [PENDING] |
| `PASSWORD_RESET_TIMEOUT` | `3600` | Reset link lifetime in seconds |
| `THROTTLE_LOGIN_USER_IP_RATE`, `THROTTLE_LOGIN_IP_RATE`, `THROTTLE_REFRESH_RATE`, `THROTTLE_PASSWORD_RESET_RATE`, `THROTTLE_PASSWORD_RESET_CONFIRM_RATE` | `10/min`, `30/min`, `30/min`, `5/hour`, `20/hour` | DRF throttle rates |
| `EMAIL_URL` | `consolemail://` (required in prod) | django-environ email URL, e.g. `smtp://user:pass@host:587` [PENDING provider] |
| `DEFAULT_FROM_EMAIL`, `WEB_BASE_URL` | local defaults (required in prod) | Sender and web origin used to build the reset link |
| `WEB_PASSWORD_RESET_PATH` | `/reset-password` | Web route that receives `/{uid}/{token}` [ASSUMPTION: agree with W1] |

## Dependencies (verified on PyPI, 2026-11-03)

| Package | Pinned range | Why |
| --- | --- | --- |
| Django | `>=5.2.19,<5.3` | Current LTS (5.2; 6.2 LTS is planned for 2027-04) |
| djangorestframework | `>=3.18.3,<3.19` | API |
| drf-spectacular | `>=0.30.0,<0.31` | OpenAPI schema (#12 builds on it) |
| django-environ | `>=0.14.0,<0.15` | Env-based settings |
| psycopg[binary] | `>=3.3.7,<3.4` | PostgreSQL driver (binary build: no compiler needed) |
| celery | `>=5.6.3,<5.7` | Worker service of the standard stack |
| redis | `>=8.1.0,<8.2` | Cache (throttling) and Celery broker client |
| pytest, pytest-django, pytest-cov, factory-boy | see `pyproject.toml` | Tests |
| mypy, django-stubs, djangorestframework-stubs | see `pyproject.toml` | Type checking with the Django plugin |

## Lint, format and type-check

Tool config lives in [`pyproject.toml`](pyproject.toml) (ruff, mypy, pytest, coverage). CI is [`.github/workflows/backend.yml`](../.github/workflows/backend.yml): ruff, mypy, migrations check, tests with coverage, with a PostgreSQL service. OpenAPI validation and the generated-client check are in [`api-contract.yml`](../.github/workflows/api-contract.yml). Setup of pre-commit: see the root [`README.md`](../README.md#quality-tooling).

## Next

Deploy: #18. Sync API (uses the final-upload hook): #5.
