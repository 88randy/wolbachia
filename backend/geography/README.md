# geography

B-11 (#108): scoped, versioned quadrants, blocks and sampling points. Read
../README.md, ../organizations/README.md (scope, Center and lock order) and
../../docs/api-conventions.md first. No web, fleet or deployment work. Courier projection effects from #196 are described below.

## Version-history tables (#224)

Authorized quadrant/block histories filter revision, author and effective-time
bounds; sampling point histories filter version, author, time bounds and retired
state. Explicit ordering uses only immutable version fields; defaults remain
-revision/-version, and id resolves ties before paging. Identity-list filters are
unchanged. No geometry search, void state or mutation is introduced. Query
serializers and the scoped history query helper live in `history.py`.
Exact allowlists/bounds/errors: [configuration table contract](../../docs/api-conventions.md#configuration-table-queries-224).
Evidence: the three history cases in `tests/test_table_queries_224.py` exercise
ordering/filtering before pagination and reject foreign parents with those queries.

## Geometry and decisions

B33 (#126) adds append-only relocation decisions, real next-day task provenance,
third-party metadata and closure of an exact QuadrantVersion. See
[decisions/README.md](decisions/README.md) for original proof, current scope, raw
guards, lock order and verification boundaries.

Owner decisions applied: no django.contrib.gis/GDAL/PostGIS. Store GeoJSON in
JSONField and use the already locked Shapely 2.2.0/GEOS wheel. Polygon only,
[longitude,latitude], finite WGS84 bounds, explicit closed rings, holes validated
with is_valid/explain_validity. Boundary counts as inside; hole interiors do not.
Refuse antimeridian-crossing polygons (longitude span >180 degrees); never silently
reinterpret them. geometry.py is a small pure module with no Django/DB access.

Distances use haversine on a mean-radius sphere (6371008.8 m). The documented
approximation is <=0.6% relative to WGS84 ellipsoidal distance, including 10..200 m
spacing comparisons (up to 1.2 m at 200 m). Conservative bound derived from
NGA WGS84 a=6378137 m, 1/f=298.257223563: principal curvature radii lie in
[6335439.327,6399593.626] m, so max(R/min_radius-1,1-R/max_radius)<0.00562.
The same uniform metric bounds apply to shortest path lengths; round up to 0.6%.
This bound is a derivation, not an assertion of surveyed field accuracy.
Polygon containment/suggestions treat
lon/lat segments as planar, appropriate for local blocks, not geodesic boundaries.
Suggestions subtract existing blocks, then split the largest polygon pieces and take representative interior
points: four distinct review candidates, no publication and no permit/risk fields.
Shapely has no shipped stubs in this runtime; the sole mypy missing-import override
is shapely.*. No additional dependency is added.

Verified official APIs:
- https://shapely.readthedocs.io/en/stable/manual.html (2.2.0, validity, covers,
  representative_point and constructive geometry).
- https://earth-info.nga.mil/index.php?action=wgs84&dir=wgs84 (WGS84 defining parameters).
- https://shapely.readthedocs.io/en/stable/installation.html (binary wheels bundle GEOS).
- https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update
- https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS

## Identity, authorization and writes

Quadrant has an organization-unique code and Center FK; Block belongs to Quadrant;
SamplingPoint has a fixed organization-unique code and block. All are immutable.
QuadrantVersion/BlockVersion/PointVersion and ExcludedPointResolution append author,
organization and timestamps. ORM immutability plus PostgreSQL UPDATE/DELETE triggers
protect history and identities. No original FieldEvent status is touched.

Reuse organizations.services.effective_scope and the shared queryset filter;
model scope lookup paths retain the paired center AND quadrant grant. Both relation
fields and service checks return 404 for foreign/ungranted ids. Configuration writes
now validate real quadrant ids; no migration fabricates opaque legacy assignments.
Permission catalog: quadrant.read, quadrant.publish, sampling_point.create. The
existing grant-once ConfigurationRevision seed gives admin/coordinator all three,
supervisor read only, preserves revocations and custom roles, and adds no bypass.

Race invariant: all writes serialize on Organization FOR NO KEY UPDATE before
Quadrant FOR UPDATE, then descendants; authorization is refreshed after locking.
This retains #99's FK lock compatibility and privilege-removal serialization.
Waiting publications compare expected_revision after the winner commits, yielding
one successor and one 409. A database lock timeout/deadlock maps to retryable 429.
No network/storage/mail or later authentication locks run in the transaction.

A polygon publication atomically resolves ALL active points outside the new
geometry. keep accepts the old location explicitly, move must enter the new
quadrant, remove appends is_retired=true. Evidence is nonblank, <=1000 characters.
Duplicate/extra decisions are rejected; missing decisions list safe authorized
point blockers. Retired codes remain reserved. Later edits must resolve still-outside
kept points again. Block revisions refuse excluded active points; relocate them
before shrinking a block. All publish comparisons use the highest revision.

Spacing uses rules.selectors.get_values_in_force at check time (default 50 m,
10..200 bounds); distances rounded to micrometres strictly below the threshold warn, never prevent an otherwise valid publication.
Current/temporal reads project by effective_from with revision/version tie-breaks;
use quadrant_version_at(quadrant,captured_at) for retained visit geometry. Callers
must first resolve the identity through the scoped selector. Effective instants
are server receipt instants; no backdating API or client clock defines publication.

## Acceptance and validation

All new issue cases live in ../tests/test_geography_b_11.py:

| Criterion | Test |
| --- | --- |
| 1: geometry, exhaustive decisions, retained history | test_geometry_refuses_invalid_or_unsupported_coordinates; test_outside_points_require_exhaustive_evidenced_decisions_and_keep_history; test_keep_is_explicit_and_move_must_enter_geometry; test_invalid_resolution_decisions_leave_publication_untouched |
| 2: one concurrent successor | test_simultaneous_publications_create_one_successor_and_one_conflict (Postgres, two threads + barrier; commit-gated retry only on 429) |
| 3: identity, spacing, suggestions | test_fixed_codes_are_unique_per_organization_across_blocks; test_spacing_reads_the_current_rule_at_check_time; test_suggestions_are_read_only_and_exclude_existing_blocks; test_geometry_holes_boundary_and_four_review_candidates; test_metric_distance_handles_dateline_and_spacing_boundary; test_spacing_checks_just_below_equal_and_above_each_configured_boundary (10/50/200 m) |
| 4: wiring | test_endpoint_default_deny_and_foreign_org_center_quadrant_isolation; test_exported_geography_contract_matches_live_schema; schema validation/export command |

The existing test_seed_defaults bundle contract includes the three new codes;
the existing seed revocation behavior is reused. No duplicate framework tests.
Run the PostgreSQL suite in the orchestrator's isolated compose project, never
host 5432. This agent cannot run Docker/PostgreSQL. DB-free checks use the worktree
.venv with DATABASE_URL pointing to unused 55499, DJANGO_READ_DOT_ENV_FILE=false.
Run pytest tests/test_geography_b_11.py -m 'not django_db', ruff check/format,
mypy and spectacular --validate --fail-on-warn. The orchestrator runs
npm run api:generate and verifies a second run is clean; never hand-edit generated
TypeScript. GitHub issue lookup returned HTTP 401; supplied full issue is the spec.

## Local handoff (2026-11-05)

- Branch feat/108-geography; no commit/push/PR/merge/deployment or applied migration.
- Existing Shapely additions in pyproject.toml/uv.lock were preserved. No other dependency.
- Locked worktree runtime: Django 5.2.19, DRF 3.18.3, spectacular 0.30.0, Shapely 2.2.0.
- .venv/Scripts/python.exe -m mypy .: passed, 147 files.
- pytest tests/test_geography_b_11.py tests/test_organizations_b_01.py
  tests/test_rule_contract.py -m 'not django_db' -q: 27 passed, 38 deselected;
  9 passing geography cases and 13 unexecuted geography PostgreSQL cases.
- Geography plus seed tests collect: 74 cases. Added seed cases cover upgrades and
  retained revocations for admin, coordinator and supervisor through existing seeds.
- ruff 0.8.4 check backend: passed. Format check on the 18 changed Python modules:
  passed. Full backend format check reports only existing tests/test_motorcycle_services.py
  (outside this issue). uvx --offline ruff@0.17.3 --version failed because the sandbox
  denies writing its interpreter cache; no cache relocation or other workaround attempted.
  Run the pinned 0.17.3 linter/formatter in the orchestrator environment.
- manage.py check: passed. makemigrations --check --dry-run: no model changes detected;
  database migration-history consistency could not connect to isolated port 55499.
  No host 5432 connection, Docker invocation or PostgreSQL test was performed.
- spectacular --validate --fail-on-warn with dev settings: passed, zero warnings.
  Committed OpenAPI matches the live geography paths/components in the unit check.
  src/generated/schema.ts still requires the owner's npm run api:generate; it was not
  hand-edited. No installed JavaScript tool or client build is claimed.
- git diff --check: passed. GitHub issue lookup returned HTTP 401; the owner's full
  supplied issue and decisions were used, not a claimed current GitHub inventory.

## Adversarial round 1: write response snapshots

A successful write returns its own immutable version and warnings, even when a
newer publication commits before response serialization. Creation services now
return (identity, initial_version), or (point, initial_version, spacing_warnings).
Write views pass that exact version through serializer context; read views retain
current/temporal resolution. Point publication uses the returned PointVersion and
its own warnings instead of fetching the latest version after releasing locks.

Audit: point publish, point create, block create and quadrant create needed this
pinning. Quadrant version publish and block version publish already serialize the
returned immutable row (quadrant resolutions are tied to that version's id) and
retain their existing behavior. No database schema, endpoint shape, authorization,
lock order or dependency change accompanies this correction.

Criterion 2/4 and the reported regression map to:
- test_point_publish_response_retains_its_version_and_warnings_after_interleaving:
  DB-free; observed returning version 3 instead of 2 before the fix, then passing.
- test_create_response_retains_initial_version_after_interleaving: three DB-free
  cases, one each for quadrant/block/point creation, with a newer version present
  before serialization and the initial response still pinned to version 1.
- test_point_publish_http_response_stays_on_its_commit_after_another_publication:
  PostgreSQL wiring with actual commits; the second publication runs deterministically
  between the first service's commit and its view serialization, without sleeps.
  It checks that the original response keeps version 2 and its warning while version 3
  has a different location and no warning. transaction=True keeps this regression
  out of pytest-django's outer transaction so the first publication releases its locks.

The PostgreSQL regression is prepared for the orchestrator; it has not run here.

Round 1 local checks: ruff 0.8.4 check backend and format --check on the four changed
Python files passed; mypy . passed (147 files). The DB-free geography/#99/rule-contract
selection passed 31 cases, with 39 database cases deselected. Geography alone has
13 passing DB-free cases and 14 PostgreSQL cases pending; all 27 collect. The live
schema comparison still passes, so the public schema/client shape is unchanged.
No new assumptions, dependencies, commits or pushes are part of this round.

## Adversarial round 2: list search and ordering

GeographyViewSet explicitly registers CodeLookupFilter, SearchFilter and
OrderingFilter, following CenterViewSet. search_fields/ordering_fields now apply
on the server for quadrants, blocks and sampling points. Preserve exact ?code=
and the deterministic default order (code, id) for page-number pagination.

Criterion 4 maps to test_geography_list_filters_and_orders_across_pages: three
PostgreSQL cases (search, requested -code order, default order) use deliberately
unsorted insertion and read across pages. They check response counts and ordered
codes, not backend class configuration or query implementation details. Existing
scope-isolation coverage remains in its single dedicated endpoint test.

The owner regenerates OpenAPI/client: search and ordering now appear in the live
schema. Until that regeneration, the existing exported/live schema equality test
is expected to report the stale export; its assertions remain intact.

Round 2 local checks: ruff 0.8.4 lint for backend and format check for both changed
Python files passed; mypy . passed (147 files); git diff --check passed. DB-free
geography/#99/rule-contract selection: 30 passed, 1 failed (the retained exported/live
schema equality assertion), 42 database cases deselected. Live spectacular schema
validation passed with no warnings; comparing the three resource list operations
confirmed the only operation changes are the new search/ordering parameters.
The three PostgreSQL regression cases collect, but have not run here. The exported
schema and generated client remain untouched for the owner's regeneration.


## Courier projections (#196, D7b)

GeographyConfig registers quadrants and sampling_points producers (schema 1).
quadrants contains small typed quadrant/block references and current revision;
sampling_points contains current location/retirement with fixed code and parent
references. No polygon is required for placing an already located point.
Both filter the captured paired field.bootstrap grant and organization in SQL,
then provide organization/center/quadrant metadata to the registry guard.

Writers serialize Organization, lock all in-scope courier batches via the shared
fanout_courier_changes helper, then lock Quadrant/descendants. Create/publish of
quadrant/block/point emits its exact written version. Quadrant resolutions emit
upserts for changed points and their ovitraps, including is_retired=true for remove.
Point and block parents are immutable: move changes location inside the same
block identity, never transfers scope. No new move/remove writer is built; scope
revocation uses invalid_cursor -> bootstrap replacement. Resource versions are
decimal point version or reference revision. The ovitrap app owns its projection
logic, called locally for affected points under the same fan-out locks.

Tests: ../tests/test_bundle_producers_196.py covers all creation/publication
writers and keep/move/remove resolutions, shared fan-out and current reference
versions. Full contract, bound assumption and lock paths: ../../docs/sync.md.
