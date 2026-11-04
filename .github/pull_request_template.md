Closes #

## What changed

<!-- One short paragraph or a few bullets. Differences from the issue (spec) go here too. -->

## How it was verified

<!-- Commands run and results: tests, lint, type-check, manual checks. -->

## Checklist

- [ ] One issue, one PR; the title follows Conventional Commits (`feat(backend): ...`).
- [ ] No secrets, no `.env`, no client data.
- [ ] If the API changed: `docs/` updated and `npm run api:generate` output committed (CI checks it).
- [ ] **API breaking change?** Tick if an existing client would break: removed or renamed path, field or parameter, a field that becomes required, a narrower type. Explain the migration below.

<!-- Migration for the breaking change (mobile apps in the field update later than the server): -->
