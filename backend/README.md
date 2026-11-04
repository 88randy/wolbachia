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
| `accounts/` | Custom `User` (UUID pk). Auth flows arrive in #4 |
| `organizations/` | `Organization`, `Profile`, `Membership`; services, selectors, `GET /me/`, `bootstrap_organization` |
| `catalogs/` | `Catalog`, `CatalogItem`; item services, catalog snapshot, `/catalogs/...` and `/field/catalog/` (see its README) |
| `rules/` | `RuleParameter`, immutable `RuleParameterVersion`; value-in-force selectors, rules snapshot, `/rule-parameters/...` and `/field/rules/` (see its README) |
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

Defaults (all env-configurable): page size 50 (max 200 via `?page_size=`), cursor page 100, throttles 60/min anonymous and 600/min per user (`DRF_NUM_PROXIES`=0: `X-Forwarded-For` is ignored), schema endpoint public only in dev.

## Organizations and the first admin

Create an organization with its default profiles (`courier`, `supervisor`, `entomologist`, `community_promoter`, `admin`) and an admin user:

```bash
uv run python manage.py bootstrap_organization --name "Acme" --slug acme \
  --country MX --timezone America/Mexico_City \
  --admin-username boss --admin-email boss@example.com
uv run python manage.py changepassword boss     # a new admin is created without a password
# An existing username with a different email is refused unless you pass --reuse-existing-user
```

Profiles are data configured per organization. A new organization also gets the default catalogs, the rule parameters with the design brief's values and the catalog/rule permission codes (`admin`: all; the other profiles: `catalog.read` and `rule_parameter.read`). The seed is idempotent and additive (it never removes a code or edits an item). Bring an organization created earlier up to date with:

```bash
uv run python manage.py seed_organization_defaults --organization acme
```

The seeded values come from the design brief and must be validated with the program entomologist; parameters the brief gives no value for have no version (`value: null`, "not configured") until an admin sets one.

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

Deploy: #18. Auth flows: #4.
