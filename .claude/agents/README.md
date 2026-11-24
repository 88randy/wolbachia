# Project agents

Subagents for this repo, one responsibility each: `planner`, `backend-dev`, `mobile-dev`, `web-dev`, `qa`, `code-reviewer`, `security-reviewer`, `docs-writer`. Each one starts by reading `CLAUDE.md`, `docs/engineering-rules.md`, `docs/glossary.md` and the issue it works on.

## Required skills by area (owner decision, 2026-11-24)

Before writing or reviewing code, invoke with the `Skill` tool every skill of the areas your task touches, and apply it. Name the skills you used in your report. Project rules (`CLAUDE.md`, `docs/engineering-rules.md`, this README) prevail when a skill disagrees; say so in the report.

| Area | Skills |
| --- | --- |
| Every code task (write, fix, refactor, review) | `ponytail` (smallest change that fully solves the task; no speculative abstractions) |
| Django / DRF / Celery (`backend/`) | `django-expert`, `anthropic-skills:django-reviewer` (reviews), `anthropic-skills:django-safe-migration` (any migration), `anthropic-skills:django-celery-expert` (Celery tasks) |
| React web (`web/`) | `vercel-react-best-practices`, `vercel-composition-patterns`, `modern-web-guidance:modern-web-guidance` (HTML, CSS, browser JS, a11y, forms, dialogs, tables, performance), `web-design-guidelines` (UI review), `vercel-react-view-transitions` (screen transitions only) |
| React Native (`mobile/`) | `vercel-react-native-skills`, `vercel-composition-patterns` |
| Any user-facing UI (web or mobile) | `ui-ux-standards` (project skill, mandatory) |

These skills are installed on the maintainers' machines, not in this repo. If one is missing, continue without it and say which one in the report.

## Other optional skills

Some agents also mention skills from personal plugins that are **not part of this repo**:

| Plugin | Skills used |
| --- | --- |
| `ecc` | `api-design`, `django-patterns`, `django-tdd`, `django-security`, `security-review`, `react-patterns`, `react-native-patterns`, `react-testing`, `frontend-a11y`, `python-testing`, `coding-standards`, `architecture-decision-records` |
| `superpowers` | `writing-plans`, `verification-before-completion` |
| `anthropic-skills` | `django-safe-migration` |
| personal skill | `django-expert` |

**Agents must work without them.** If a skill is missing, skip it and follow `docs/engineering-rules.md`; the rules there are the source of truth, the skills are only helpers.

## Working protocol (all implementers)

- Start from an up-to-date `origin/master` in your own worktree and branch. Merge master (never rebase or force-push) when the PR needs it.
- Backend tests run on your own compose project (`-p wolbachia-<issue>`) and a free host port from 55432 upward. Never 5432: it belongs to another project. Finish with `down -v`.
- Verify every library, API and tool version in its official docs and cite the URL in the PR. If you cannot verify it, mark it **[ASSUMPTION]**; never guess.
- Tests follow `docs/engineering-rules.md` §9 "Every test earns its CI time": each test protects a criterion, an edge case, a bug or an invariant, once, at the cheapest layer. Deterministic waits only.
- Concurrency and session logic: write down the rule that makes the race impossible (lock order, single queue, revision counter, DB constraint) before patching cases, and test it with a barrier or a deferred promise.
- New rows in `docs/decisions.md` take the next free number on master; renumber when you merge master.
- Run `pre-commit run --all-files` before pushing; never `pre-commit install`.
- PR body: summary, criterion → test map (per `docs/engineering-rules.md` §9), assumptions, verified vs not verified, deviations from the design, new dependencies justified, review board (task · agent · status). End with the Claude Code line.
- Report back: PR URL, commands run and their results, and what you could not verify.
