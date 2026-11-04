# @wolbachia/api-client

The only way `mobile/` and `web/` talk to the backend. Types come from the backend OpenAPI schema (drf-spectacular); the runtime is a thin typed `fetch` wrapper. Issue: #12. Why this generator: [`docs/decisions.md`](../../docs/decisions.md).

Nothing in `src/generated/` and `openapi.yaml` is edited by hand.

## Use

```ts
import { createApiClient, unwrap } from "@wolbachia/api-client";

const client = createApiClient({
  baseUrl: "", // web: same origin as the API. Mobile: the API origin, e.g. "https://api.example.com"
  auth: { kind: "session", getCsrfToken: () => readCookie("csrftoken") }, // web
  // auth: { kind: "bearer", getAccessToken: () => tokenStore.access },   // mobile
  getOrganizationSlug: () => activeOrganizationSlug, // sent as X-Organization when set (an explicit header in a call wins)
});

const me = unwrap(await client.GET("/api/v1/me/")); // typed `Schemas["Me"]`, throws ApiError
const result = await client.GET("/api/v1/me/"); // or handle it yourself:
if (result.error) result.error.code; // typed ErrorEnvelope: translate `code` with @wolbachia/i18n
```

- Calls are `client.GET | POST | PUT | PATCH | DELETE(path, { params, body })`; path, params, body and response are checked against the schema. There are no hand-written per-endpoint functions and no React hooks: web wraps calls in `queryOptions` (TanStack Query), mobile calls them directly (docs/adr/0001-web-stack.md).
- `auth.kind: "session"` uses same-origin cookies and sends `X-CSRFToken` on unsafe methods only; it assumes web and API share an origin (not decided yet, see ADR 0001 and #4; another origin needs CORS and cookie settings). `baseUrl` is the origin without `/api/v1`; use `""` for same origin. A header passed explicitly in a call (`params.header` or `headers`) takes precedence over `Authorization`, `X-CSRFToken` and `X-Organization` from the options. `auth.kind: "bearer"` sends `Authorization: Bearer <token>` and no cookies.
- Every non-2xx response is typed as `ErrorEnvelope` (the `default` response of each operation). `unwrap(result)` returns `data` or throws `ApiError { status, code, envelope }` whenever the response is not `ok` (even with an empty body, where `result.error` is `undefined`); a body that is not an envelope (proxy page) gives `code: "unknown_error"`. Network failures are the `TypeError` that `fetch` throws.
- Token refresh is not here (issues #4 and #6). The hook point is `client.use(middleware)` from `openapi-fetch`.
- `fetch` can be injected (`options.fetch`) for tests.
- `paths`, `components`, `operations` and `Schemas` (`Schemas["Me"]`) are re-exported for typing screens and forms.

## Regenerate

Required in the same PR as any API change; CI (`.github/workflows/api-contract.yml`) fails if the committed files are stale.

```bash
cd backend && uv sync && cd ..   # once
npm ci                           # once
npm run api:generate
```

`scripts/generate-api-client.mjs` runs `manage.py spectacular --validate --fail-on-warn` with the dev settings (the test settings add test-only routes), writes `openapi.yaml`, then runs `openapi-typescript` to write `src/generated/schema.ts`. It needs no database or Redis. Running it twice must leave no diff.

Without `uv`, the same schema can be exported through Docker (then run only the second step by hand):

```bash
docker compose -f backend/compose.yaml run --rm --no-deps -T api \
  python manage.py spectacular --validate --fail-on-warn > packages/api-client/openapi.yaml
npm exec --workspace=packages/api-client -- openapi-typescript openapi.yaml --output src/generated/schema.ts
```

If a rebase conflicts in the generated files, never resolve them by hand: take either side, then run `npm run api:generate`.

## Tests

```bash
npm test --workspace=packages/api-client   # node --test: client behaviour with an injected fake fetch
node scripts/typecheck.mjs packages        # also checks the type-level tests (test/types.test.ts)
```

`openapi-typescript` declares a peer range of TypeScript `^5`, while the repo uses 6; npm therefore installs a private TypeScript 5 inside this workspace for the generator, which also pins the generated formatting. That is why the package has no `typecheck` script of its own: `npm run typecheck` in this folder would pick that private `tsc`. Use the root script.
