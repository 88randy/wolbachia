# Catalogs (W63, #35)

Routes: `/settings/catalogs` redirects to the first API catalog (or an empty state);
`/settings/catalogs/<slug>` edits that catalog. Both require `catalog.read`.
Tabs are links with `aria-current`; names and item labels are API data.
A failed refresh keeps cached catalogs, the editor and any dialog draft mounted; a notice offers retry.

All query keys live in `catalogs-query.ts`, defined with `orgScopedQueryOptions` using
identity supplied by `useSessionIdentity()`. Invalidation uses `invalidateOrgScoped` for
`catalogs`. Previous rows are never reused across users or organizations.
Visible catalogs/items use independent 25-row server pages with search, public sorting and
item availability from #224. Catalog navigation owns `catalog_*` URL state; item filters
remain unprefixed. The unfiltered all-page queries (`page_size=200`) only resolve selected
metadata and supply create/capacity/full atomic reorder IDs, never browser table filtering.
Availability is a labeled Active/All/Deactivated segment, default Active. URL `is_active=all`
omits the server facet; legacy `include_deactivated=true` preserves All. Clearing filters
selects All explicitly. Search, inactive-only and alternate ordering disable drag with a notice.
The sole draggable explicit order, sort ascending, also applies to the complete canonical query
so both participating snapshots use the same server tie-breaking semantics.
Configuration is deactivated or reactivated directly with optimistic feedback and session-guarded Undo, never voided.
Permissions independently hide create, edit/move, deactivate and activate controls.

Reorder uses a visible focusable grip with pointer/keyboard dnd-kit sensors, moving active non-Other items in the full server-ordered id list and
sends ONE POST /api/v1/catalogs/{catalog_slug}/items/reorder/ with {version, ordered_ids}.
The expected version is the minimum catalog_version of the SAME canonical ID list and
visible rows used to form that drag, captured at pickup within one session/grant/catalog.
Neither a newer canonical read nor the separately cached catalog metadata authorizes an
action based on older displayed rows. Undo instead uses its explicit returned revision. When pages straddle a
write, the minimum may produce a spurious 409, which is safe. The server normalizes sorts atomically;
Other stays fixed and inactive items keep their sort. Every completed attempt
invalidates both catalog and item queries. A 409 catalog_version_conflict maps to a
localized retry message, never server detail. Optimistic order replaces only active slots. Undo uses the version returned by that successful write; a newer server change makes Undo fail with the same conflict notice.

Mutations use `useSessionGuard`: compare only the captured/current session revision,
discard stale answers before UI/cache changes,
and abort on unmount. The editor and every dialog/draft are keyed by
`user.id:organization.slug:catalog.slug`: switching users or organizations discards them,
even on the same catalog slug. Re-authentication of the same identity preserves drafts.
Only the session controller writes session state (decision 92).

Labels validate against the existing backend's 64-character code and 200-character label
limits. English may be blank and falls back to Spanish, with warnings.
Create sends max(active non-Other sort) + 10, capped at 10000. The backend's
automatic sort also ignores inactive items. The sort_exhausted mapping remains a fallback.
No icon/requires_photo fields are sent. Error codes map to localized keys; never server detail.

The In use column shows usage_count (including zero), formatted for the locale,
with an accessible historical-reference explanation. There is no records link:
drill-down routes are outside #182's scope. Since shows the creation date and
created_by_username (localized dash for seed authors); deactivated rows show the
deactivation date and deactivated_by_username alongside icon/text status.
Consumer screens/mobile must enforce free text when choosing Other; this editor
does not select catalog items for records. The catalog launch list remains pending.

Tests: `catalog-session.test.tsx` uses deferred catalog/item reads to prove that a changed
user or organization on the same slug dismisses a ready draft, sends no POST, and never
shows previous rows while loading. Domain sort/schema/outcome cases, app-level
permission/confirmation/session/pagination/refetch regressions, and `web/e2e/catalogs.spec.ts`
for the mocked keyboard/pointer journey and axe in both locales/themes. API types include
the generated #224 list contract. `catalog-filters.test.tsx` covers actual server params,
independent navigation, visibility and complete paged reorder IDs/revision skew.

Visual refresh #202: the catalog index uses a shaped `CardSkeleton`; its no-catalog
state offers retry because this screen has no catalog-creation API. Item loading,
empty and error states remain owned by the shared `DataTable`, with the existing
permission-gated Add action above it. Refresh errors keep cached content and drafts
visible in `InlineNotice`. Statuses use `StatusPill`; action and native-dialog
buttons use the shared `Button`, including in-button submission progress. Codes and
timestamps use the mono token. Link tabs retain their URL semantics; native dialog
focus, validation, confirmation and submission logic are unchanged.


Issue #218 separates the query observer from the identity/slug-scoped editor. Catalog tabs keep
the page and query mounted; previous rows are placeholders only under orgScopedQueryOptions.
All controls are blocked until the target snapshot is verified. Row edit/availability actions
use icon buttons with translated tooltips. Search, facets and sorting use the real #224 contract.
See `docs/web-ux-polish-218.md` for the capability inventory and synthetic live preview.

Keyboard drag focus is an intent owned by the originating handle and resetKey. Instant
Feedback cleanup can blur a moved table row. use-reorder-focus waits for the public live
manager operation to become idle (dragend is an immutable pre-cleanup snapshot), then
restores only the same connected handle when focus is still on body. Inert content,
changed context, unmount and a subsequent focused control retire that intent. Pointer
operations do not restore keyboard focus. The official instant-animation callback was
verified but restored unconditionally after a filter reset, so it is not used. The W63
browser journey covers Escape focus, changing ordering during drag without focus theft,
and the subsequent pointer reorder/Undo. Reduced-motion feedback remains instant.

The focusin choice retires keyboard intent immediately, including when that control is
removed before cleanup finishes and focus falls back to body. It cannot revive the old
grip intent. Completion, context reset, unmount and a new drag release both the document
listener and any pending frame; the final activeElement alone is not sufficient evidence.
