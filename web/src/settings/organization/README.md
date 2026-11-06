# Organization settings, roles and scope (W-03, #147)

W65 `/settings/roles` and W68 `/settings/organization` consume the generated B-01 contract. Read `web/README.md` for shared shell, query, session, table and accessibility rules.

- Organization-global routes, navigation and queries require their action codes alone, even when center scope is none/empty. Dimensional grants continue to restrict the center picker, scope mode controls and scoped reference lookups.
- `use-w-03.ts`: organization-scoped generated projections and server paging/search/order. The roles/memberships view is also URL-owned (`?view=memberships`). No invented center parameter on organization-global resources.
- `use-admin-write.ts`, `run-admin-write.ts`: one guarded attempt, immediate duplicate-submit lock, no automatic replay after reauthentication.
- `use-scope-editor.ts`: role permissions and membership scope, explicit revision comparison/review. Profile scope applies to the entire bundle. All dimension writes go through `scope-draft.ts`, which atomically increments an independent intent revision for every change (including resets/no-ops and accepted lookups). A lookup captures that revision at start; the reducer accepts it only when the revision still matches and the mode is selected. No raw scope setter is exposed. Lookup handlers receive only the intent revision and a commit method. Context/intent keys unmount and abort obsolete lookups, releasing their pending tokens; Save checks the remaining registry synchronously. Checked permissions can be revoked even when the actor cannot grant them.
- `branding.ts`, `organization-requests.ts`: PNG/JPEG/WebP input; all three formats normalize to bounded RGB/RGBA PNG because the current backend validator accepts only PNG. Multipart uses the client's documented [bodySerializer](https://openapi-ts.dev/openapi-fetch/api#bodyserializer). No new dependencies.
- `use-logo.ts`: retrieves only the same-origin authenticated raster endpoint through the API client so the organization header is retained; displays trusted PNG data under the existing `img-src self data:` policy, with initials on failure.
- `organization-cache.ts` publishes guarded write responses across the same actor/organization/authorization center variants, cancelling older reads and never replacing a newer cached revision. Clean forms adopt newer snapshots; dirty forms retain their draft and expected revision. Logo-only success has its own announcement and preserves pending field changes.
- Post-save identity refresh treats cancellation as coordination, never a failed verification: await the in-progress check, then verify freshly after the write. Real verification failures remain closed; writes are never replayed. Permission cells include their visible status in the accessible name and keep stable ids so dialog focus returns across table remounts.
- Components are presentation modules; request, draft, conflict and session logic live in hooks/domain functions.

## Contract gaps returned to B-01 (#99)

The Profile projection has no fixed/read-only discriminator or available-permissions catalog. Empty or exclusively `portal.*` bundles are conservatively read-only without profile-name branching. A revoked internal bundle therefore cannot be restored in this UI until an explicit discriminator is available. A formerly external bundle with internal permissions cannot reliably be classified by this schema; backend authorization remains authoritative. Do not fabricate profile identity from its label or slug.

Country is returned but cannot be patched. The only scope is per profile/membership, not per permission cell. The UI uses profile rows and permission buttons in DataTable rather than pretending to save a per-cell scope. Nine seeded bundles come from server data, without frontend seeds. There is no organization creation, export, void, revision-history or effective-time endpoint here; show current revision only. Membership projection exposes user ids without display names. Retained scope ids resolve to human codes through scoped detail endpoints; new references resolve exact scoped human codes. Unknown/foreign references share one unavailable fallback.

The shell center preference invalidates context and URL filter chips. B-01 organization/roles/memberships remain organization-global. Quadrant and motorcycle list/code queries pass the explicit URL center before the active center, within backend scope; blocks/points retain their supported quadrant constraint. The scope-code quadrant resolver passes the active center when it applies.

## Verification map

| Criterion | Evidence |
| --- | --- |
| Keyboard matrix payload, last administrator retained, fixed consultation bundle | `w-03.test.tsx` keyboard/refusal case; server role is never optimistically overwritten |
| Concurrent edits require refresh/review | `w-03.test.tsx` revision conflict case |
| Center changes clear results/chips without expanding scope; late response ignored; supported API filter precedence | `../../centers/center-selection.test.tsx` barrier journey and paged remembered-selection case; center-filter/center-query regressions for API parameters and table/map results |
| Pending scope lookup / removed ids / mode changes; delegated revocation | `scope-draft.test.ts` intent invariants; `w-03.test.tsx` deferred search-and-remove-same-center and keyboard revoke regressions |
| Organization cache revision after navigation; clean/dirty draft synchronization; stale write isolation | `w-03.test.tsx`, `organization-cache.test.ts`, `use-organization-draft.test.ts` |
| Branding, timezone/epi-week roundtrip, invalid upload | `w-03.test.tsx`, `branding.test.ts`, `logo-upload.test.tsx` |
| Org-only permission access with none/empty centers; missing action denial; scope changes clear old results | `../../router/area-access.test.ts`, `w-03.test.tsx` routes/links/queries and live scope-change cases |
| Unknown/foreign codes indistinguishable; membership exact scope payload | `w-03.test.tsx` membership case |
| Post-save focus race, fresh identity and callback after a committed write | Deferred role/membership/organization races in w-03.test.tsx, including a superseded 503 |
| No replay after reauthentication; draft remains usable | `w-03.test.tsx` 401 journey |
| Axe, focus/return, live results, light/dark, es-MX/en, expanded text, 320px | Component axe plus `web/e2e/w-03.spec.ts` (CI; deliberately not run locally) |

Manual browser focus/contrast/reflow and real-backend integration remain unverified locally. No Docker, commits, push, PR, merge or deployment.
