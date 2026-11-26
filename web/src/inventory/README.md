# Inventory workspace (W8–W11, #151)

The workspace consumes the canonical #105/#270 generated contract through
`packages/api-client`. It composes the existing #202 UI, DataTable, FilterBar,
FolderTabs, dialogs and tokens. It adds no shared widget, backend writer or grant.

## Routes and ownership

| Route                                          | Screen / action                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `/inventory`                                   | Entry links permitted by the accepted session                    |
| `/inventory/supplies[/:code]`                  | W8 catalog, named attributes/protocol, create/update/deactivate  |
| `/inventory/lots`                              | W9 server-filtered lots, expiry and blocker facets               |
| `/inventory/lots/new`, `/inventory/lots/:code` | W10 incomplete draft, completion, exact retained pins and status |
| `/inventory/locations[/:code]`                 | W11 geometry, responsible Membership, stock and signed ledger    |

Codes are human navigation identities. The client resolves relation codes to
authorized master UUIDs before API filtering; it never substitutes a User UUID for
a Membership or asks the operator to type an owner UUID. `inventory-query.ts`
owns the scoped data adapters, `inventory-options.ts` the closed action modes,
and `inventory-write.ts` the generated write calls.

All five tables expose the public server ordering in both directions: supplies and
locations code/created_at; lots code/created_at/expiry; stock lot__code/piece_id;
movements created_at/lot_code/quantity. Only Supply has an activity segment, with
All omitting is_active and retaining the existing API default. Location has no activity
facet; no lot, stock or ledger activity/void filter is invented.

All list ordering, filtering, counts and pagination belong to the server. URL
filters include organization-local expiry calendar boundaries and explicit
zone-bearing instants as separate controls. A record/back link retains its list
search. An explicit URL center precedes the shell center. Changing the accepted
session, organization, paired scope or center cancels obsolete observers; an ABA
transition cannot publish an earlier response.

## Read, write and recovery boundaries

Catalog masters are organization scoped. Supply attributes and protocol values
have no scientific defaults: nullable safety remains unconfigured and absent
windows remain absent. Unknown protocol arrays are narrowed before rendering and
guarded again at the writer boundary after conflict review. Explicit protocol-only
discard retains other input and causes the next ordinary PATCH to omit protocol.
Deactivation confirms its opened revision and appends through
the real endpoint and preserves existing lots and versions; there is no invented
reactivation or void action.

Lot completeness and safety are returned facts. Saving an incomplete lot creates
a draft without stock. Admission locks original quantity/location. The lot's
nullable `protocol_id` is authoritative even when its exact SupplyTypeVersion
contains a configured protocol. Ordinary edits retain that pin. Explicit adoption
pins the displayed supply version and exactly its protocol when the confirmation
opens, including an explicit null. A background catalog refresh cannot replace
that reviewed pair; its readable version/name remain visible for the next save.
`LotWrite` has no quadrant override: location selection derives
the immutable center/quadrant pair on the server.

For create, placement options use the exact create action and real center;
location owners use the selected pair. Updates pass only the saved lot or location
identity to the action-specific lookup. The update gate obtains a fresh successful
action read before restoring a retained editor. New lot/location drafts also wait
outside the DOM for current target authorization: owner-options validates the
location's selected pair, and placement-options must contain the lot's exact real
Location or explicit center-only choice. Retained Location codes narrow search;
matching may traverse pages, keeping only one response page at a time. Absence
from page one is not denial. Unplaced/unverifiable drafts restart blank. A fresh
denied record/action retires that record's draft. A create action revoked in a
settled session retires only its new draft; transient reauthentication preserves
authorized capture. Drafts and failures live only in user/organization memory and
never in storage or the URL.

A 409 preserves input and the reviewed revision until explicit review; it never
resubmits. Before awaiting a write, the form clones its exact typed command and
original context. An uncertain delivery freezes the form until an explicit scoped
read matches the actual sent facts, saved identity and original CAS revision.
Later changes to unsent fields do not prevent confirmation; current returned facts
then replace the form. Numeric coordinate
representations compare with the same finite Number conversion as the writer;
different coordinates cannot confirm. Decimal quantities and protocol values use
exact string normalization, including leading zeros and signed zero. Whitespace
coordinates fail before conversion. Retry-After only unlocks another manual
attempt. Reauthentication and context changes never replay a write. A confirmed
reconciliation refreshes the affected lists; conflicting current server facts
remain visible beside the preserved input until explicit review.

Stock aggregates and movement legs remain distinct. Physical quantity links
filter the real ledger by lot, piece (including `none`) and unit. Operation links
use operation UUIDs; admission/source UUIDs are separate provenance. Signed
decimal quantities preserve their precision. No balance edits, operation-detail
GET, export or QR format is invented. “View dispatch requirements” is a local
explanation of server blockers and the custody boundary; #106/#107 actions remain
outside this workspace.

The MapLibre renderer receives exactly the table's accepted page and uses the
existing v6 worker and map-source policy. No map-wide fetch or client-side safety
filter is added. Invalid geometry, WebGL absence, renderer failure or an invalid
source leaves the table, coordinates and attribution available.

