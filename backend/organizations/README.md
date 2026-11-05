# organizations

Organization configuration, centers, permission bundles and shared-user memberships (#99).
Read the root backend README and `docs/api-conventions.md` before changing this app.

## Scope and authorization

`Membership.scope` and `Profile.scope` have exactly two dimensions:

```json
{"centers": {"mode": "selected", "ids": ["00000000-0000-0000-0000-000000000001"]}, "quadrants": {"mode": "none", "ids": []}}
```

Modes are `none`, `selected`, `all`. None and empty selected deny an applicable
object dimension. Only selected carries ids; all is an explicit grant, never an
empty-array shortcut. New centers never expand a selected grant. Centers are
organization-scoped UUIDs with a unique organization/code pair; deactivate, never
delete. `GET /centers/` lists active assigned centers with id/code/name and exact
`?code=`, search, ordering and page-number paging. Center creation is currently a
platform ORM operation; #99 adds no center mutation endpoint.

Quadrants now exist in `geography` (#108). Selected ids in new configuration
writes must resolve to that organization's real quadrants and, when centers are
selected, to one of those centers. Existing opaque ids are not fabricated or
auto-granted: unresolved old ids fail closed until an administrator replaces them.
Geography uses the same paired effective grants for identities, relations and filters.

`services.effective_scope` is the single authorization authority. Each active
profile's scope intersects the membership's scope, and one such grant must cover
the action AND center AND applicable quadrant. Grants are never cross-combined.
Org-only configuration has no applicable center/quadrant dimension; action codes
still default-deny. The common viewset filters lists/details and checks objects
through this service; an undisclosed or out-of-scope object answers 404. The
`GET /me/` scope is a display projection of the effective grants; action/object
checks retain the original paired grants. `web/src/session/can.ts` consumes only
permission codes, so its implementation does not change. API/web fixtures move to
the new shape together with the schema; generated TypeScript must be regenerated.

Migration 0005 converts legacy nonempty arrays to selected and empty arrays to
none. Legacy profiles receive explicit all as the prior unrestricted profile
ceiling; this never widens the membership. Invalid persisted scopes fail closed.
The reverse conversion represents all as an empty legacy array (deny), not a
broader grant. No center rows are fabricated from legacy ids.

## Administration and audit

- `GET/PATCH /organization/`: current settings, revision and `expected_revision`.
  Settings include name, timezone, languages, epi_week, label_phone and work
  support_contact. Slug, country and organization identity are not tenant selectors.
- `GET /roles/`; `PUT /roles/{id}/permissions/` takes permissions, scope,
  expected_revision. `GET/POST /memberships/`; `POST /memberships/{id}/change-scope/`
  takes scope, expected_revision and optional profiles/is_active. List filters and
  ordering run on the server; the membership filters are user, profiles, is_active.
- Reads require organization.read, role.read or center.read; settings writes need
  organization.update and role/membership writes need role.update. Action maps
  default-deny. The active organization always comes from the authenticated membership.
  A membership create references an existing shared User by UUID and exposes only
  that UUID, not an unrelated personnel profile. It never creates a user or tenant.
- A change revalidates the actor under an organization FOR NO KEY UPDATE lock
  (`select_for_update(no_key=True)`), then locks the target. All privilege removals, including the platform assign_profiles helper,
  use that serialization point. No User/Device/DeviceSession/TokenPair locks are
  acquired below it, and no network/storage/mail runs inside it. Contention on
  administration's try-lock is retryable 429 administration_in_progress, Retry-After 1.
- An administrator is an active membership of an active user holding both
  organization.update and role.update, regardless of profile name. Removing the
  last such member or role capability rolls back with 409 last_administrator.
  A stale revision rolls back with 409 stale_revision; both expose safe blocked_by.
- ConfigurationRevision appends full organization, ProfilePermission or Membership
  snapshots, author and receipt timestamp. Prior snapshots are never rewritten.
  Existing rows get a baseline before their first edit. Logo history stores a hash,
  not an uploaded path or binary copy. An ORM guard and PostgreSQL trigger reject
  audit UPDATE/DELETE. Seeds record their author as null (platform action).
- Nine seeded bundles: courier, supervisor, entomologist, community_promoter, admin,
  coordinator, warehouse, regulatory, government. New internal bundles read current
  configuration; domain-specific inventory/permit permissions belong to their future
  issues. Government is fixed to portal.read and cannot be mixed with internal
  profiles. The effective service clamps even corrupted mixed assignments to the
  government grant; #99 adds no portal endpoint. Admin includes field_event.sync
  explicitly so its effective grants can delegate every courier permission. This
  is an actual permission, not a delegation bypass: scopes and device/bearer
  authentication still apply. The idempotent seed grants it once to existing
  seed-created admins and preserves later revocation. Seed reruns retain revoked grants.
- Organizations are created only by bootstrap_organization, a platform command.
  There is no organization-creation HTTP endpoint.

## Configuration lock order and delegation (review round 1)

Any already-held User -> Device -> DeviceSession -> TokenPair locks precede
organization configuration; none is acquired after organization serialization.
Configuration writers take Organization FOR NO KEY UPDATE before target
Profile/Membership/RuleParameter locks. Administration uses nowait and retryable
429; management seeds may wait. Every nested seed uses the same no_key mode:
seed_organization_defaults, seed_default_permission_codes and
seed_default_rule_parameters must never upgrade the organization to FOR UPDATE.
These paths do not change organization primary/unique keys.

Catalog writers retain their Catalog FOR UPDATE lock. Their insert/commit needs
Organization FOR KEY SHARE for its foreign key. The seed may hold the organization
while it creates catalog rows/items whose foreign keys need Catalog KEY SHARE.
Organization NO KEY UPDATE is compatible with the writer's KEY SHARE, so the writer
can commit and release Catalog instead of closing the opposite-lock-order cycle.
The regression gates real catalog commits at every organization lock acquisition,
including nested seeds, with queues and a database lock timeout; it uses no sleeps.
See [PostgreSQL row-lock compatibility](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
and [Django no_key](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update).

Membership delegation validates each profile separately. Each permission's proposed
grant is profile.scope intersected with the proposed membership scope, compared
against one actor effective grant for that permission. An all membership ceiling
can therefore hold multiple narrowly scoped profiles without granting all access.
If the actor's own membership narrows a profile further, it cannot delegate the
profile's wider stored grant. No profile permissions or dimensions are unioned
into a broader grant during assignment.

## Raster logo

`POST /organization/logo/` is an authorized multipart upload (logo,
expected_revision); `GET` on the same path is authorized same-origin image/png.
Only validated bytes stored in the database are served. Legacy FileField paths
are never exposed; without a validated asset, logo_url is null and clients use
initials. Media responses are private/no-store and nosniff. Web writes retain
session-cookie/CSRF protection; field bearer tokens retain their pinned organization.
Multiple memberships need the same X-Organization header as other API calls;
a client can fetch authorized bytes and display a data URI under the existing CSP.

**[ASSUMPTION]** No sanitizer is present in declared dependencies. The permitted
fallback accepts only image/png, a PNG signature, <=1 MiB, <=1024x1024 pixels,
noninterlaced 8-bit RGB/RGBA, valid chunk CRCs, exact bounded decompression and
valid row-filter tags. It removes optional metadata and rebuilds only IHDR/IDAT/IEND.
It refuses SVG, HTML, MIME mismatches, trailing payloads and decompression excess.
This restricted validator is not a general image-decoder/sanitizer integration.
No new third-party dependency is added. **[ASSUMPTION]** Epi week defaults to iso;
mmwr is configurable. Supported language edits are es-MX/en.

## Launch rollout and decisions

Run migrations, then `manage.py seed_organization_defaults --organization <slug> --apply`
for existing organizations. This adds the four new profiles, missing launch items
and unset version defaults, preserves revocations and versions, and applies the
reviewed safety-bound definitions. Existing out-of-bound historical versions remain
history; new versions must satisfy the accepted bounds.

Applied: SA01/SA02, OP01-OP04/OP17, MO02-MO04, WE15/WE18, R02/R03.
OP15 is superseded by decision 91: #80's void-reason catalog and validator are
unchanged. OP16's dependent-correction policy remains in existing domain services;
#99 changes no void-reason validation or FieldEvent status/effect. #88 already supplies
revisit_interval_days and the day unit, author projection and history filter.
No sync event/result code is introduced, so sync translations do not change.

Verified APIs: [Django row locking](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update),
[historical-model data migrations](https://docs.djangoproject.com/en/5.2/ref/migration-operations/#runpython),
[bounded zlib decompression](https://docs.python.org/3.13/library/zlib.html#zlib.Decompress.decompress),
[boolean/Exists query projections](https://docs.djangoproject.com/en/5.2/ref/models/expressions/).

## Acceptance evidence

All new acceptance cases are in tests/test_organizations_b_01.py:

| Criterion | Evidence |
| --- | --- |
| 1: effective scopes | test_effective_scope_intersects_permissions_and_both_dimensions (eight cases); test_scope_data_migration_preserves_selected_ids_and_denies_empty_arrays; newly created unassigned center in the HTTP wiring test |
| 2: last administrator and seed | test_concurrent_last_admin_removals_retain_one_administrator (two threads, a barrier and commit-gated contention retry; no sleeps; PostgreSQL required); test_seed_rerun_preserves_revoked_grants_and_government_boundary; role removal/atomic audit test |
| 3: launch contract | test_launch_contract_has_thirteen_bounded_versioned_defaults_and_closed_items; test_catalog_metadata_preserves_protected_other_and_used_deactivated_labels; test_fuel_bounds_preserve_order_across_scheduled_transitions; test_seed_plan_reports_missing_items_and_versions_in_existing_launch_definitions |
| 4: wiring | test_center_endpoint_wires_default_deny_and_organization_and_dimension_isolation; spectacular --validate --fail-on-warn; api:generate requires installed openapi-typescript |
| Additional issue edges | test_logo_strips_metadata_and_refuses_mime_magic_and_decompression_mismatches; test_settings_and_role_revisions_reject_stale_or_last_admin_changes_atomically |

PostgreSQL integration/concurrency tests must run in the orchestrator's isolated
compose project. Docker is unavailable in this worktree's agent environment.


## Worktree validation and handoff (2026-11-05)

- Branch: feat/99-org-config. No commit, push, PR, migration application or deployment.
- ruff check backend: passed. Changed Python modules' format check: passed.
- mypy --follow-imports=silent on organizations, catalogs, changed core modules and
  rules/services.py + seeds.py: passed, 33 source files. Full mypy still reports
  rules/selectors.py:72 (Any return) and accounts/views.py:14 (missing kombu stubs),
  both outside the changed files, using this machine's installed runtime.
- pytest tests/test_organizations_b_01.py tests/test_rule_contract.py with selection
  effective_scope/ logo_strips/ schema: 17 passed (11 issue unit cases plus 6 existing
  schema cases). Nine new PostgreSQL cases and the existing DB contract case were
  deselected; none of those integration/concurrency tests has run here.
- manage.py check: passed. makemigrations --check --dry-run: no changes detected;
  applied migration-history consistency could not be checked (no server at the
  isolated placeholder port 55499). No connection was made to host port 5432.
- spectacular --validate --fail-on-warn using dev settings: passed, zero warnings;
  repeated LF-normalized export has identical SHA-256
  ce67959addeb02ffdfc1e043611bf1e98e8cffc333b9a8af8d6c47653ad380ae.
  Both catalog in-use query projections compile without connecting to a database;
  SQL execution still needs PostgreSQL.
- TypeScript regeneration and web/client tests remain pending: package directories
  are present as placeholders but the openapi-typescript CLI and installed JS
  executables are absent. No npm ci or dependency installation was attempted.
  Run npm run api:generate with locked dependencies, then client/web checks.
  The exported Python schema used Django 5.2.15, DRF 3.17.1 and spectacular 0.29.0,
  not the versions declared by the project lock; re-export in the locked runtime.
- gh issue view 99 returned HTTP 401. Implementation uses the owner's supplied
  complete issue and decisions, not an asserted fresh GitHub inventory.
- Concurrent changes to backend/compose.yaml and .github/workflows/backend.yml
  (PostGIS image) were observed and preserved. They are not #99 implementation edits.

Changed implementation files (relative to repository root):

- organizations: backend/organizations/models.py, scope.py, logo.py, services.py,
  selectors.py, serializers.py, views.py, urls.py, defaults.py, exceptions.py,
  README.md, management/commands/seed_organization_defaults.py,
  migrations/0004_membership_revision_organization_epi_week_and_more.py,
  migrations/0005_explicit_scope_and_revision_guard.py.
- Shared wiring: backend/core/permissions.py, views.py, exception_handler.py;
  backend/config/urls.py.
- Catalogs: backend/catalogs/seeds.py, selectors.py, serializers.py, services.py,
  exceptions.py, views.py, README.md. Rules: backend/rules/seeds.py, services.py,
  README.md. #88 models/author/filter implementation is reused.
- Tests: backend/tests/test_organizations_b_01.py, test_me.py,
  test_organizations.py, test_seed_defaults.py. Redundant legacy default-value
  cases were consolidated into the integrated 13-rule launch acceptance case.
- Contract/docs: docs/api-conventions.md, glossary.md, decisions.md (92);
  packages/api-client/openapi.yaml, README.md, test/helpers.ts;
  web/src/test/fake-api.ts. src/generated/schema.ts awaits the installed generator.


## Adversarial round 1 regressions

The corrections remain uncommitted. Tests in tests/test_organizations_b_01.py:

| Finding | Regression |
| --- | --- |
| 1: admin/courier authority | test_default_admin_bundle_covers_courier_permissions_within_scope; real effective grants cover all courier codes and still deny foreign center/quadrant ids |
| 2: organization/catalog lock cycle | test_organization_serialization_allows_catalog_writer_foreign_keys; four entry points probe catalog writer commits under every outer/nested organization lock |
| 3: profile-limited delegation | test_membership_delegation_checks_each_profiles_effective_scope; create and change accept profile intersections, deny grants wider than the actor and preserve state on failure |
| 4: missing fuel defaults | test_missing_fuel_default_validates_current_and_scheduled_pair_atomically; compatible current/scheduled counterparts retain history and receive the missing min/max; incompatible pairs abort profiles, catalogs, definitions and versions together |

Existing seed-contract assertions now include admin sync authority; upgrade and
revocation cases also cover the new admin permission. No endpoint/schema shape,
void-reason policy or dependency changes are part of this review round.


Round 1 local validation (base commit 1d03032; fixes uncommitted):

- ruff check .: passed; format --check on the six changed Python files: passed.
- mypy --follow-imports=silent on the four changed production modules: passed.
  Full mypy still reports only rules/selectors.py:72 (Any return) and
  accounts/views.py:14 (missing kombu stubs), both unmodified in this round.
- pytest tests/test_organizations_b_01.py tests/test_rule_contract.py
  -m "not django_db" -q: 18 passed, 24 deselected. The admin-bundle regression was
  observed failing on field_event.sync before the fix and passing afterwards.
- Organization/seed tests collect successfully: 81 cases in the two changed test
  files. Four new regression functions cover 15 cases: one unit and fourteen
  PostgreSQL cases. The two added admin-sync upgrade/revocation seed cases also
  require PostgreSQL. No database assertions in these new integration cases ran here.
- An initial name-based selection accidentally included two delegation DB cases;
  their setup failed to connect to isolated port 55499. The corrected marker-based
  unit run above avoids the unavailable database. Docker was not invoked.
- manage.py check: passed. No dependencies, migrations, schema/client types,
  void-reason validation, commits or pushes were changed by this review round.

## Geography permissions (#108)

The existing grant-once seed adds quadrant.read, quadrant.publish and
sampling_point.create to admin/coordinator; supervisor receives quadrant.read only.
No other role receives geography authority. Revocations and ConfigurationRevision
audits retain the #99 behavior. Geography writers lock Organization NO KEY UPDATE
before Quadrant; waiting publishers re-check revisions after the winner commits.


B-13 (#110) adds field.bootstrap to the seeded courier and admin bundles through
the same once-only seed path as field_event.sync. Existing organizations upgrade
with seed_organization_defaults --apply; later explicit revocations stay revoked.
Admin carries the actual grant to preserve its explicit delegation ceiling.


Offline bootstrap/sync pass explicit captured profiles to effective_scope. Their
membership, user/organization activity and active assigned profile projections
come from one SQL snapshot; this path performs no further profile queries.
Supplying profiles preserves the same scope intersection and government clamp,
and still rejects inactive/foreign profiles. Ordinary callers retain their existing
profile-loading path. No new Organization lock is acquired below a courier lock.
