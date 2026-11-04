# mobile

React Native (Android) app for the courier. Offline-first: the phone is the local source of truth and sends idempotent event batches to the backend.

> Status: stub. The app is bootstrapped in issue #6 (after the foundations spike, #1). There is no `package.json` yet.

## Rules

- Read [`docs/engineering-rules.md`](../docs/engineering-rules.md) and [`docs/glossary.md`](../docs/glossary.md) first.
- Before building a screen, read `design/mobile/README.md`, its PNG in `design/mobile/screens/` and its HTML in `design/mobile/source/`.
- No inline styles or color literals (use `packages/tokens`); no user-facing literals (use `packages/i18n`); API only through `packages/api-client`; never import from `web/`. All enforced by ESLint.
- The courier never counts eggs: only `paddle_present` and `has_eggs` (Yes/No).

## Lint, format and type-check

From the repo root (`npm ci` first):

```bash
npx eslint mobile
npx prettier --check mobile
node scripts/typecheck.mjs mobile
```

`mobile` is already listed in the root `package.json` workspaces; issue #6 adds its own `package.json` and `tsconfig.json` (extending `../tsconfig.base.json`).

## Next

Run, build and release instructions are added by issue #6.