Supply and Location creation modals use the shared secondary Cancel/primary submit
footer. Cancel closes without writing and preserves the existing private draft memory.
Busy/current-read/unknown-delivery gates remain owned by the form; inline editors and
the full-page lot draft retain their existing submit layout. Inventory breadcrumbs
translate real route ancestors and new-lot while preserving literal record codes.

List actions sit below headings and the feature's filter/grid wrappers allow
controls to wrap at 320 px and increased text size. Shared widgets and tokens are
unchanged. Stock/ledger table filters use the existing controller builders;
parent `view`/`center` URL metadata survives clear-filter and tab actions.

## Explicit custody reads (#293)

The existing URLs accept a private `custody_location=<canonical UUID>` read
context for lots and location navigation. Absence retains admission behavior;
present blank, malformed or unsupported context renders an invalid-context state
before target requests or editor hydration. It never falls back to admission or
derives a location from a center/grant. This metadata is not write authority.

Lot code lookup and UUID detail use that same explicit location. Contextual code
lookup omits the implicit admission-center facet; an explicitly selected list
center still filters original admission and survives record/back navigation.
Read keys and request acceptance include the private view entry as well as
session/organization/authorization. The central session helper owns placeholder
reuse. List and record observers remount per private view entry, including their
stock/ledger children. Same-center B1/B2/B1 gets a fresh read; even an obsolete
rejected response cannot become current data.
The list/detail consumer must own its exact current route before a query or action
gate can start, including the transient old outlet during navigation. Manual
reconciliation is a separate inventory-only read purpose: it checks the original
immutable command code from its still-current admission form, including create
screens whose URL does not yet contain that code. It does not grant a display
route bypass, write, current B lookup or automatic replay.

A stable inventory-only provider encloses the existing home and W8–W11 URLs,
without adding a public route or global store. Private admission drafts and exact
uncertain commands survive readonly/unavailable custody views. B never mounts an
editor, action lookup or reconciliation form. Returning to A waits for its fresh
original action gate; genuine current action/identity/organization loss still
retires the proper draft. Known write replies may update only the same retained
attempt under the original session. They cannot clear another/newer attempt or
show stale success/error UI. There is no automatic replay.

Returned safety_location_id must match the selected custody location. Initial
quantity and original location/protocol pins are identified as admission facts,
not B stock; B does not link that quantity to original A. Current balances come
only from the existing authorized location stock read. Null protocol stays null.

Ledger cells distinguish movement, operation, source kind/source UUID and optional
transfer id/code/event_id. Four actual source kinds have localized labels; unknown
future kinds have generic source copy. Null transfer metadata is valid redaction,
causes no extra fetch and has no invented detail link. The existing discrepancy
hold is translated without inventing a resolution action.

After the actual #292 merge, the movements' human-code control sends exact
`lot_code` directly to the real location ledger, including at zero current stock.
It performs no current-lot resolution. Existing row-linked `lot` UUID and
operation/piece/unit/time filters retain their meanings and intersect; the UUID
facet is not an editable code control. Tabs and clear-filter actions retain
custody metadata. No transfer/condition writer or #152/#154 screen is added.

The four changed test owners are inventory-query, locations, inventory-session and
the existing browser inventory spec. The latter uses its existing extracted
`e2e/fixtures/inventory-mock.ts`, not a new harness or another accessibility matrix.
Browser/contrast/manual qualification is separate from local Node evidence.

## Verification ownership (§9)

| Criterion                                                                                                         | Cheapest owning proof                            |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Null/exact pins, unknown arrays, URL facets/order/page/back links, decimal precision                              | `inventory-query.test.ts`                        |
| Named catalog configuration, no invented nullable defaults, read-only action gate                                 | `supplies/supplies.test.tsx`                     |
| Draft completion, actual blockers, 409 preservation, explicit adoption, Retry-After                               | `lots/lots.test.tsx`                             |
| Closed placement/owner payload, whitespace rejection, exact ledger links, lost-response coordinate reconciliation | `locations/locations.test.tsx`                   |
| Same accepted map/list page and missing-WebGL fallback                                                            | `inventory-map.test.tsx`                         |
| ABA, current-read draft restoration/retirement, unknown/foreign deep links, reauth without replay                 | `inventory-session.test.tsx`                     |
| Router/client/CSRF/organization wiring and real MapLibre worker                                                   | One `e2e/inventory.spec.ts` journey              |
| 320 px, all web typography tokens +30%, both locales/themes, axe and keyboard focus/return                        | One four-combination matrix in that browser spec |

Backend authorization, SQL filtering before count/page and PostgreSQL parity are
owned by #270; frontend mocks do not implement or prove those policies.

From the repository root, run lint, format and typecheck normally. Focused web
tests run from `web` with
`node ../node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads --silent=false src/inventory src/router/area-access.test.ts`.
Inspect the unhidden console for React act warnings. Build with explicit public
`VITE_API_BASE_URL=/api/v1`; browser checks use
`npm.cmd run e2e --workspace=web -- inventory.spec.ts --workers=1`.
Local Node/jsdom, browser/manual evidence, CI and integration are separate proofs.
