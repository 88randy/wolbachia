# Wolbachia

Traceability platform for the *Aedes aegypti* / Wolbachia control program (Mexico).
This monorepo holds the shared backend (Django + DRF), the field app (React Native, Android), the web app (React) and shared packages (`packages/`).

- Design (Claude Design canvas): "Wolbachia · App Repartidor" — Ronda 1.
- Workflow: spec-first. Every change starts as a GitHub Issue (9 sections) and lands through a PR linked to it.
- Specs: GitHub Issues are the source of truth; `issues/` mirrors them by number (see `issues/README.md`).
- Decisions: `docs/decisions.md`. API contract rules: `docs/api-conventions.md`.
- Engineering rules: `docs/engineering-rules.md`. Domain terms (Spanish to English names): `docs/glossary.md`.

## Quality tooling

Linters, formatters and type checks run the same way locally (pre-commit) and in CI (GitHub Actions, one workflow per folder).

One-time setup (needs [uv](https://docs.astral.sh/uv/) and Node 22+; works from Git Bash and PowerShell):

```bash
uv tool install pre-commit
npm ci
pre-commit install   # installs the pre-commit and commit-msg hooks
```

Root commands:

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (flat config in `eslint.config.mjs`) on all JS/TS |
| `npm run format` / `npm run format:check` | Prettier write / check (Markdown and `design/` are excluded) |
| `npm run typecheck` | `tsc --noEmit` in every workspace that has a `tsconfig.json` (`node scripts/typecheck.mjs <folder>` for one) |
| `npm run api:generate` | Validate/export OpenAPI and regenerate `packages/api-client`; fixed dev-only settings, no database or Redis needed |
| `pre-commit run --all-files` | Everything: hygiene, ruff, mypy, ESLint, Prettier, gitleaks |

Python lives in `backend/pyproject.toml` (ruff, mypy); see `backend/README.md`.

API generation disables `.env` reads and overrides caller settings with throwaway
schema-only values. Its loopback URL placeholders use PostgreSQL port 55432 and
Redis port 56379, matching the safe local convention; generation opens no database
or Redis connection. Commit both generated artifacts when the API changes.

Commit messages and PR titles follow Conventional Commits with scope `backend`, `mobile`, `web`, `repo`, `tokens`, `i18n`, `api-client` or `docs` (e.g. `feat(mobile): add login screen`).

Notes:

- `package.json` lists `mobile`, `web` and `packages/*` as workspaces. npm ignores a listed folder without a `package.json` (verified with npm 11), so nothing else is needed: when issue #6 or #26 adds `mobile/package.json` or `web/package.json` (plus a `tsconfig.json` extending `tsconfig.base.json`), the workspace is picked up automatically.
- Branch protection: workflows use `paths:` filters, so a skipped workflow never reports a status. Do not mark per-folder workflows as required checks; require `pr-title` and `gitleaks`, which always run.
- Dependency audit: `npm audit` reports a moderate `minimatch` advisory inside ESLint (dev-time only, no production code path), accepted for now. Re-check with `npm audit` when upgrading ESLint.
