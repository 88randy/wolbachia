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
| Real browser R2, focus/reflow at 320 and +30% text | `web/e2e/w-15.spec.ts` (written, intentionally not run) |

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
