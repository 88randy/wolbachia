# Catalogs (W63, #35)

Routes: `/settings/catalogs` redirects to the first API catalog (or an empty state);
`/settings/catalogs/<slug>` edits that catalog. Both require `catalog.read`.
Tabs are links with `aria-current`; names and item labels are API data.
A failed refresh keeps cached catalogs, the editor and any dialog draft mounted; a notice offers retry.

All query keys live in `catalogs-query.ts`, defined with `orgScopedQueryOptions` using
identity supplied by `useSessionIdentity()`. Invalidation uses `invalidateOrgScoped` for
`catalogs`. Previous rows are never reused across users or organizations.
Read every catalog/item page with `page_size=200`, retain server order, and present
items without table pagination.
The `include_deactivated=true` URL toggle hides inactive items by default.
Configuration is deactivated after confirmation, never voided, and reactivated directly.
Permissions independently hide create, edit/move, deactivate and activate controls.

Reorder swaps active non-Other neighbors in the full server-ordered id list and
sends ONE POST /api/v1/catalogs/{catalog_slug}/items/reorder/ with {version, ordered_ids}.
The version is the minimum catalog_version of the SAME fetched items used to plan
the order, including all pages. It never comes from the separately cached catalogs
query: that revision can be newer than the order on screen. When pages straddle a
write, the minimum may produce a spurious 409, which is safe. The server normalizes sorts atomically;
Other stays fixed and inactive items keep their sort. Every completed attempt
invalidates both catalog and item queries. A 409 catalog_version_conflict maps to a
localized retry message, never server detail. No optimistic order is retained.

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
for the mocked keyboard journey and axe in both locales/themes. API types come from the generated #182 contract.
