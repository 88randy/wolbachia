# Organization settings, roles and scope (W-03, #147)

W65 `/settings/roles` and W68 `/settings/organization` consume the generated B-01 contract. Read `web/README.md` for shared shell, query, session, table and accessibility rules.

- `use-w-03.ts`: organization-scoped generated projections and server paging/search/order. The roles/memberships view is also URL-owned (`?view=memberships`). No invented center parameter on organization-global resources.
- `use-admin-write.ts`, `run-admin-write.ts`: one guarded attempt, immediate duplicate-submit lock, no automatic replay after reauthentication.
- `use-scope-editor.ts`: role permissions and membership scope, explicit revision comparison/review. Profile scope applies to the entire bundle.
- `branding.ts`, `organization-requests.ts`: PNG/JPEG/WebP input; JPEG/WebP normalize to PNG because the current backend validator accepts only PNG. Multipart uses the client's documented [bodySerializer](https://openapi-ts.dev/openapi-fetch/api#bodyserializer). No new dependencies.
- `use-logo.ts`: retrieves only the same-origin authenticated raster endpoint through the API client so the organization header is retained; displays trusted PNG data under the existing `img-src self data:` policy, with initials on failure.
- Components are presentation modules; request, draft, conflict and session logic live in hooks/domain functions.

## Contract gaps returned to B-01 (#99)

The Profile projection has no fixed/read-only discriminator or available-permissions catalog. Empty or exclusively `portal.*` bundles are conservatively read-only without profile-name branching. A revoked internal bundle therefore cannot be restored in this UI until an explicit discriminator is available. A formerly external bundle with internal permissions cannot reliably be classified by this schema; backend authorization remains authoritative. Do not fabricate profile identity from its label or slug.

Country is returned but cannot be patched. The only scope is per profile/membership, not per permission cell. The UI uses profile rows and permission buttons in DataTable rather than pretending to save a per-cell scope. Nine seeded bundles come from server data, without frontend seeds. There is no organization creation, export, void, revision-history or effective-time endpoint here; show current revision only. Membership projection exposes user ids without display names. Retained scope ids resolve to human codes through scoped detail endpoints; new references resolve exact scoped human codes. Unknown/foreign references share one unavailable fallback.

The shell center preference invalidates context and URL filter chips. B-01 organization/roles/memberships and current B-05 fleet endpoints have no center query parameter; these resources remain organization-global. Resources with a center parameter must pass the filter explicitly, within backend scope. The scope-code quadrant resolver passes the active center when it applies.

## Verification map

| Criterion | Evidence |
| --- | --- |
| Keyboard matrix payload, last administrator retained, fixed consultation bundle | `w-03.test.tsx` keyboard/refusal case; server role is never optimistically overwritten |
| Concurrent edits require refresh/review | `w-03.test.tsx` revision conflict case |
| Center changes clear results/chips without expanding scope; late response ignored | `../../centers/center-selection.test.tsx` barrier journey and paged remembered-selection case |
| Branding, timezone/epi-week roundtrip, invalid upload | `w-03.test.tsx`, `branding.test.ts`, `logo-upload.test.tsx` |
| Empty/out-of-scope deep link; permission/scope revocation clears content | `w-03.test.tsx` denial and live revocation cases |
| Unknown/foreign codes indistinguishable; membership exact scope payload | `w-03.test.tsx` membership case |
| No replay after reauthentication; draft remains usable | `w-03.test.tsx` 401 journey |
| Axe, focus/return, live results, light/dark, es-MX/en, expanded text, 320px | Component axe plus `web/e2e/w-03.spec.ts` (CI; deliberately not run locally) |

Manual browser focus/contrast/reflow and real-backend integration remain unverified locally. No Docker, commits, push, PR, merge or deployment.

