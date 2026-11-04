# packages

Code shared by `mobile/` and `web/`. Each package is an npm workspace (`packages/*`).

| Package | Purpose | Spec |
| --- | --- | --- |
| `api-client` | Client and types generated from the backend OpenAPI schema. Never edited by hand; regenerated in the same PR as any API change. The only place allowed to use `fetch` or an HTTP library. | #12 |
| `tokens` | Design tokens (colors, type, spacing, radii) for React Native and CSS. | #17 |
| `i18n` | es-MX and en message catalogs with shared keys. | #17 |

> Status: stub. The packages land in the issues above.

## Rules

- Read [`docs/engineering-rules.md`](../docs/engineering-rules.md) first.
- Shared code goes here, never copied between `mobile/` and `web/`.
- Each package has its own `package.json` (name `@wolbachia/<name>`), a `tsconfig.json` extending `../../tsconfig.base.json`, and a short `README.md`.

## Lint, format and type-check

From the repo root (`npm ci` first):

```bash
npm run lint
npm run format:check
node scripts/typecheck.mjs packages
```
