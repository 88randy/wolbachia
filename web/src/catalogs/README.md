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

Reorder swaps two active non-Other neighbors by PATCHing their sort values.
Duplicate active sort values trigger one renumbering pass (10, 20, 30...).
These writes are **not atomic**: a failure may leave a partial order. Invalidate/refetch
after every completed attempt and show an alert on failure; do not simulate rollback.
Concurrent editors can still overwrite each other's sort because the API has no batch
or conditional update contract. Other remains fixed, last, and has no actions.

Mutations use `useSessionGuard`: compare only the captured/current session revision,
discard stale answers before UI/cache changes, check between reorder PATCHes,
and abort on unmount. The editor and every dialog/draft are keyed by
`user.id:organization.slug:catalog.slug`: switching users or organizations discards them,
even on the same catalog slug. Re-authentication of the same identity preserves drafts.
Only the session controller writes session state (decision 92).

Labels validate against the existing backend's 64-character code and 200-character label
limits. English may be blank and falls back to Spanish, with warnings.
Create sends max(active non-Other sort) + 10, capped at 10000, instead of relying on
the backend automatic order (which includes inactive items). The sort_exhausted mapping remains a fallback.
No icon/requires_photo fields are sent. Error codes map to localized keys; never server detail.

The API lacks in-use counts and authors; the editor does not invent either.
Consumer screens/mobile must enforce free text when choosing Other; this editor
does not select catalog items for records. The catalog launch list remains pending.

Tests: `catalog-session.test.tsx` uses deferred catalog/item reads to prove that a changed
user or organization on the same slug dismisses a ready draft, sends no POST, and never
shows previous rows while loading. Domain sort/schema/outcome cases, app-level
permission/confirmation/session/pagination/refetch regressions, and `web/e2e/catalogs.spec.ts`
for the mocked keyboard journey and axe in both locales/themes. No backend or generated-client edits.
