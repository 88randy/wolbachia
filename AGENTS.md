# AGENTS.md — wolbachia monorepo (for Codex)

This file only points to the project's sources of truth. Read them before you change anything; do not copy their rules here.

## Read first (always)

1. `CLAUDE.md`: project decisions, team workflow, web conventions, lessons learned. It applies to you too.
2. `docs/engineering-rules.md`: clean-code rules, enforced by the linters. §9 "Every test earns its CI time" is strict.
3. `docs/glossary.md` (one English name per domain term) and `docs/api-conventions.md`.
4. The issue you work on: `gh issue view <N>` (GitHub is the source of truth; `issues/NN-*.md` is a mirror).
5. The README of every folder you touch.

## Your role

The task prompt names your role. Read and follow its definition, then the shared protocol:
- `backend-dev` → `.claude/agents/backend-dev.md` (Django + DRF in `backend/`)
- `web-dev` → `.claude/agents/web-dev.md` (React in `web/`)
- `mobile-dev` → `.claude/agents/mobile-dev.md` (React Native in `mobile/` or `spikes/`)
- `qa` → `.claude/agents/qa.md`; `code-reviewer` → `.claude/agents/code-reviewer.md`; `security-reviewer` → `.claude/agents/security-reviewer.md`
- Every implementer: "Working protocol (all implementers)" in `.claude/agents/README.md`.

Skills named in those files are optional Claude plugins; ignore them and follow `docs/engineering-rules.md`. Exception: the project skills in `.claude/skills/` (`ui-ux-standards`, mandatory for any UI change; `dashboard-designer`, `chart-builder`, `business-analyst`) are plain Markdown; read the matching `SKILL.md` before UI, dashboard or chart work. Project rules prevail over them.

## Codex-specific notes

- **Speed rules (2026-11-09):** follow the risk-based review in `CLAUDE.md` (max 2 adversarial rounds on high-risk PRs, one review otherwise). Do NOT produce SHA freezes, manifests, evidence packets or long logs; the PR body (criterion → test) and CI are the evidence. Keep PRs small and independent.

- Work only inside the current worktree. One issue = one branch = one PR; do not touch files outside the issue's scope.
- Never use host port 5432 (another project's Postgres). Use the compose project and port the task prompt gives you.
- No secrets, `.env` files, keys or real personal data, ever.
- Never invent libraries, versions or APIs: verify them in official docs or mark **[ASSUMPTION]**.
- If the sandbox blocks something (network, Docker, writing `.git`, installing packages), do not work around it: finish the code and the tests you can run, and list exactly what you could not run.
- Do not push, open PRs or merge unless the task prompt says so. The orchestrator integrates.
- Final message: files changed, commands run and results, criterion → test map, assumptions, and what you could not verify. Write it in Mexican Spanish; code, commits and docs in English.
