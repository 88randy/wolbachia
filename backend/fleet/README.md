# fleet

Issue #103 (B-05), backend only. Reuses shifts.Motorcycle, Shift and the existing
motorcycles viewset. No field-catalog snapshot fields change. Read ../README.md,
../shifts/README.md and ../../docs/sync.md before changing these flows.

## Boundaries and locks

models.py holds ServiceRecord, ResponsibilityLetter, FuelLoad and InspectionClearance.
services.py owns maintenance, letters and named clearance; fuel_services.py owns the
fuel event; selectors.py owns operational metrics and audit replay. Payloads,
serializers and views only validate and delegate. AppConfig.ready registers fuel.load
and the shifts.extensions hooks: shifts imports no fleet module at module level.

Every fleet write locks Motorcycle, the same arbiter as shift.open. Web writes
try-lock through shifts.access with nowait; PostgreSQL 55P03/40P01 map to existing sync_in_progress 429
and Retry-After. Under sync the account order remains User -> Device ->
DeviceSession -> TokenPair -> courier advisory lock -> Motorcycle. Fuel takes no
additional account locks. There is no network, storage or mail under these locks.
The existing partial unique indexes remain the final allocation arbiters; shift
open/close semantics and severe opening review are unchanged.

Clearance revalidates motorcycle.service_clear after locking, checks revision,
requires normalized reason and nonempty UUID evidence, then atomically inserts
InspectionClearance + MotorcycleBlockEvent and advances Motorcycle.revision.
Audit replay resolves that named fault only. Other severe, service_overdue and
out_of_service blockers survive. A scalar-only nonsevere blocker also survives.
Legacy unblock refuses an unresolved audited severe fault with
409 motorcycle_inspection_required; it cannot bypass the inspection workflow.
Revisions also advance for PATCH, severe blocks and legacy unblock.

## API and scope

All paths are under /api/v1/; organization comes from membership, never a body
selector. Motorcycle has a nullable organizations.Center FK (the actual geography
center identity in this repository). No center means only an explicit all center
grant can read/write it through the admin API. Center none/empty selected denies;
action and center must come from the same effective profile grant. Motorcycles have no quadrant relation,
so quadrant is not an applicable object dimension; a quadrant grant cannot widen
center scope. Foreign/out-of-scope parents and write references return 404.

- Existing GET/POST /motorcycles/, GET/PATCH /motorcycles/{id}/ add center,
  revision, and ?center=; detail includes read-only metrics. Code stays immutable; scoped ?code=
  and page-number paging remain. PATCH cannot move a motorcycle outside actor scope.
- GET/POST /motorcycles/{id}/services/ and /responsibility-letters/; history lists
  use page-number paging and server ordering. POST .../{record_id}/void/ uses
  the shared reason_code/reason resolver; content is immutable and dependents stay.
- POST /motorcycles/{id}/clear-fault/ takes fault_id, evidence_ids, reason and
  expected_revision; conflicts have safe blocked_by, fields are 400-only.
- GET /fuel-loads/: motorcycle, courier, efficiency_status, date_from (inclusive),
  date_before (exclusive), ordering and page-number paging. Provisional evidence is
  visible explicitly but excluded from operational metrics and interval baselines.
- GET /incidents/: severe-check block audits and their inspection-clearance state,
  scoped through motorcycle center; page-number paging and created_at ordering.

Admin reads require motorcycle.read. Service/letter writes require
motorcycle.manage; clear-fault requires motorcycle.service_clear. Admin/supervisor
receive service_clear through existing once-only seed bookkeeping; revoked grants
are never restored. Web uses existing session+CSRF; field sync remains pinned
bearer only.

[ASSUMPTION] Center scope and default-deny apply to the admin REST API. Field
capture uses the pipeline's field_event.sync permission: shift.open establishes
courier ownership and fuel.load requires that courier's open shift on the named
motorcycle, without motorcycle.manage. A courier restricted to center A can still
open a center B motorcycle and capture fuel for that shift (pre-existing #68
behavior). Scoping field capture requires a follow-up issue; shift.open/close
semantics are unchanged here.

## History and due metrics

ORM immutable managers and PostgreSQL triggers reject updates/deletes. Service and
letter void metadata can transition once through the shared resolver; payloads
remain intact. Fuel event is unique and entirely immutable. Fuel void is refused
(fuel_event_not_voidable), preserving every dependent interval and original ingest
verdict; correction/acceptance decisions belong to #22.

Each service explicitly configures optional service_interval_km/days; absent values
stay null, with no inferred sample-screen schedule. Its immutable provenance keeps
source service id and both intervals. Detail metrics expose last_service,
next_service_due_km/date, latest_odometer, latest_efficiency, efficiency_status and
due_metric_provenance. Voided services and provisional fuel never enter metrics.
Dates add configured days to performed_at, not server receipt time.

## Fuel

