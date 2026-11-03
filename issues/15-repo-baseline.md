TITLE: [Repo] Baseline: version design exports and specs, align issues with GitHub
LABELS: repo,spec

## 1. Context
The design exports (`design/`), the web specs (`docs/web-*.md`, `docs/api-conventions.md`) and the web issues (20–38) existed only in one working copy. Local issue files had drifted from GitHub: the egg Yes/No design issue was never created, so local files 09–14 became GitHub #8–#13, and several bodies on GitHub were outdated. Agents work in git worktrees cut from `master`, so anything not committed is invisible to them.

## 2. Goal
`master` holds every spec and design file, and every local issue file matches its GitHub issue one to one.

## 3. Scope / Out of scope
**In:**
- Commit `design/`, `docs/`, `issues/` and the updated `web/README.md`.
- Rename `issues/NN-*.md` so `NN` is the GitHub number; create the missing issues (#14–#38); update the bodies and titles of #1–#13.
- Resolve the conventions approved on 2026-11-03 (web auth, paging, error envelope, objects by code, profiles as data, term *egg paddle*) in `docs/api-conventions.md`, `docs/decisions.md` and the affected issues.
- Fix cross-references (old local numbers, `/api/` paths without `/v1/`, "egg paper" vs "egg paddle", user-facing text returned by the API).
- Merge `docs/claude-md-web-section.md` into `CLAUDE.md`.
- Correct the token comparison in `docs/web-tokens-diff.md` and `design/web/README.md` against `design/mobile/source/codequim.css`.
- Fix `.gitignore` (broken last line) and add `.gitattributes` (LF line endings).
- Remove `scripts/create_issues.*` (re-running them would duplicate every issue).

**Out:** tooling and CI (#16), tokens and i18n packages (#17), any application code.

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
Documentation only: `docs/api-conventions.md` moves paging, errors, objects by code and web auth to Accepted.

## 6. Behavior
GitHub Issues are the source of truth. `issues/NN-*.md` is a read-only mirror; edits go to GitHub first.

## 7. Edge cases & errors
- Creating issues in a different order would shift numbers: create them sequentially and abort on the first mismatch.
- Line-ending normalization must not touch PNG files (`.gitattributes` marks images as binary).

## 8. Acceptance criteria
- [ ] Every `issues/NN-*.md` has the 9 sections and matches GitHub issue #NN (title and body).
- [ ] No reference to the old local numbering remains.
- [ ] One term for *papeleta* (egg paddle) across docs and issues.
- [ ] `docs/api-conventions.md` has no [PENDING] for paging, errors, objects by code or web auth.
- [ ] `.gitignore` ignores `*.apk` and `coverage/`.

## Notes
Plan approved by the project owner on 2026-11-03.
