# backend

Django + DRF API shared by the mobile app and the web (single API under `/api/v1/`).

> Status: stub. Today this folder only holds the Python tooling config. The Django project lands in issue #2 (bootstrap); OpenAPI and the generated client in #12.

## Rules

- Read [`docs/engineering-rules.md`](../docs/engineering-rules.md) and [`docs/glossary.md`](../docs/glossary.md) first.
- Thin views and serializers; business logic in `services.py`, complex reads in `selectors.py` (both type-checked strictly by mypy).
- API contract: [`docs/api-conventions.md`](../docs/api-conventions.md). If the API changes, update `docs/` and regenerate `packages/api-client` in the same PR.

## Lint, format and type-check

Tool config lives in [`pyproject.toml`](pyproject.toml) (ruff, mypy). From the repo root:

```bash
uvx ruff@0.17.3 check --config backend/pyproject.toml backend
uvx ruff@0.17.3 format --check --config backend/pyproject.toml backend
pre-commit run --all-files   # everything, including mypy on services.py / selectors.py
```

The versions mirror `.pre-commit-config.yaml`. Setup of pre-commit: see the root [`README.md`](../README.md#quality-tooling).

## Next

Run, test and deploy instructions are added by issues #2 and #18.