fuel.load schema 1 has motorcycle_id (the immutable human code, deliberately the
same identity as shift.open's motorcycle_code), litres, amount, currency (uppercase
three-letter), odometer_km (0..999999), nullable receipt_upload_id and is_full_refill.
The courier must have an open shift on exactly that motorcycle. Litres/amount are
positive finite Decimals. Receipt absence persists as receipt_pending=true.

Only a full refill immediately following an accepted full refill of the same
motorcycle, without intervening partial loads, is comparable. Unknown/partial,
late and equal-device-time intervals are unavailable. Efficiency is distance over
current litres. Thresholds and provenance come from the same annotated rows of one
list_parameters_with_current query at device_time; Decimal values, version ids and
effective_from are persisted, with baseline id. No separate rules_at read is used.
Compare unrounded efficiency: 15 and 60 are inclusive with the seeded rules; 14.99/60.01 request review. A lower
odometer retains evidence in review. No advisory refuses capture or shift close.
A replay returns the immutable original event result and creates no second FuelLoad.

The fuel handler inserts provisional evidence inside the motorcycle lock's nested
savepoint, then raises any review signal only after that savepoint exits normally.
Raising inside the lock would roll back the capture before sync could keep it.

[ASSUMPTION] No upload/evidence model exists: receipt/document/evidence references
are opaque UUIDs validated for format, not verified storage ownership. No storage
call is made. Receipt null is explicit; evidence lists are bounded to 50 ids.
[ASSUMPTION] #22 acceptance is not implemented in reviews. All externally flagged
or fuel-advisory in_review rows persist provisional=True and have no operational
effects. This issue adds no acceptance endpoint and never rewrites the original
FieldEvent status, either timestamp, snapshot token or provenance.
[ASSUMPTION] Fuel decimals allow three litre and two currency decimal places;
service interval representation is per-service configuration, not a global default.

## Verification

Acceptance -> test map is at the top of tests/test_fleet_b_05.py. PostgreSQL is
required for its migrations, trigger guards and barrier allocation/clearance test;
Docker is prohibited for this implementer, so the lead must run these checks.
Fuel capture tests use plain courier phones with field_event.sync only. Input and
registry contracts run without a DB in test_fleet_payloads.py and existing
test_sync_registry.py. test_fleet_fuel_rules.py deterministically supplies discordant
old values/new version rows and checks that limits and provenance use the same
source, including an unconfigured limit. It fails against the former two-read
implementation. This is a unit regression, not a PostgreSQL publication barrier;
no live database concurrency was exercised. No dependencies are added.

Official APIs checked for this implementation:
- https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update
- https://www.django-rest-framework.org/api-guide/fields/#decimalfield


### Local delivery checks (2026-11-05)

The existing backend/.venv has Django 5.2.19 / DRF 3.18.3 / Shapely 2.2.0;
no packages were installed. Dotenv loading was disabled for every check.

- `ruff check backend`: passed. `ruff format --check` on all changed Python
  modules: 48 files already formatted. The full-backend format check reports the
  unchanged tests/test_motorcycle_services.py; it was not reformatted in this issue.
- From backend, `.venv/Scripts/python.exe -m mypy .`: passed, 164 source files,
  including strict fleet.fuel_services and shifts.access.
- From backend, `.venv/Scripts/python.exe -m pytest tests/test_structure.py
  tests/test_fleet_payloads.py tests/test_sync_registry.py
  tests/test_motorcycle_serializers.py -m "not django_db" -q`: 33 passed,
  18 PostgreSQL cases deselected.
- `.venv/Scripts/python.exe -m pytest tests/test_fleet_b_05.py --collect-only -q`:
  11 cases collected; execution is pending PostgreSQL, including both barrier cases.
- `manage.py check`: no issues. Offline MigrationLoader(None) +
  MigrationAutodetector compared all migration states with registered models:
  no drift. This does not validate PostgreSQL SQL/triggers or applied migration history.
- `npm run api:generate`: blocked when uv tried to persist its interpreter cache
  (access denied). The existing virtualenv can run the export directly, without
  installing packages, modifying permissions or relocating that cache:
  `backend/.venv/Scripts/python.exe backend/manage.py spectacular --validate
  --fail-on-warn --file packages/api-client/openapi.yaml`, using dev settings and
  throwaway bootstrap URLs. Passed with no warnings; no DB/Redis connection needed.
  `npm exec --workspace=packages/api-client --no-install -- openapi-typescript
  openapi.yaml --output src/generated/schema.ts` regenerated the client; generated
  files were normalized to LF, never hand-edited. Client `tsc --noEmit` passed.
- `npm test --workspace=packages/i18n`: 13 passed; its typecheck passed.
  `npm test --workspace=packages/api-client`: 19 passed.
- `git diff --check`: passed. No commit/push, web/mobile edits or lockfile changes.

Not verified: PostgreSQL-backed service/API/concurrency tests, actual migration and
trigger execution, CI or remote issue state (gh issue view 103 returned HTTP 401).
An initial makemigrations history check inherited test settings' port 5432 and was
refused; subsequent commands used an explicit throwaway configuration and offline
migration inspection. No PostgreSQL data was accessed; Docker was not invoked.
