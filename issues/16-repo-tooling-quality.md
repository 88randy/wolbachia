TITLE: [Repo] Phase 0: JS workspaces, linters, formatters, pre-commit, CI per folder, glossary and engineering rules
LABELS: repo,priority:high

## 1. Context
The monorepo has no tooling yet. The clean-code rules (naming, function size, layering, typing, error handling, tests) must be enforced by tools in pre-commit and CI, not only by review. Domain terms must have one English name across backend, mobile and web.

## 2. Goal
Any commit in any folder is linted, formatted and type-checked the same way locally and in CI, and every contributor (human or agent) reads the same written rules.

## 3. Scope / Out of scope
**In:**
- Root `package.json` with npm workspaces (`mobile`, `web`, `packages/*`); `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`).
- ESLint flat config: typescript-eslint strict type-checked, complexity limits (`complexity`, `max-depth` 2, `max-params` 3, `max-lines-per-function` 30), no `any`, React hooks rules, `no-restricted-imports` (no `mobile` ↔ `web` imports; network access only through `packages/api-client`), i18n literal-string rule, accessibility rules for web, inline-style and color-literal rules for React Native. Prettier.
- Python: ruff (lint + format; complexity, max args, no print, no blind except, no commented-out code, Django and security rule sets) and mypy strict for `**/services.py` and `**/selectors.py`, configured in `backend/pyproject.toml` (the backend project itself lands in #2).
- `pre-commit` config: ruff, mypy, eslint, prettier, commit message check, secret scan (gitleaks).
- Conventional Commits with scopes: backend, mobile, web, repo, tokens, i18n, api-client, docs.
- `.editorconfig`.
- GitHub Actions: one workflow per folder with `paths:` filters (backend, mobile, web, packages) plus a PR-title check.
- `docs/glossary.md` (Spanish domain term → English name used in code).
- `docs/engineering-rules.md` (clean-code rules) referenced from `CLAUDE.md`.
- `README.md` per folder (stub with purpose and commands).
- `.claude/agents/` project agents that point to `CLAUDE.md` and `docs/engineering-rules.md`.

**Out:** tokens and i18n packages (#17); Django project (#2); React Native and web apps (#6, #26).

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
- `npm run lint`, `npm run format:check`, `npm run typecheck` at the root.
- `pre-commit run --all-files` passes on a clean checkout.

## 6. Behavior
- A rule violation fails pre-commit and CI with the rule name.
- A workflow only runs when its folder (or a shared package it depends on) changes.
- Tool and plugin versions are the current stable releases, verified in their official docs when the PR is written; the PR lists each version and its source.

## 7. Edge cases & errors
- Windows contributors: hooks must run in Git Bash and PowerShell; line endings are LF (`.gitattributes`, from #15).
- A folder with no code yet: its lint job succeeds with nothing to check instead of failing.
- Generated code (`packages/api-client`) is excluded from lint rules that do not apply to it.

## 8. Acceptance criteria
- [ ] `pre-commit run --all-files` passes.
- [ ] CI runs on a PR that touches each folder, and skips folders not touched.
- [ ] A sample violation (function with 4 parameters, `any`, `except: pass`) fails locally and in CI (shown in the PR).
- [ ] `docs/glossary.md` and `docs/engineering-rules.md` exist and `CLAUDE.md` links them.
- [ ] Every new dependency is justified in the PR (why, alternative, maintenance).

## Notes
Package manager: npm workspaces (ships with Node, avoids pnpm symlink issues with Metro). Decided in the plan of 2026-11-03.
