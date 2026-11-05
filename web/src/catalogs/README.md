# Catalogs (W63, #35)

Routes: `/settings/catalogs` redirects to the first API catalog (or an empty state);
`/settings/catalogs/<slug>` edits that catalog. Both require `catalog.read`.
Tabs are links with `aria-current`; names and item labels are API data.

All query keys live in `catalogs-query.ts`. Read every catalog/item page with
`page_size=200`, retain server order, and present items without table pagination.
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
and abort on unmount. Dialog drafts are scoped to the catalog slug.

Labels validate against the existing backend's 64-character code and 200-character label
limits. English may be blank and falls back to Spanish, with warnings.
No icon/requires_photo fields are sent. Error codes map to localized keys; never server detail.

The API lacks in-use counts and authors; the editor does not invent either.
Consumer screens/mobile must enforce free text when choosing Other; this editor
does not select catalog items for records. The catalog launch list remains pending.

Tests: domain sort/schema/outcome cases, app-level permission/confirmation/session/
pagination/refetch regressions, and `web/e2e/catalogs.spec.ts` for the mocked keyboard
journey and axe in both locales/themes. No backend or generated-client edits.
