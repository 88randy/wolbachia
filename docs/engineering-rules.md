# Engineering rules

The clean-code reference for everyone who writes code in this repo, human or agent. Read it before you start; reviewers check against it. Rules marked **(tool)** are enforced by ESLint, ruff or mypy in pre-commit and CI; the rest are enforced in review. Domain names come from [`docs/glossary.md`](glossary.md).

## 1. Language

- All code, names, routes, DB fields, migrations, comments, logs, technical errors, tests, commits, branches, PRs, issues and technical docs are in **English**.
- Only user-facing text is localized, in `packages/i18n` (es-MX, en). Code holds keys only, e.g. `t("review.cta.save")`. **(tool: `i18next/no-literal-string` on JSX text)**
- One English name per domain term across backend, mobile and web: the glossary.

## 2. Naming

- Names reveal intent. No `data`, `info`, `tmp`, `x`, `obj2`.
- Booleans start with `is`, `has`, `can` or `should`. Functions are verbs. Classes and components are nouns.
- Python: `snake_case` functions and variables, `PascalCase` classes. TypeScript: `camelCase`, `PascalCase` for components and types. Constants: `UPPER_SNAKE_CASE`. **(tool: ruff `N`)**
- File names: components `PascalCase.tsx`; other TypeScript files `kebab-case.ts`; Python files `snake_case.py`.

## 3. Functions and modules

- A function does one thing. Target under 30 lines, at most 3 parameters (more: pass a named object or dataclass), at most 2 nesting levels, complexity at most 10. Use guard clauses. **(tool: `max-lines-per-function` 30, `max-params` 3, `max-depth` 2, `complexity` 10; ruff `PLR0913` 3, `C901` 10)**
- No hidden side effects: a function that writes says so in its name or docstring. Never mutate parameters; prefer immutable data.
- One responsibility per module or class. Composition over inheritance.
- No magic numbers or strings: use named constants. Business thresholds (e.g. 50 m, 10 km/h) come from rule parameters, never hard-coded.

## 4. Backend (Django + DRF)

- Views and serializers are thin: validate and delegate.
- Business logic lives in `services.py` of each app. Complex reads live in `selectors.py`. Both are type-checked strictly. **(tool: mypy strict)**
- Models do not call external services. Celery tasks only orchestrate services.
- Serializer fields that point to an org-scoped model use `core.fields.OrgScopedPrimaryKeyRelatedField`, never a plain `PrimaryKeyRelatedField`; viewsets declare `required_permissions` per action (default is deny).
- Use explicit transactions when a use case writes more than one table.
- ORM or parametrized queries only. Never build SQL or formulas by concatenation. **(tool: ruff `S`)**
- Type hints on public functions and services. **(tool: ruff `ANN`)**

## 5. Mobile and web (React, React Native)

- Presentational components hold no business logic. Logic lives in hooks or domain modules.
- The API is reached only through `packages/api-client`. No `fetch`, `axios` or other HTTP clients elsewhere. **(tool: `no-restricted-imports`, `no-restricted-globals`)**
- One component per file.
- No inline styles and no color literals in mobile; colors, spacing and type come from `packages/tokens`. **(tool: `react-native/no-inline-styles`, `react-native/no-color-literals`)**
- `mobile/` and `web/` never import each other. Shared code goes to `packages/`. **(tool: `no-restricted-imports`)**
- Accessibility rules apply to the web (WCAG 2.2 AA). **(tool: `jsx-a11y`)**
- Hooks follow the Rules of Hooks and list every dependency. **(tool: `react-hooks`)**

## 6. Types and validation

- TypeScript is strict. No `any`: use `unknown` and narrow. **(tool: `@typescript-eslint/no-explicit-any`, `strictTypeChecked`)**
- Validate at the edges (serializers, forms, sync payloads). Inside the domain, trust validated data.

## 7. Errors and logs

- Never swallow exceptions (`except: pass`, empty `catch {}`): handle them, log with context, or propagate. **(tool: ruff `BLE`, `S110`, `E722`; ESLint `no-empty`)**
- Use named domain exceptions (e.g. `PermitExpiredError`), mapped to API responses as in [`docs/api-conventions.md`](api-conventions.md).
- Logs are structured and carry context (organization, user, device, event id). No personal data and no secrets in logs.
- User messages always go through i18n, are blameless and give a next step. The API returns codes, not text.

## 8. Comments and docs

- Code explains itself; comments say **why**, not what.
- Services, hooks and non-obvious public functions have a docstring or TSDoc.
- No commented-out code. **(tool: ruff `ERA`)**
- Layered docs: `CLAUDE.md` (common and per repo), a `README.md` per folder, ADRs in `docs/decisions.md`.

## 9. Tests

- Arrange / Act / Assert. Names describe behavior, e.g. `test_sync_ignores_duplicate_event_id`.
- One reason to fail per test. Factories over big fixtures. Test behavior, not implementation.
- Every bug fix ships with a regression test.

## 10. Simplicity

- KISS and YAGNI: the simplest solution that meets the issue. No speculative abstractions.
- No loose `TODO`: open an issue instead. No dead code, unused files or unused dependencies.
- Extract on the third repetition, not before.
- Every new dependency is justified in the PR: why, which alternative, and who maintains it.

## 11. Workflow

- Spec-first: no code without a GitHub Issue with the 9 sections. One PR per issue, linked with `Closes #N`.
- Commits and PR titles follow Conventional Commits with scope `backend`, `mobile`, `web`, `repo`, `tokens`, `i18n`, `api-client` or `docs`, e.g. `feat(mobile): add login screen`. **(tool: commit-msg hook and `pr-title` workflow)**
- Branches: `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/<issue>-<slug>`.
- If the API changes, update `docs/` and regenerate `packages/api-client` in the same PR.
