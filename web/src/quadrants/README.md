# Quadrants and geography (W22-W24, #157)

Routes: `/quadrants` (W22) and `/quadrants/<code>/versions` (W23).
W24 is the blocks/points/history section inside the same record, selected with
flat `view=history|blocks|points`. List filters/order/page belong to the URL;
dialog history uses `history_page`, independently of the list page. Codes resolve
with scoped `?code=`; all detail writes use resolved UUIDs.

## Boundaries

- `geography-query.ts` centralizes generated api-client reads. All query keys use
  `orgScopedQueryOptions`, `useSessionIdentity` and the current explicit scope.
  Scope-only changes cancel/remove obsolete geography contexts; unknown and
  foreign codes have the same not-found state.
- `use-geography-write.ts` / `write-attempt.ts` send one guarded attempt. Neither
  effects, reauthentication nor Retry-After expiry replay writes. Cooldowns
  survive edits and refresh. No session mutator is called.
- `geometry.ts` validates closed, finite WGS84 rings and excluded-point decisions.
  Blank lines preserve holes; backend topology validation remains authoritative.
  All scoped point pages are loaded for publication validation, separately from
  visible server-paged tables. Unknown server blockers require explicit refresh.
- `use-polygon-draft-state.ts` keeps drafts in memory. A user/organization/code
  boundary owns retained input; a scope change retains only still-permitted
  input and clears inaccessible content. No draft goes to storage or the URL.
- `ProposalSnapshot` retains reviewed proposals as local drafts after the server
  subtracts accepted blocks. Four-point creation is sequential: successful codes
  lock immediately, partial failure stops, and explicit retry sends only remaining
  points. A lost POST response reserves its immutable code/location as uncertain.
  Only explicit reconciliation via scoped `?code=` can count it as saved, after
  verifying the exact block and active coordinates. Empty/mismatched reads keep
  the batch locked; absence cannot prove the original write did not commit.
  Delivery is classified before session handling: definitive HTTP rejection,
  committed, or unknown. A definitive 401 stays rejected even when session
  handling discards its response as stale; reauthentication permits only a manual
  retry of pending points. Unknown outcomes and discarded committed successes
  keep their reservation. An attempt that never left the client reserves nothing.
  Reconciliation never writes or automatically continues the batch.
  This is not a backend transaction.
- `MapPanel` imports `GeographyMap` lazily. MapLibre failure, missing WebGL or
  tiles leaves coordinate forms and shared tables usable. Drawing inserts before
  an existing ring closure; Undo removes only the last exterior vertex, preserving
  the closing coordinate and holes. Center outlines have patterns
  plus a legend. Tables/history expose coordinates without a map.
- Retirement uses the shared `VoidDialog` to capture a catalog reason as draft
  evidence. It is published through the quadrant's evidenced `remove` resolution,
  never an invented delete/void endpoint. Retired rows keep code, author and
  evidence from immutable quadrant history.

## Permissions and contract limits

`quadrant.read` plus explicit nonempty center/quadrant scope opens reads,
suggestions and history. `quadrant.publish` shows polygon/block controls;
creating a new quadrant additionally requires explicit quadrant `all`.
`sampling_point.create` shows point creation/relocation and move/remove choices.
The API rechecks paired action grants; aggregate /me projections are only UI hints.

Only B-11 fields are displayed. Design-only courier progress, risk, assignment,
center/responsible editing and future effective dates are not fabricated.
The API has no standalone point retirement or quadrant/block void endpoint.
Retirement evidence is part of quadrant publication history; authors are the
API's opaque user references until a permitted author-name projection exists.
There is no geography export operation in OpenAPI, so no export is offered.

## Acceptance-to-test map

