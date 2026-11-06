# @wolbachia/api-client

The only way `mobile/` and `web/` talk to the backend. Types come from the backend OpenAPI schema (drf-spectacular); the runtime is a thin typed `fetch` wrapper. Issue: #12. Why this generator: [`docs/decisions.md`](../../docs/decisions.md).

Nothing in `src/generated/` and `openapi.yaml` is edited by hand.

#126 adds approve/reject relocation decisions, observational quadrant readiness,
atomic epoch closure and separate intervention.read/create routes. The single typed
CourierHistoryEntry is a discriminated union of its retained review/shift branch
and relocation_proposal, shared by changes/bootstrap. Task links refer to real
ScheduledTask identities/owners. DecisionEnum keeps its existing geography choices;
RelocationDecisionEnum is explicit. See ../../backend/geography/decisions/README.md
for temporal proof, immutable sources and verification boundaries.

#113 adds page-number review queue/detail, immutable accept/void/open-incident
decisions, optional source-bound safety disposition and CLOSED-shift approve/
observe. Source ingest/provenance remain separate from current decision state.
The single typed CourierHistoryEntry producer supplies actual review/whole-shift
history with current subject filtering before cursor/bootstrap; it is not a
delivery receipt or durable permission. Unknown-scope audit stays pending.
See ../../backend/reviews/README.md for exact effect/legacy/evidence boundaries.

#105 adds supply-types, locations/stock and lots/conditions. Resource ids remain
stable master/lot UUIDs; version is the exact immutable snapshot UUID. PATCH uses
expected_revision. Lot supply_version_id/protocol_id pins change explicitly;
quantity is initial custody input, never a writable balance. Both current local
reading slots are required. Unknown protocols/safety data remain nondispatchable.
No transfer, stock writer, label or courier assignment contract is fabricated.
See ../../backend/inventory/README.md for queries, codes and integration limits.

#270 adds paginated real movement provenance and action-scoped owner, placement
and protocol incident-type version choices. Lot reads retain exact supply/location
snapshots and admission identity; blocker/calendar-date facets execute server-side.
Use generated discriminated placement choices and their existing write-payload
mapping; no LotWrite quadrant_id, broad permission or transfer API is introduced.
Both artifacts are generated from backend source; never edit them manually.

#102 adds private upload authorization/renewal/finalization, raw authenticated PUT
and sanitized private downloads. The returned PUT url is relative; Upload-Lease
and authentication are both required. Download responses are binary, not JSON.
No mobile transport is implemented here (#246). See ../../backend/uploads/README.md
for optional client_id/context and the unbound staging/readiness distinction.

Removal resolution (#217) adds the typed POST /ovitrap-removals/{id}/resolve/
request (explicit expected_state, recovered_later|written_off, reason) and the
insert-only audit response. Physical history retains its original capture state
and adds the independent resolution. See docs/api-conventions.md for 404/409/429
and the future closure selector boundary. Both generated artifacts are regenerated
through api:generate; no new runtime client code is needed.

Configuration table query parameters (#224) come from the backend's explicit
allowlists, including rule facets/history status, catalog item availability,
device search/ordering and geography version-history filters. Use the generated
operation query types and [server contract](../../docs/api-conventions.md#configuration-table-queries-224);
clients keep search/sort/filter state in the URL and send it before paging.

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


## Organization configuration migration (#99)

The schema replaces /me/ scope arrays with explicit per-dimension mode/ids, adds
epi_week, label_phone and support_contact, and documents centers, organization
settings/logo, roles and memberships. API/web fixtures are migrated together.
This is a breaking scope contract: regenerate TypeScript before client builds.
`web/src/session/can.ts` checks only permission codes and does not consume scope.

The implementation environment has no installed node_modules executables and must not run npm ci.
OpenAPI can be exported and validated with an already installed Python runtime:

```bash
cd backend
python manage.py spectacular --validate --fail-on-warn --file ../packages/api-client/openapi.yaml
```

Set the documented schema-export settings/environment first (see the generator
script). Type generation still requires the locked openapi-typescript package
from package-lock.json; do not hand-edit src/generated/schema.ts. The orchestrator
must run npm run api:generate with installed dependencies and verify a second run
has no diff. The local Python runtime differs from the lock: Django 5.2.15, DRF
3.17.1, drf-spectacular 0.29.0. Re-export using locked dependencies before integration.

## Geography editor (#108)

OpenAPI now includes scoped quadrants, append-only polygon/point versions,
blocks/suggestions, excluded-point decisions, captured_at projections and spacing
warnings. All endpoints retain the shared session/CSRF or pinned bearer contract.
See docs/api-conventions.md and backend/geography/README.md. The schema is exported
from the locked Python runtime; the owner must run npm run api:generate to regenerate
src/generated/schema.ts and confirm a second run has no diff. Generated TypeScript
is intentionally never edited by hand.

## Ovitrap provenance (#111)

Schema adds scoped read-only ovitraps/readings/bags with capture and lifecycle
provenance, code/status/point/week filters, plus optional/nullable GPS accuracy
in sync envelopes. Regenerate using api:generate; never edit generated types.


#111 local status: OpenAPI validation/export passed with Django 5.2.19. The wrapper
api:generate failed on sandbox-denied uv interpreter-cache persistence; no cache
relocation or permission change was attempted. openapi-typescript is not installed;
the no-install command attempted package resolution and was cancelled. schema.ts
remains stale and untouched; the orchestrator must regenerate with locked tools.

## Offline bundle contract (#110 / B-13)

OpenAPI adds bearer-only /field/bootstrap/, a registered-schema hash boundary,
scope-bound cursor v2 and six typed change arrays plus next_change_at. The live
device grant is field.bootstrap. V1/expired/scope-changed cursors require bootstrap
recovery while keeping drafts and pending outbox events separate from projections.
See docs/sync.md. Absent dependency producer payloads remain open object arrays;
future producer PRs must publish their concrete schema.

The locked local Python runtime exported/validated openapi.yaml for this delivery.
`npm run api:generate` was blocked by uv trying to persist its interpreter cache
outside the sandbox. No local openapi-typescript executable is installed; no
package was installed and generated TypeScript was not hand-edited. Integration
must run the complete generation command and verify a second run produces no
diff, as required by .github/workflows/api-contract.yml.


## Lifecycle projections (#112)

The schema includes relocation.read proposal listing and ovitrap.read physical
history, retirement/suggestion fields, abandoned/removed incident markers and the
additive optional courier is_retired field. Event payloads/results remain documented
in docs/sync.md. Regenerate both artifacts with api:generate; do not edit them.
