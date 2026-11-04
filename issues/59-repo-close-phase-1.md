TITLE: [Docs] Phase 1 close: lessons learned, decisions and glossary
LABELS: repo

## 1. Context
Phase 1 is done:
- backend core: #2, #3, #4, #12, #5;
- web shell and auth: #26, #28;
- spikes: #1 code part, #27.
CLAUDE.md asks that each phase close with lessons learned, an up-to-date `docs/decisions.md` and `docs/glossary.md`, and proposed process adjustments. As at Phase 0 (#44).

## 2. Goal
The repository documentation reflects what Phase 1 taught us, so later issues and agents do not repeat the same mistakes.

## 3. Scope / Out of scope
**In:**
- "Lessons learned" in `CLAUDE.md`, a few lines each, in the existing style:
  - (concurrency) Codex adversarial review found real races in every risky PR (#2, #4, #5, #28). Fix them with structural rules instead of case-by-case patches:
    - a global lock order and try-lock returning 429 (#4, #5);
    - deferred FK checks inside the 429 mapping (#5);
    - a queue with per-request timeouts, where queued tasks only await signal-bound network calls (#28);
    - a session revision counter instead of clocks or booleans (#28).
  - (tests) Every race fix needs a deterministic regression test: deferred promises or barriers, never `setTimeout` waits. Unit tests with memory history missed a router wrapper that only e2e caught (#28).
  - (security) `Referrer-Policy: strict-origin-when-cross-origin` still leaks full paths same-origin. Tokens never go in URL paths (#28, #58).
  - (infra) Agents use only the project compose Postgres on its own port (55432–55435), never 5432, which belongs to another project.
  - (process) Project agents load only at session start. Reviewer agents resumed with SendMessage keep context and give faster confirmation rounds.
- `docs/decisions.md`: check that rows 62–82 are consistent and numbered without gaps. No content changes.
- `docs/glossary.md`: add the terms introduced in Phase 1 that are missing (e.g. review item, session revision, final upload, sibling pair), each with one English name.
- Process adjustments proposed in the PR body, not applied:
  - run Codex adversarial review before the first code/security review on risky PRs, to catch races earlier;
  - set `build.target` / browserslist for web (a decision for the owner).

**Out:** code changes, new decisions.

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
N/A.

## 6. Behavior
Documentation only.

## 7. Edge cases & errors
- Glossary terms must match the names used in code. Grep before adding a term.

## 8. Acceptance criteria
- [ ] CLAUDE.md lessons added, concise, in the existing format.
- [ ] decisions.md numbering verified.
- [ ] Glossary updated with the terms used in code.
- [ ] `pre-commit run --all-files` passes.

## Notes
Precedent: #44 (Phase 0 close).

