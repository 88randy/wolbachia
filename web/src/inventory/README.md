# Inventory workspace (W8–W11, #151)

The workspace consumes the canonical #105/#270 generated contract through
`packages/api-client`. It composes the existing #202 UI, DataTable, FilterBar,
FolderTabs, dialogs and tokens. It adds no shared widget, backend writer or grant.

## Routes and ownership

| Route | Screen / action |
| --- | --- |
| `/inventory` | Entry links permitted by the accepted session |
| `/inventory/supplies[/:code]` | W8 catalog, named attributes/protocol, create/update/deactivate |
| `/inventory/lots` | W9 server-filtered lots, expiry and blocker facets |
| `/inventory/lots/new`, `/inventory/lots/:code` | W10 incomplete draft, completion, exact retained pins and status |
| `/inventory/locations[/:code]` | W11 geometry, responsible Membership, stock and signed ledger |

Codes are human navigation identities. The client resolves relation codes to
authorized master UUIDs before API filtering; it never substitutes a User UUID for
a Membership or asks the operator to type an owner UUID. `inventory-query.ts`
owns the scoped data adapters, `inventory-options.ts` the closed action modes,
and `inventory-write.ts` the generated write calls.

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

List actions sit below headings and the feature's filter/grid wrappers allow
controls to wrap at 320 px and increased text size. Shared widgets and tokens are
unchanged. Stock/ledger table filters use the existing controller builders;
parent `view`/`center` URL metadata survives clear-filter and tab actions.

## Verification ownership (§9)

| Criterion | Cheapest owning proof |
| --- | --- |
| Null/exact pins, unknown arrays, URL facets/order/page/back links, decimal precision | `inventory-query.test.ts` |
| Named catalog configuration, no invented nullable defaults, read-only action gate | `supplies/supplies.test.tsx` |
| Draft completion, actual blockers, 409 preservation, explicit adoption, Retry-After | `lots/lots.test.tsx` |
| Closed placement/owner payload, whitespace rejection, exact ledger links, lost-response coordinate reconciliation | `locations/locations.test.tsx` |
| Same accepted map/list page and missing-WebGL fallback | `inventory-map.test.tsx` |
| ABA, current-read draft restoration/retirement, unknown/foreign deep links, reauth without replay | `inventory-session.test.tsx` |
| Router/client/CSRF/organization wiring and real MapLibre worker | One `e2e/inventory.spec.ts` journey |
| 320 px, all web typography tokens +30%, both locales/themes, axe and keyboard focus/return | One four-combination matrix in that browser spec |

Backend authorization, SQL filtering before count/page and PostgreSQL parity are
owned by #270; frontend mocks do not implement or prove those policies.

From the repository root, run lint, format and typecheck normally. Focused web
tests run from `web` with
`node ../node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads --silent=false src/inventory src/router/area-access.test.ts`.
Inspect the unhidden console for React act warnings. Build with explicit public
`VITE_API_BASE_URL=/api/v1`; browser checks use
`npm.cmd run e2e --workspace=web -- inventory.spec.ts --workers=1`.
Local Node/jsdom, browser/manual evidence, CI and integration are separate proofs.