| Criterion | Cheapest proof |
| --- | --- |
| R2: every excluded point resolved before publish | `w-15.test.tsx`; pure validation in `geometry.test.ts` |
| Block proposal, four fixed codes, partial/lost-response recovery, definitive 401 manual retry and spacing codes | `w-15-blocks.test.tsx` |
| Geometry/stale revision recovery, unknown blockers, Retry-After | `w-15.test.tsx`, `w-15-recovery.test.tsx` |
| History, keyboard map/form parity at 1280/1440, dialog focus return | `w-15-accessibility.test.tsx`, independent history paging in recovery tests |
| Explicit grants, denied/unknown/foreign deep links, scope clearing | `w-15-access.test.tsx`, router area-access tests |
| Retirement evidence without accidental publication; permitted geometry survives scope changes | `w-15-retention.test.tsx` |
| Retained draft and explicit retry after reauthentication, with unchanged or refreshed permitted scope | `w-15-session.test.tsx` |
| Bilingual light/dark axe checks | `w-15-accessibility.test.tsx` |
| Add then undo restores the exact exterior and holes | `drawing-controls.test.tsx` |
| Tile configuration and strict build CSP | `map-security.test.ts` |
| Real browser R2, focus/reflow at 320 and +30% text, including delayed compact resize notification (#232) | `web/e2e/w-15.spec.ts` |

jsdom checks behavior, not physical layout, rendered contrast or WebGL. Docker,
Playwright and real browser manual focus/contrast/visual checks remain separate
verification gates. GitHub issue lookup returned 401; the supplied issue/lead
decisions are the implementation specification, not evidence of live issue state.

The reauthentication regression holds point revalidation behind a deferred network
response. Publication stays disabled until it settles, and a permitted scope
refresh may replace the editor while retaining its draft. Assertions and the
manual retry therefore locate the current controls rather than retaining DOM
references across that refresh. Neither reauthentication nor revalidation sends
the refused publication again.

Quadrant list/code queries forward the explicit URL center before the active shell center; this only narrows backend grants. Blocks and points retain their quadrant constraint because their generated list contract has no center parameter.

## MapLibre 6 compatibility and attribution security (#225)

`maplibre-gl` is pinned to **6.4.1**, the first patched version in
[GHSA-jrc7-96c5-q579 / CVE-2026-85061](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579).
Upstream lists versions through 6.4.0 as affected by the attribution sanitizer
bypass. This is a dependency finding: exploitation of this application's current
configuration has **not** been established. `MapCanvas` keeps native
`attributionControl: false`; the application shows its linked copyright notice
and renders custom attribution as React text, never application HTML.

The [official v5-to-v6 guide](https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/)
and [6.0.0 release](https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.0.0)
were checked alongside the installed sources:

| Major-version change | Application integration |
| --- | --- |
| ESM only; no default export or CommonJS entry | Vite handles the ESM package; the maintained React adapter imports its module namespace. No CDN/script-tag build or `require()` is used. |
| Explicit worker URL for bundlers; worker imports a shared ESM file | `MapCanvas` imports `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` and supplies the adapter's public `workerUrl` prop. Vite emits a bundled same-origin worker asset, including shared dependencies; bare `?url` would leave the sibling chunk unresolved. The existing CSP stays unchanged. |
| WebGL2 required; `map.transform` removed and camera API changed | `useMapDisplay` checks WebGL2 availability before mounting. GPU/style errors still select the coordinate fallback. The adapter is upgraded rather than patched with an application shim. |
| Event classes/types, GeoJSON setData signature and stricter style typing | Existing click coordinates, GeoJSON layers, raster/style configuration and public adapter props remain the app boundary. Typecheck, production build and focused integration checks cover this wiring. |

`react-map-gl` is pinned to **8.1.3** (MIT). The old 8.0.4 implementation directly
read the removed `map.transform`; peer metadata alone would not prove support.
Upstream [8.1.2 explicitly adds MapLibre 6 support](https://github.com/visgl/react-map-gl/releases/tag/v8.1.2),
and [8.1.3 fixes an app-wide crash with undefined terrain properties](https://github.com/visgl/react-map-gl/releases/tag/v8.1.3),
relevant to this map without a terrain prop. Installed adapter sources use map
getters and `setTransformCameraUpdate` for v6. MapLibre remains BSD-3-Clause;
6.4.1 supports Node >=16.14.0, including this repository's Node 22.13.0.
No unrelated direct dependency is upgraded and no `npm audit fix` is used.

`map-integration.test.tsx` exercises our public adapter configuration, WebGL1-only
fallback, literal custom attribution and style-error recovery without losing the
coordinate-drawing draft. Its adapter/worker are mocked: it does **not** test the
library sanitizer or claim real WebGL rendering. `map-security.test.ts` retains
the provider/CSP checks; geometry, drawing-controls and W15 accessibility suites
cover existing coordinate and keyboard behavior. The production JS build proves
the real ESM adapter and bundled worker resolve, separately from CI's real-browser
map and runtime-image checks. Those browser/GPU/container checks remain required;
local jsdom, typecheck or build results cannot establish them.

`e2e/map-runtime.spec.ts` adds one production-renderer smoke (English/light) to
the existing browser and runtime-image jobs. It keeps the normal OSM raster build
configuration and unchanged CSP. Public `BrowserContext.route` intercepts the
already-allowed tile origin, including dedicated-worker requests, and fulfills
valid synthetic PNGs from memory. Unexpected external origins are recorded and
aborted; no provider tile is downloaded. A native Worker subclass only records
public message/error events while delegating construction/execution. The smoke
requires a same-origin emitted worker, actual worker replies, intercepted raster
requests and a real canvas click that changes the polygon draft. It also checks
the linked attribution. Missing WebGL2 is a failure, never a silent skip; no
speculative browser flags or runtime allowlist/CSP bypass are added. The fixture
answers the quadrant collection and immutable version-history endpoints with
their distinct response shapes. After an actual CI fixture failure, an authorized
focused local run passed on Windows/Chromium on 2026-11-06, including the native
worker and canvas-to-coordinate interaction. This does not qualify physical GPUs
or the Linux runtime image; the corrected smoke still must pass those CI jobs.

Issue #218 connects the inherited code search and code/created_at ordering to W24 block and
sampling-point lists through URL state. Map and publication-validation reads remain unfiltered.
Version histories use independent `history_*` URL state and the generated #224 revision/version,
current-author, inclusive/exclusive ISO datetime and point-retired facets plus public sorting.
Parent search/order/page never leak into history requests; closing a dialog retains parent state.
There is no history free-text search or raw UUID author picker. `history-filters.test.tsx`
checks actual typed requests for all three resources; `table-url-scope.test.ts` checks isolation
and safe positive numbers. The shared shell/table/switch/dialog patterns also apply here.

## Authoritative geography fixture readiness (#258)

A completed `/me/` refetch identifies the session; it does not imply that the
current scope's resource body has been accepted or its editor has rendered.
`web/src/test/geography-read-test-helpers.ts` shares the existing reauthentication controls
with retention coverage. Each held response belongs to one actual request,
context and epoch, and separates delivery/body consumption. Only one unconsumed,
non-aborted current request and one matching current-revision query qualify.
`consumeRead` awaits body consumption and an observable query-cache completion promise
inside `act`; normal asynchronous DOM queries follow outside that scope. The promise
checks the actual query success/idle and epoch without nesting `waitFor` inside `act`
or changing the React act-environment flag. Original publication/payload assertions remain.
Responses are fresh per request; completed or aborted reads cannot satisfy a
later visit to the same context. No global last-request lookup or session write.

Retention's existing journey now exercises two permitted scope transitions with
polygon and removal evidence, revokes access while an older lookup is pending,
settles that obsolete response without exposing content or writing, and restores
published geometry with no denied evidence after current reads finish. The two
reauthentication variants keep pending publication disabled and still require
exactly the original refused request plus one explicit manual retry with the same
payload. Test counts are unchanged. Access-list coverage already waits for its
new scoped DOM before releasing its obsolete read; block reauthentication keeps
its same-context controls and observes its operation-specific readiness. Neither
was changed without a demonstrated boundary violation.

The controlled RED proves a legitimate pending-body window after `/me/`; it does
not establish the cause of an earlier CI run. Diagnostic in-memory negative
controls disable the module transform cache and must fail at premature readiness,
lost retention and denied-draft resurrection boundaries. Production authentication,
authorization, geometry, query and dependency sources remain unchanged.

The conflict-refresh recovery journey uses the same controls with its actual record
revision3 and current validation-points request. It verifies that the conflict remains
while either body is pending, then consumes both accepted queries and checks current
DOM/evidence before one explicit publication with expected revision3 and exact geometry
and resolutions. A literal fake Response is cloned by the common fake API; no consumed-
response defect is claimed. The other recovery cases already await their relevant new
projection/operation/URL evidence and are unchanged without a demonstrated violation.

## Map editor (`/quadrants/editor`, W23 editor board)

`editor/` draws on the same MapLibre map with Terra Draw 1.39.0 and
`terra-draw-maplibre-gl-adapter` 1.5.0 (one instance per map, created on `onLoad`;
the memoized style keeps its layers). Four tools:

- Draw quadrant: polygon mode, corner undo, close on the first/last corner, then name,
  center, area (km2) and point count; saves with `POST /quadrants/`.
- Place sampling point: must fall inside a block; `POST /sampling-points/`.
- Place release point: must fall inside a quadrant; warns when no permit zone of that
  quadrant contains it; `POST /release-points/` (new minimal geography endpoint).
- Move or correct: select mode on the chosen quadrant, its sampling and release points.
  A changed shape publishes `POST /quadrants/{id}/versions/` with a decision and reason
  for every point left outside; moved points then use their own version endpoints.

Static layers show every quadrant (center = color + solid/dashed outline), blocks and
points, with a legend. Without WebGL the screen shows a notice; coordinates stay
editable from each quadrant record.
