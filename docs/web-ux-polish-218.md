# Shared web UX polish (#218)

The approved #202 visual language remains authoritative. Shared settings, table,
filter, switch, breadcrumb, feedback and dialog patterns apply to existing screens.
The server capabilities supplied by #224 are now connected through its generated client.

## Contract inventory

| Screen | Server search / facets | Public ordering |
| --- | --- | --- |
| W20 motorcycles | Exact code, center, is_blocked, include_voided (no free-text API) | code, plate, created_at, center |
| W22 quadrants | search/code/center | code, created_at |
| W24 blocks / points | search/code with quadrant constraint | code, created_at |
| W65 roles | search | slug, label_es, label_en |
| W65 memberships | is_active | created_at, is_active |
| W62 parameters | key search; unit and value_type | key, unit, value_type, effective_from |
| W62 version history | reason search; status; independent include_voided | effective_from, created_at, value |
| W63 catalog navigation | slug/label search; server paging | slug, label_es, label_en |
| W63 catalog items | code/label search; is_active; server paging | code, label_es, label_en, sort, created_at, usage_count |
| W67 phones | label/serial/app_version/username search; is_revoked; current-user historical sessions | label, serial, app_version, last_seen_at, created_at |
| Quadrant / block histories | positive revision, current author, inclusive/exclusive ISO datetime bounds | revision, effective_from, created_at, created_by |
| Point history | positive version, current author, same datetime bounds, is_retired | version, effective_from, created_at, created_by, is_retired |

No unsupported free-text history search or fabricated browser filtering is present.
Author selectors offer the signed-in user only; there is no raw UUID picker or invented
directory. The phone choice says "With my sessions" because the API includes historical
sessions. ISO datetime bounds explicitly require a time zone and retain server validation.
Server-side values, totals and paging are used without changing map or publication-validation reads.

## URL and reorder safety

Decisions 132 and 133 are provisional until integration. Shared SortSelect exposes all
public sort fields in both directions, including fields outside the visible columns.
Column headings retain the sort indicator and aria-sort. Text filters apply on Enter/Apply;
chips and Clear filters update the URL and reset only their own table's page.

The catalog picker owns catalog_* query keys. Item filters own the unprefixed table keys.
Geography histories own history_* keys, independent of the parent list's page/search/order.
Closing a history removes its namespace while retaining the parent view. Unsupported or
unsafe URL values are reported rather than forwarded. Positive revisions must be safe integers.

Catalog availability visibly selects Active by default. All uses is_active=all in the
URL only and omits the API facet; Deactivated sends is_active=false. Existing
include_deactivated=true URLs retain All until migrated by an interaction. Removing an
availability chip or clearing filters explicitly selects All, never silently restores Active.

Visible catalog rows use a 25-row server page. An independent unfiltered all-page query
supplies create limits, sort capacity and the complete active non-Other reorder ID set.
It is not a browser-filtered table. Search, inactive-only views and alternate ordering
explain why dragging is disabled. Default position order permits a move within a page
while sending the complete canonical ID set, retaining off-page/fixed/inactive positions.
The sole draggable explicit ordering (sort ascending) is also requested by the canonical
query, so its tie-breaking order matches the visible server view.

A mutation's expected revision covers every same-catalog/session/grant snapshot used to
form its intent: the minimum of the canonical IDs and visible rows, captured at pickup.
A newer canonical fetch cannot authorize intent from older visible rows. Reversing that
skew is conservative too. A stale revision yields 409, reloads both queries and restores
server order. Undo uses its successful response's explicit revision, never that minimum
or a newer editor's version. Session/authorization changes cancel old drags and retire Undo.

orgScopedQueryOptions retains placeholders only within its existing identity, grant,
revision and center fence (decision 92). Neither target-catalog placeholder query can
authorize a write. Catalog observers survive tab changes; identity/slug-scoped drafts
remain isolated. Refresh errors keep previous rows and drafts visible with Retry.

## Shared interaction

Settings shows permission-aware overview cards. One user menu lives in the top bar.
The mounted shell owns breadcrumbs, whose leading ancestors shorten on narrow screens.
Icon row actions have localized names/tooltips. Availability changes and reorder offer
guarded Undo; irreversible void/publish flows keep their confirmations. Dialog footers
use equal desktop tracks and stack at the existing compact token breakpoint. Drag feedback
is instantaneous, including reduced motion. Existing switch and focus primitives are reused.

## Acceptance to test map

| Criterion | Evidence |
| --- | --- |
| Settings, permissions, single user menu, current breadcrumb, mounted shell | SettingsPage, AppShell and router tests |
| Keyboard reorder/drop/cancel, fixed-row safety | ReorderProvider and catalog-domain tests |
| Pointer pickup/cancel without a write | ReorderProvider tests; successful pointer drop belongs to CI browser journey |
| Complete paged reorder IDs, both directions of revision skew, 409 recovery | catalog-filters tests and existing CatalogsPage revision/refetch/Undo tests |
| Draft/session boundaries and no stale replay | CatalogsPage, catalog-session and session-race tests |
| Active/All/Deactivated, legacy URL migration, filtered reorder guard | catalog-filters and CatalogsPage tests |
| Actual parameter, history, phone and catalog server query parameters | RuleParametersPage, VersionHistory, PhonesPage and catalog-filters tests |
| History namespace and typed author/date/version/status requests | table-url-scope and geography/history-filters tests |
| W24 visible resource filters leave map/validation reads unfiltered | resource-filters tests |
| Filter/sort/chip/clear URL state, retained rows on refresh error | table-state and DataTable tests |
| Cancel/Save order, equal geometry and busy protection | DialogFooter tests; geometry in browser journey |
| Axe, filters, successful pointer/keyboard drag and Undo in real DOM | Updated catalog e2e journey; focused local CI-regression exception below |

The exact commands, exit codes, causal RED and source manifests are in the ignored
web/test-results handoff. Before this CI follow-up, independent code, security and
adversarial review approved the combined source and the orchestrator's full suite passed
all 1,068 tests across 114 files; subsequent #247 integration changed documentation only.
This CI-regression delta requires its own review and final checks. Global hooks and CI
remain publication gates; owner LIVE approval is required before merge.

## Local review

Start npm run dev -w @wolbachia/web -- --host 127.0.0.1 --port 5218 --strictPort and open
/harness/ux-preview.html?path=/settings/catalogs/intervention-type. Add theme=dark and
lang=en. The separate dev entry uses real routes with synthetic in-memory server fixtures,
makes no API network calls, resets on reload and is absent from the production entry.
No preview process is currently running. The fixtures implement the visible
availability/search/order/page examples; they are not evidence of backend correctness.

The owner's feedback PNG directory was unavailable. Versioned W20/W62/W63/W65/W68 PNGs,
source HTML and the approved #202 kit were inspected. MiMenu was read only for handle-based
drag/icon patterns; no branding or client records were copied. Docker, physical devices and the broad browser visual/contrast matrix remain unverified
locally. After actual CI failures at PR249 head1dd28b9, an authorized local Chromium
exception reproduced the ambiguous submit selector in all four rule-form locale/theme
cases and the W63 Escape-focus failure. The scoped fixture and guarded instant focus
restoration pass those five cases with one worker and zero retries, including W63
ordering-reset focus, subsequent pointer drop and Undo. This is not a full browser run.
The later CI unit failure in the canonical W15 still-permitted reauthentication case
was not reproduced with its original fixture. A temporary exact-response/scope probe
showed the legitimate record-loading DOM fence; it does not establish the historical
CI cause. The canonical test and production session implementation remain unchanged.
