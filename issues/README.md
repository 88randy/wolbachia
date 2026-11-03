# issues/ — mirror of GitHub Issues

GitHub Issues are the source of truth for every spec (see `docs/decisions.md` #16).
Each file here mirrors one issue: `NN-<slug>.md`, where `NN` is the GitHub issue number.

- Line 1: `TITLE: <issue title>`. Line 2: `LABELS: <comma-separated labels>`. Then the body with the 9 sections from `.github/ISSUE_TEMPLATE/spec.md`.
- Edit the issue on GitHub first, then update the mirror in the same PR that changes it.
- Never re-create issues from these files: that would duplicate them.
